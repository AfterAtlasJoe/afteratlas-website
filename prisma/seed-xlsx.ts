import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import * as XLSX from "xlsx";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Imports the death/wa/post_event survey content from the source
 * spreadsheet (see after-atlas-phase1-spec.md §6 for the column
 * reference). Generic over the column conventions it implements
 * (skip_if_already_shown, multiselect_group) — nothing here is
 * hardcoded to which specific rows use them. Re-running is safe
 * (everything is upserted). Called from prisma/seed.ts (the single
 * entry point Prisma's seed runner invokes — it doesn't run the
 * configured command through a shell, so chaining two scripts with
 * `&&` silently only runs the first one).
 */

// process.cwd() rather than import.meta.dirname — the latter evaluates to
// undefined once this module is bundled through Next.js's route-handler
// pipeline (as used by the former one-time /api/admin/run-seed route),
// even though it works fine run standalone via tsx. Both resolve to the
// repo root when invoked
// from there, which is how this runs either way.
const XLSX_PATH = join(process.cwd(), "After_Atlas_July26 2026_Claude updated.xlsx");
const EVENT_TYPE_ID = "death";
const JURISDICTION_ID = "wa";
/** Kept in sync with src/lib/jurisdiction.ts's GENERAL_JURISDICTION_ID. */
const GENERAL_JURISDICTION_ID = "general";
const MODE = "post_event" as const;
/** uid range covering the will/intestate-succession/personal-representative intro sequence (§6 "Flow structure ahead of category selection"). */
const WA_JURISDICTION_UID_RANGE: [number, number] = [5, 40];

/**
 * Higher-level groupings offered at the topic-selection question (uid 41),
 * so the picker is a handful of choices instead of the full flat list of
 * 13 categories. Any category not listed in any bucket here (currently
 * just "Getting Started", the mandatory intro) is never filtered by
 * selection — see `advanceSurvey`'s category-skip logic.
 */
const TOPIC_BUCKETS: { name: string; description: string; order: number; categories: string[] }[] = [
  {
    name: "Legal & Estate",
    description:
      "Wills, guardianship for any minor children, and the paperwork needed to open probate.",
    order: 0,
    categories: ["Guardianship", "Last wishes", "Filing Paperwork"],
  },
  {
    name: "Money & Property",
    description:
      "Bank accounts, bills, the house and other belongings, a business, and benefits like life insurance or Social Security.",
    order: 1,
    categories: ["Finances", "Expenses", "Possessions", "Business", "Post-Death Benefits"],
  },
  {
    name: "People & Notifications",
    description:
      "Letting family and friends know, notifying an employer, and handling email, social media, and other online accounts.",
    order: 2,
    categories: ["Notifying Loved Ones", "Employment", "Digital Assets"],
  },
  {
    name: "Wrapping Up & You",
    description:
      "Odds and ends like subscriptions and IDs to cancel, plus support for taking care of yourself through this.",
    order: 3,
    categories: ["Loose Ends", "Self Care"],
  },
];

/**
 * Minimal link corrections needed for full reachability, found by
 * simulating traversal from uid 5 and checking for orphaned rows (see
 * change history in §6 — several categories/items were added to the
 * bank but never spliced into the existing chain). Each entry
 * reconnects exactly one gap at its most natural point; every other
 * authored link is imported untouched.
 *
 * Some of these (171: 42 especially) exist only because the spreadsheet's
 * own hand-authored tour visits categories in a specific, non-uid order
 * (Filing Paperwork, Notifying Loved Ones, Possessions, Expenses,
 * Finances, Business, Loose Ends, Last wishes, Post-Death Benefits,
 * Guardianship, Employment, Digital Assets, Self Care) — without this
 * fix, Guardianship's block (low uids) would never be reached by that
 * tour at all. That tour no longer decides visit *order* once a
 * topic-selection choice is made — `advanceSurvey`
 * (src/lib/survey-engine.ts) instead follows the bucket picker's own
 * order (TopicBucket.order + categories) at every category boundary — but
 * these splices still matter for guaranteeing each category's internal
 * chain has *some* forward path to hand off from.
 */
const ALWAYS_JUMP_TO_FIXES: Record<number, number> = {
  87: 88, // Loose Ends: splice the passport/storage/firearms/HOA additions in before returning to Last Wishes
  114: 115, // Finances: splice the "unclaimed property" addition in before continuing to the tax wrap-up
  171: 42, // Post-Death Benefits: splice Guardianship -> Employment -> Digital Assets in before Self Care
  149: 151, // Possessions (DIY estate sale): splice the memberships/dues addition in before returning to Expenses
  150: 151, // Possessions (hire a company): same
};
const ANSWER_OPTION_TARGET_FIXES: Record<string, number> = {
  "170:No": 42, // Post-Death Benefits' other exit into the same splice point as above
  "147:No": 151, // Possessions "not enough for an estate sale": same splice as 149/150
  "5:Yes": 40.1, // Route the "had a valid will" path to its own executor/What's-Next variant — see PERSONAL_REP_WILL_VARIANT_ROWS
  // uid 180's "No" (doesn't want a grief counselor) points backward to
  // uid 165 (Post-Death Benefits) — a stale pointer left over from before
  // later categories were appended after Self Care. Redirected to uid 181
  // instead so it doesn't re-enter an already-finished Post-Death Benefits
  // and cycle indefinitely under TopicBucket-order traversal — but 181 is
  // the "Grief Counsellors" recommendation screen (the same one "Yes"
  // leads to), so this alone made both answers show the same
  // recommendations. SKIP_QUESTION_IDS_FIXES below skips 181 for this
  // specific branch so "No" still avoids the uid-165 cycle without
  // actually showing it.
  "180:No": 181,
};

/**
 * Per-branch skip lists — Question ids to exclude when walking forward
 * from that specific answer, layered on top of ANSWER_OPTION_TARGET_FIXES
 * (see "180:No" above). Keyed the same way: "uid:label".
 */
const SKIP_QUESTION_IDS_FIXES: Record<string, number[]> = {
  "180:No": [181],
  // uid 5's "No" (no valid will) still rejoined the common death-certificate
  // sequence at uid 72-73 same as "Yes", so uid 74 ("Do you have possession
  // of the will?") and its uid 75 "Filing the Will" follow-up got asked
  // even after the user said no will existed — and both of uid 74's answers
  // trigger the "Filing the Will" checklist item regardless, so it isn't
  // just the wording that's wrong, the item shouldn't be added at all here.
  "5:No": [74, 75],
};

/**
 * uid 5 ("Did the decedent have a valid will?") Yes and No both originally
 * converged on the same uid 38/39/40 (executor question -> Personal Rep
 * info -> "What's Next" bridge screen) — so every user saw "You now have a
 * picture of how Washington law would handle this estate" even if they
 * never saw any intestate-succession content, because a will existed and
 * uid 5's "No" chain (which walks that succession content) was never
 * taken. These three synthetic rows are a same-uid clone of that
 * sub-graph for the "yes, a valid will exists" path, with uid 40.3's copy
 * rewritten to actually match that path, so uid 5's "No" branch (through
 * the intestate-succession chain) keeps reaching the original uid 38/39/40
 * unchanged. uid 40.2 deliberately reuses uid 39's own
 * info_checklist_item — the same content is correct on both paths, and
 * ChecklistItemTrigger already supports one item having several trigger
 * rows (see resolveTriggeredItems in survey-engine.ts).
 */
const PERSONAL_REP_WILL_VARIANT_ROWS: Row[] = [
  {
    uid: 40.1,
    topic: "",
    type: "bool",
    vendors_suggestion: "",
    name: "Are you the named personal representative or executor of the estate in the decedent's will?",
    answer_options: "Yes,40.3,null;No,40.2,null;",
    info_checklist_item: "",
    always_jump_to: "",
    description: "",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
  {
    uid: 40.2,
    topic: "",
    type: "info",
    vendors_suggestion: "",
    name: "Personal Representative Info",
    answer_options: "",
    info_checklist_item: "wa_Personal-Representative",
    always_jump_to: 40.3,
    description:
      "In most cases the Personal Representative of the estate will be the one that files all paperwork and gathers the decedent's assets, gives notice to creditors, pays decedent's debts, and distributes decedent's assets. Be sure to coordinate your assistance with the Personal Representative.",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
  {
    uid: 40.3,
    topic: "",
    type: "info",
    vendors_suggestion: "",
    name: "What's Next",
    answer_options: "",
    info_checklist_item: "",
    always_jump_to: 41,
    description:
      "This checklist will walk you through several categories relevant to settling the estate. At the end, you'll have a personalized list of what to handle next, based on your specific situation.",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
];
/** uid 5-40's "no valid will" walk through this content is WA-specific — so is this clone of it. */
const PERSONAL_REP_WILL_VARIANT_UIDS = new Set(
  PERSONAL_REP_WILL_VARIANT_ROWS.map((row) => row.uid),
);

/**
 * The general-jurisdiction (non-WA) counterpart of the uid 5-40 +
 * 40.1-40.3 subgraph. Unlike the small text-only overrides below, this is
 * a genuine structural fork, not a reworded copy of the same questions:
 * Washington's intestate-succession rules (who inherits what, absent a
 * valid will) are specific to WA law and don't generalize to "every
 * state, minus the WA wording" — inheritance shares and even the order of
 * relatives differ significantly state to state. Rather than fabricate
 * 50-state-accurate content, this collapses that entire ~30-row decision
 * tree into one explanatory screen recommending a local probate attorney
 * or the user's own state courts, then rejoins the same
 * executor/"What's Next" shape as the WA path (39.9/40.9 reuse 40.2/40.3's
 * own copy verbatim — already jurisdiction-neutral, no WA mention at all).
 * Selected as the actual first question at survey creation time based on
 * the entered zip (see createSurveyResponse) — never reached by branching
 * from the WA-tagged rows, and vice versa.
 */
const GENERAL_INTESTATE_VARIANT_ROWS: Row[] = [
  {
    uid: 5.9,
    topic: "",
    type: "bool",
    vendors_suggestion: "",
    name: "Did the decedent have a valid will?",
    answer_options: "Yes,38.9,null;No,37.9,null;",
    info_checklist_item: "",
    always_jump_to: "",
    description: "",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
  {
    uid: 37.9,
    topic: "",
    type: "info",
    vendors_suggestion: "",
    name: "Intestate Succession",
    answer_options: "",
    info_checklist_item: "general_intestate-succession",
    always_jump_to: 38.9,
    description:
      "Every state has its own laws (called intestate succession) for how an estate is divided when someone dies without a valid will. Since these rules — including who inherits and in what shares — vary significantly by state, we recommend consulting a probate attorney in your state, or your local court's self-help resources, to understand how this applies to your situation.",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
  {
    uid: 38.9,
    topic: "",
    type: "bool",
    vendors_suggestion: "",
    name: "Are you the named personal representative or executor of the estate?",
    answer_options: "Yes,40.9,null;No,39.9,null;Unknown,39.9,null;",
    info_checklist_item: "",
    always_jump_to: "",
    description:
      "Even without a will, a court still appoints someone (often called a personal representative or administrator) to administer the estate. If that hasn't happened yet, or you're not sure, choose Unknown.",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
  {
    uid: 39.9,
    topic: "",
    type: "info",
    vendors_suggestion: "",
    name: "Personal Representative Info",
    answer_options: "",
    // Reuses uid 40.2's own item — the content is already jurisdiction-neutral (no WA mention), so no separate item is needed.
    info_checklist_item: "wa_Personal-Representative",
    always_jump_to: 40.9,
    description:
      "In most cases the Personal Representative of the estate will be the one that files all paperwork and gathers the decedent's assets, gives notice to creditors, pays decedent's debts, and distributes decedent's assets. Be sure to coordinate your assistance with the Personal Representative.",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
  {
    uid: 40.9,
    topic: "",
    type: "info",
    vendors_suggestion: "",
    name: "What's Next",
    answer_options: "",
    info_checklist_item: "",
    always_jump_to: 41,
    description:
      "This checklist will walk you through several categories relevant to settling the estate. At the end, you'll have a personalized list of what to handle next, based on your specific situation.",
    skip_if_already_shown: "",
    multiselect_group: "",
  },
];
const GENERAL_INTESTATE_VARIANT_UIDS = new Set(
  GENERAL_INTESTATE_VARIANT_ROWS.map((row) => row.uid),
);

/**
 * The no-will path's own "What's Next" (uid 40) previously read as if
 * everyone had just walked through Washington's intestate-succession
 * rules — true for that path, but uid 5's "Yes" (valid will exists) also
 * converged here despite never seeing any of that content. Now that Yes
 * has its own uid 40.3 (see PERSONAL_REP_WILL_VARIANT_ROWS), this only
 * needs to read correctly for the no-will path itself.
 */
const DESCRIPTION_OVERRIDES: Record<number, string> = {
  40: "You now have a picture of how Washington law would handle this estate. From here, this checklist will walk you through everything else that needs to happen — starting with the most time-sensitive matters first. At the end, you'll have a personalized list of what to handle next, based on your specific situation.",
  38: "Even without a will, courts still appoint someone (called a personal representative) to administer the estate. If that hasn't happened yet, or you're not sure, choose Unknown.",
  // Originally just "for King County" — unclear that's a Washington
  // State county specifically, not a generic placeholder example. The link
  // itself was also a direct media-file URL, which King County has since
  // restructured away from (confirmed 404 by a user) — swapped for their
  // current "Cancel a voter registration" landing page, a stable page
  // rather than a link into their file storage that breaks on redesigns.
  80: "This needs to be handled by county, but [here](https://kingcounty.gov/en/dept/elections/how-to-vote/register-to-vote/cancel-voter-registration) is an example of what's required for King County, Washington State — check with your own county for its specific form.",
  // Source spreadsheet had "(Facebook Group)" appended twice after The
  // Dougy Center's link.
  179: "Here are some websites that have good resources for dealing with grief: \n\n- [Center for Loss](https://www.centerforloss.com/)\n- [Hope for Bereaved](https://hopeforbereaved.com/)\n- [The Dougy Center](https://www.facebook.com/thedougycenter/) (Facebook Group)",
};

/**
 * uid 38's raw prompt ("...in the decedent's will?") only made sense back
 * when it was shared by both the will-exists and no-will paths — now that
 * uid 5's "Yes" has its own uid 40.1 (see PERSONAL_REP_WILL_VARIANT_ROWS),
 * uid 38 is reached exclusively via the no-will chain, where there's no
 * will to have named anyone in.
 */
const PROMPT_OVERRIDES: Record<number, string> = {
  38: "Are you the named personal representative or executor of the estate?",
};

/**
 * uid 38's raw answer_options ("Yes,40,null;No,39,null;") predates this
 * screen having its own description explaining that a court still
 * appoints someone even without a will — adds the "Unknown" escape hatch
 * that description now offers, routing to the same Personal
 * Representative info as "No" (uid 39) rather than a new destination.
 */
const ANSWER_OPTIONS_OVERRIDES: Record<number, string> = {
  38: "Yes,40,null;No,39,null;Unknown,39,null;",
};

/**
 * Some bool rows ask about a less-common situation (a "check this if
 * you're unsure" item) and already carry a guide link in their own
 * `description` — but, unlike most bool rows, they don't route to a
 * separate "info" row, so nothing ever creates a ChecklistItem for them
 * and the guide link never makes it onto the final checklist. This
 * gives each one a checklist entry (title + the same description/link,
 * reusing authored content rather than writing new copy) and wires it
 * to fire on "Yes" or "Unknown" — either means "tell me more." Checked
 * every bool row in the sheet for this exact shape (a link in its own
 * description, no info_checklist_item); these three groups are the only
 * matches. The mechanism itself (see the PATCH route's
 * `newlyTriggeredItems` diff and <TriggeredItemsSummary>) is generic to
 * any multiselect_group answer that triggers a checklist item, not
 * specific to these rows or categories.
 */
const RARE_TOPIC_CHECKLIST_ITEMS: Record<number, { id: string; title: string }> = {
  // possessions_other
  141: { id: "wa_safety-deposit-box-info", title: "Safety Deposit Box" },
  142: { id: "wa_mineral-rights-info", title: "Mineral Rights" },
  143: { id: "wa_timeshares-info", title: "Timeshares" },
  144: { id: "wa_personal-collections-info", title: "Personal Collections" },
  145: { id: "wa_intellectual-property-info", title: "Intellectual Property" },
  146: { id: "wa_boats-info", title: "Boats" },
  // finances_accounts_insurance
  105: { id: "wa_brokerage-accounts-info", title: "Brokerage Accounts" },
  106: { id: "wa_retirement-plans-info", title: "Retirement Plans" },
  107: { id: "wa_bonds-treasury-notes-info", title: "Bonds & Treasury Notes" },
  108: { id: "wa_annuities-info", title: "Annuities" },
  109: { id: "wa_credit-card-insurance-info", title: "Credit Card Insurance" },
  110: { id: "wa_property-insurance-info", title: "Property Insurance" },
  111: { id: "wa_auto-insurance-info", title: "Auto Insurance" },
  112: { id: "wa_medical-insurance-info", title: "Medical Insurance" },
  // expenses_everyday (new group — see MULTISELECT_GROUP_FIXES)
  117: { id: "wa_credit-cards-info", title: "Credit Cards" },
  118: { id: "wa_recurring-subscriptions-info", title: "Recurring Subscriptions" },
  119: { id: "wa_cell-phone-info", title: "Cell Phone" },
  120: { id: "wa_utilities-info", title: "Utilities" },
};

/**
 * uid 73 is an "info" row (Washington's death-certificate order-form
 * link, shown after answering "No" to uid 72's "Do you have certified
 * copies of the death certificate?") whose own `info_checklist_item`
 * column is blank in the source spreadsheet — unlike every other info row
 * reached this way (e.g. uid 166 "war veteran" -> uid 167), so nothing
 * ever creates a ChecklistItem for it and the link never reaches the
 * final checklist even though it's genuinely useful there. Confirmed via
 * a full pass cross-referencing every info-row link against all
 * ChecklistItem content — this was the only one missing. Assigning the id
 * here (read through `infoChecklistItemFor`/`checklistItemTitleFor`
 * everywhere `info_checklist_item`/`row.name` are otherwise read for this
 * purpose) reuses the exact same checklist-item-creation and
 * trigger-wiring code as every spreadsheet-driven row, rather than
 * duplicating that logic.
 */
const MISSING_INFO_CHECKLIST_ITEMS: Record<number, { id: string; title: string }> = {
  // row.name is "Death Certificate info" — the screen's internal label,
  // not a task title; give the checklist entry proper task-phrased title
  // instead of using it verbatim like the normal spreadsheet-driven path does.
  73: { id: "wa_death-certificate-order-form", title: "Order Copies of the Death Certificate" },
};

function infoChecklistItemFor(row: Row): string {
  return row.info_checklist_item || MISSING_INFO_CHECKLIST_ITEMS[row.uid]?.id || "";
}

function checklistItemTitleFor(row: Row): string {
  return MISSING_INFO_CHECKLIST_ITEMS[row.uid]?.title ?? row.name;
}

/**
 * Bundles several sequential, independent yes/no questions into one
 * "select all that apply" screen instead of forcing a full-page
 * transition per question — for less-common situations only; core or
 * multi-step decision points (e.g. intestate succession, selling a
 * house) keep their own dedicated screens. Unlike the source data's own
 * multiselect_group column (read as-is elsewhere), these groupings don't
 * exist in the spreadsheet, so they're assigned here instead of adding a
 * new column the sheet doesn't have yet.
 *
 * - expenses_everyday: members already resolve to null either way
 *   (nothing to redirect) and need new ChecklistItems
 *   (RARE_TOPIC_CHECKLIST_ITEMS above) since these rows' links never
 *   routed anywhere.
 * - notifying_loved_ones_optional, post_death_benefits_less_common,
 *   possessions_less_common: each member's "Yes" was authored to route
 *   to its own dedicated "info" screen (e.g. uid 166 "war veteran" ->
 *   uid 167, which has the real ChecklistItem content). Once grouped,
 *   that per-member screen would never be shown anyway — the group's
 *   `newlyTriggeredItems` summary surfaces the same ChecklistItem
 *   instead — so those info rows are excluded from Question creation
 *   entirely (see EXCLUDED_QUESTION_UIDS) rather than left as
 *   unreachable dead screens; each Yes branch that would have pointed at
 *   one now redirects to that row's own always_jump_to (handled
 *   generically in resolvedOptionTarget/resolvedAlwaysJumpTo), matching
 *   wherever it would have ended up anyway. Checked every multiselect
 *   candidate for this shape; these three plus expenses_everyday are the
 *   ones that fit, picked from a full pass over every bool question for
 *   this "independent, less-common fact" shape — deliberately excluding
 *   near-universal admin tasks (e.g. Loose Ends' notify-credit-bureaus/
 *   voter-registrar/post-office chain — common, not rare) and
 *   multi-step decision trees (house sale, vehicle titles, estate sale)
 *   that need their own dedicated screens.
 */
const MULTISELECT_GROUP_FIXES: Record<number, string> = {
  117: "expenses_everyday",
  118: "expenses_everyday",
  119: "expenses_everyday",
  120: "expenses_everyday",
  60: "notifying_loved_ones_optional",
  62: "notifying_loved_ones_optional",
  64: "notifying_loved_ones_optional",
  66: "notifying_loved_ones_optional",
  166: "post_death_benefits_less_common",
  168: "post_death_benefits_less_common",
  170: "post_death_benefits_less_common",
  133: "possessions_less_common",
  135: "possessions_less_common",
};

/**
 * Rows that exist in the spreadsheet purely as the "info" screen for one
 * of the MULTISELECT_GROUP_FIXES rows above, and are superseded once
 * that row is grouped (their content surfaces via the group's
 * newlyTriggeredItems summary instead). No Question is created for
 * these — see the "Questions + answer options" loop — but their
 * ChecklistItem still is (that loop reads straight from the parsed rows,
 * not from created Questions), and any branch that would have targeted
 * one is redirected to its own always_jump_to instead (resolvedOptionTarget/
 * resolvedAlwaysJumpTo), landing wherever it would have ended up anyway.
 */
const EXCLUDED_QUESTION_UIDS = new Set([61, 63, 65, 67, 134, 136, 167, 169, 171]);

/**
 * Text-only jurisdiction swaps: these rows are asked of every user
 * regardless of jurisdiction (same question, same branches — unlike the
 * intestate-succession fork above, there's no structural difference), but
 * their wording names a specific WA agency, deadline, or link. Checked
 * every row flagged by grepping the source spreadsheet for
 * "washington"/".wa.gov"/"RCW" outside the intestate-succession range;
 * these are the ones where the match was a real state-specific claim (not
 * e.g. a company whose name happens to contain "washington").
 */
const QUESTION_GENERAL_OVERRIDES: Record<number, { prompt?: string; description?: string }> = {
  // uid 70's own description cited a "$100K probate assets" threshold —
  // Washington's specific small-estate cutoff, not a literal "Washington"
  // mention, so it wasn't caught by that initial keyword-based sweep.
  // Rather than assert a different number that may itself be wrong for
  // the user's state, this points to researching the trigger generally.
  70: {
    description:
      "Probate is the court process for validating a will (if there is one) and formally authorizing someone — often called an executor, personal representative, or administrator — to take control of and distribute the estate. Whether probate is required here, and whether a simplified process is available (for example, for smaller estates, or property that was jointly owned or has a named beneficiary), depends on your state's laws. Check your state's probate court or a local probate attorney to find out what applies to this estate.",
  },
  73: {
    description:
      "You'll need certified copies of the death certificate. These are typically ordered through your state's vital records office, or the funeral home handling arrangements can often help order them.",
  },
  75: {
    description:
      "If you're named as the executor/personal representative, most states require filing the will with the local probate court within a set window after death. Check with your county probate court (or a local probate attorney) for the specific deadline and required forms where you are.",
  },
  85: {
    prompt:
      "Was the decedent receiving government assistance benefits (for example, Medicaid) that a state agency may need to be notified about?",
  },
  86: {
    prompt:
      "Have you notified the relevant state agency about the assistance benefits they were receiving?",
  },
  87: {
    description:
      "Many states have an estate recovery program that recoups certain Medicaid/public-assistance costs from an estate. Contact your state's health or social services agency (often called an Office of Financial Recovery, Estate Recovery Unit, or similar) to notify them and ask what, if anything, is owed.",
  },
  94: {
    description:
      "Firearms have specific legal transfer requirements. [Here](https://sporting-systems.com/blog/inheriting-a-gun-what-happens-to-firearms-when-an-owner-dies/) is a guide — requirements (including background checks in many cases) vary significantly by state, so check your state's specific rules for transferring firearms, even within families.",
  },
  115: {
    description:
      "It's common for people to have forgotten money or property waiting to be claimed (old refunds, uncashed checks, safe deposit box contents, etc.). [missingmoney.com](https://missingmoney.com) is a free multi-state unclaimed property search endorsed by state treasurers, or check your state's treasury website directly.",
  },
  156: {
    prompt:
      "Have you checked whether your state's tax agency needs to be notified (for example, for a state estate tax)?",
  },
  157: {
    description:
      "Some states levy their own estate tax separate from the federal estate tax, often with a lower exemption threshold. Check with your state's department of revenue or a local tax professional to see if this applies and what, if anything, is owed.",
  },
  80: {
    description:
      "Canceling voter registration is typically handled at the county (or equivalent local) level, and the process varies by state. Check your county or state elections office's website for the specific form or process.",
  },
};

/**
 * Same idea as QUESTION_GENERAL_OVERRIDES, for the ChecklistItems those
 * rows produce — keyed by info_checklist_item id rather than uid.
 * relatedLinks given directly (not extracted from markdown) since these
 * are hand-authored, not sourced from the spreadsheet's own description.
 */
const CHECKLIST_ITEM_GENERAL_OVERRIDES: Record<
  string,
  { description: string; relatedLinks?: string[] }
> = {
  "wa_Filing-Will": {
    description:
      "If you're named as the executor/personal representative, most states require filing the will with the local probate court within a set window after death. Check with your county probate court (or a local probate attorney) for the specific deadline and required forms where you are.",
  },
  "wa_office-financial-recovery": {
    description:
      "Many states have an estate recovery program that recoups certain Medicaid/public-assistance costs from an estate. Contact your state's health or social services agency to notify them and ask what, if anything, is owed.",
  },
  wa_firearms: {
    description:
      "Firearms have specific legal transfer requirements that vary significantly by state, including background checks in many cases, even within families. Check your state's specific rules before transferring any firearms.",
    relatedLinks: [
      "https://sporting-systems.com/blog/inheriting-a-gun-what-happens-to-firearms-when-an-owner-dies/",
    ],
  },
  "wa_unclaimed-property": {
    description:
      "It's common for people to have forgotten money or property waiting to be claimed (old refunds, uncashed checks, safe deposit box contents, etc.).",
    relatedLinks: ["https://missingmoney.com"],
  },
  "wa_dept-of-revenue": {
    description:
      "Some states levy their own estate tax separate from the federal estate tax, often with a lower exemption threshold. Check with your state's department of revenue or a local tax professional to see if this applies.",
  },
  "wa_criminal-act": {
    description:
      "If the death was the result of a crime, many states offer a crime victims' compensation program that may help cover related expenses. Check with your state's attorney general or victim services office.",
  },
  "wa_job-related": {
    description:
      "If the death was work-related, workers' compensation death benefits may be available. Check with your state's workers' compensation agency or the employer's insurer.",
  },
  "wa_voters-registrar": {
    description:
      "Canceling voter registration is typically handled at the county (or equivalent local) level, and the process varies by state. Check your county or state elections office's website for the specific form or process.",
  },
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type RowType = "bool" | "select" | "info" | "topic_selection";

type Row = {
  uid: number;
  topic: string;
  type: RowType;
  vendors_suggestion: string;
  name: string;
  answer_options: string;
  info_checklist_item: string;
  always_jump_to: number | "";
  description: string;
  skip_if_already_shown: string;
  multiselect_group: string;
};

function readRows(): Row[] {
  // XLSX.read(buffer) rather than XLSX.readFile(path) — the latter's own
  // internal file-access path breaks once this module is bundled through
  // Next.js's route-handler pipeline (as used by the former one-time
  // /api/admin/run-seed route), even though the file itself is perfectly
  // readable and plain node:fs
  // works fine there. Reading the bytes ourselves first sidesteps whatever
  // SheetJS's own reader does differently.
  const workbook = XLSX.read(readFileSync(XLSX_PATH), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
}

function questionId(uid: number): string {
  return `wa-${uid}`;
}

function categoryFromTopic(topic: string): string {
  if (!topic) return "Getting Started";
  return topic.replace(/^\d+\s*/, "").trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ParsedOption = { label: string; next: string };

function parseAnswerOptions(raw: string): ParsedOption[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [labelRaw, nextRaw] = entry.split(",");
      return { label: (labelRaw ?? "").trim(), next: (nextRaw ?? "").trim() };
    });
}

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Extracts `[label](url)` links from text, returning the urls (deduped —
 * some descriptions repeat the same link for two scenarios, e.g. Filing
 * the Will's executor/non-executor cases both point at the same form)
 * and the text with each link replaced by its bare label.
 */
function extractLinks(text: string): { cleaned: string; links: string[] } {
  const links: string[] = [];
  const cleaned = text.replace(LINK_PATTERN, (_match, label, url) => {
    links.push(url);
    return label;
  });
  return { cleaned, links: [...new Set(links)] };
}

export async function seedXlsx() {
  const rows = [
    ...readRows(),
    ...PERSONAL_REP_WILL_VARIANT_ROWS,
    ...GENERAL_INTESTATE_VARIANT_ROWS,
  ];
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  const allUids = rows.map((r) => r.uid).sort((a, b) => a - b);

  /** "wa" for the dedicated-content subgraph, "general" for its collapsed counterpart, null (universal) for everything else. */
  function jurisdictionIdFor(uid: number): string | null {
    // Checked first: GENERAL_INTESTATE_VARIANT_ROWS' uids (5.9, 37.9, 38.9,
    // 39.9) fall numerically inside WA_JURISDICTION_UID_RANGE ([5, 40]) —
    // that range check alone can't tell "wa-37" from "wa-37.9".
    if (GENERAL_INTESTATE_VARIANT_UIDS.has(uid)) {
      return GENERAL_JURISDICTION_ID;
    }
    if (
      (uid >= WA_JURISDICTION_UID_RANGE[0] && uid <= WA_JURISDICTION_UID_RANGE[1]) ||
      PERSONAL_REP_WILL_VARIANT_UIDS.has(uid)
    ) {
      return JURISDICTION_ID;
    }
    return null;
  }

  /**
   * A target landing on an EXCLUDED_QUESTION_UIDS row (no Question ever
   * created for it — see MULTISELECT_GROUP_FIXES) is redirected to that
   * row's own always_jump_to instead — the real destination it would
   * have led to anyway, since that row was never anything but a
   * single-answer pass-through. Recurses into resolvedAlwaysJumpTo
   * itself (rather than reading `always_jump_to` off the raw row) so an
   * excluded row that's *also* an ALWAYS_JUMP_TO_FIXES key — uid 171 is
   * both: excluded as Job-Related's info screen, and the fix that
   * splices Guardianship in after Post-Death Benefits — resolves through
   * the fix, not the raw spreadsheet value the fix exists to override.
   */
  function skipExcluded(uid: number | null): number | null {
    if (uid === null || !EXCLUDED_QUESTION_UIDS.has(uid)) return uid;
    const excludedRow = byUid.get(uid);
    return excludedRow ? resolvedAlwaysJumpTo(excludedRow) : null;
  }

  function resolvedAlwaysJumpTo(row: Row): number | null {
    if (ALWAYS_JUMP_TO_FIXES[row.uid] !== undefined) {
      return skipExcluded(ALWAYS_JUMP_TO_FIXES[row.uid]);
    }
    return skipExcluded(row.always_jump_to === "" ? null : Number(row.always_jump_to));
  }

  function resolvedOptionTarget(row: Row, option: ParsedOption): number | null {
    const fixKey = `${row.uid}:${option.label}`;
    if (ANSWER_OPTION_TARGET_FIXES[fixKey] !== undefined) {
      return skipExcluded(ANSWER_OPTION_TARGET_FIXES[fixKey]);
    }
    if (option.next && option.next !== "null") {
      return skipExcluded(Number(option.next));
    }
    // Per §6: a "null" per-answer target falls back to this row's own
    // always_jump_to. If that's also unset, leave it unresolved — the
    // generic engine's next-in-order fallback (src/lib/survey-engine.ts)
    // takes over at runtime, exactly as it does for hand-authored content.
    return resolvedAlwaysJumpTo(row);
  }

  console.log(`Loaded ${rows.length} rows (uid ${allUids[0]}-${allUids[allUids.length - 1]})`);

  await prisma.eventType.upsert({
    where: { id: EVENT_TYPE_ID },
    create: {
      id: EVENT_TYPE_ID,
      name: "Loss of a Loved One",
      description:
        "Guidance for what to do after someone dies, and for making sure your own affairs are in order beforehand.",
      active: true,
    },
    update: {},
  });

  await prisma.jurisdiction.upsert({
    where: { id: JURISDICTION_ID },
    create: { id: JURISDICTION_ID, name: "Washington" },
    update: { name: "Washington" },
  });
  await prisma.jurisdiction.upsert({
    where: { id: "general" },
    create: { id: "general", name: "Other / General" },
    update: {},
  });

  // --- Topic buckets (topic-selection question's picker) -----------------
  const topicBucketIds = new Set(
    TOPIC_BUCKETS.map((bucket) => `${EVENT_TYPE_ID}-bucket-${slugify(bucket.name)}`),
  );
  await prisma.topicBucket.deleteMany({
    where: { eventTypeId: EVENT_TYPE_ID, mode: MODE, id: { notIn: [...topicBucketIds] } },
  });
  for (const bucket of TOPIC_BUCKETS) {
    const id = `${EVENT_TYPE_ID}-bucket-${slugify(bucket.name)}`;
    await prisma.topicBucket.upsert({
      where: { id },
      create: {
        id,
        eventTypeId: EVENT_TYPE_ID,
        mode: MODE,
        name: bucket.name,
        description: bucket.description,
        order: bucket.order,
        categories: bucket.categories,
      },
      update: {
        name: bucket.name,
        description: bucket.description,
        order: bucket.order,
        categories: bucket.categories,
      },
    });
  }
  console.log(`Seeded ${TOPIC_BUCKETS.length} topic buckets`);

  // --- Vendor categories -----------------------------------------------
  // Explicit singular forms for "Need a ...?" copy — name.toLowerCase()
  // alone reads as "Need a probate lawyers?" (grammatically wrong, not
  // just informal), and simple trailing-s stripping is too fragile to
  // trust for names this hardcodes control over instead.
  const VENDOR_CATEGORY_SINGULAR_NAMES: Record<string, string> = {
    "Burial plot providers": "burial plot provider",
    "Crematorium Providers": "crematorium provider",
    "Funeral homes": "funeral home",
    "Probate lawyers": "probate lawyer",
    Realtors: "realtor",
    "Estate sale providers": "estate sale provider",
    "Grief counsellors": "grief counsellor",
  };
  /**
   * What's actually sent to Yelp's search API — tuned by hand to match
   * how Yelp categorizes these businesses (see Yelp's category list at
   * https://docs.developer.yelp.com/docs/resources-categories), since
   * that isn't always the wording that reads best on the page. Sending
   * the plain display name for "Estate sale providers" returned
   * electricians and house cleaners; "estate liquidation" (Yelp's own
   * category name for this) doesn't. Falls back to the display name
   * (lowercased) for any category not listed here.
   */
  const VENDOR_CATEGORY_YELP_TERMS: Record<string, string> = {
    "Burial plot providers": "cemetery",
    "Crematorium Providers": "crematorium",
    "Funeral homes": "funeral home",
    "Probate lawyers": "probate attorney",
    Realtors: "real estate agent",
    "Estate sale providers": "estate liquidation",
    "Grief counsellors": "grief counseling",
  };

  const vendorCategoriesByNumber = new Map<string, { slug: string; name: string }>();
  for (const row of rows) {
    if (!row.vendors_suggestion) continue;
    const [num, ...nameParts] = row.vendors_suggestion.split(" ");
    const name = nameParts.join(" ").trim();
    if (!vendorCategoriesByNumber.has(num)) {
      vendorCategoriesByNumber.set(num, { slug: slugify(name), name });
    }
  }
  for (const category of vendorCategoriesByNumber.values()) {
    const singularName =
      VENDOR_CATEGORY_SINGULAR_NAMES[category.name] ?? category.name.toLowerCase();
    const yelpSearchTerm =
      VENDOR_CATEGORY_YELP_TERMS[category.name] ?? category.name.toLowerCase();
    await prisma.vendorCategory.upsert({
      where: { slug: category.slug },
      create: {
        id: category.slug,
        slug: category.slug,
        name: category.name,
        singularName,
        yelpSearchTerm,
      },
      update: { name: category.name, singularName, yelpSearchTerm },
    });
  }
  console.log(`Seeded ${vendorCategoriesByNumber.size} vendor categories`);

  function vendorCategoryIdFor(row: Row): string | null {
    if (!row.vendors_suggestion) return null;
    const [num] = row.vendors_suggestion.split(" ");
    return vendorCategoriesByNumber.get(num)?.slug ?? null;
  }

  // --- Delete stale rows: content no longer present in this import ------
  // Seeding is otherwise purely additive (upsert), so rows removed from a
  // prior version of the spreadsheet — or the old illustrative sample data
  // this import replaced — would otherwise linger in the database forever
  // (e.g. a stray "Home & Property" category from data this import no
  // longer produces).
  const checklistItemSlugs = new Set([
    ...rows.map((r) => infoChecklistItemFor(r)).filter(Boolean),
    ...Object.values(RARE_TOPIC_CHECKLIST_ITEMS).map((item) => item.id),
  ]);
  const expectedQuestionIds = new Set(
    rows.filter((r) => !EXCLUDED_QUESTION_UIDS.has(r.uid)).map((r) => questionId(r.uid)),
  );

  const staleChecklistItemIds = (
    await prisma.checklistItem.findMany({
      where: { eventTypeId: EVENT_TYPE_ID, id: { notIn: [...checklistItemSlugs] } },
      select: { id: true },
    })
  ).map((c) => c.id);
  const staleQuestionIds = (
    await prisma.question.findMany({
      where: { eventTypeId: EVENT_TYPE_ID, mode: MODE, id: { notIn: [...expectedQuestionIds] } },
      select: { id: true },
    })
  ).map((q) => q.id);

  // Null out references that would otherwise block deletion (both FKs are
  // Restrict, not Cascade — safe to clear since every surviving row on
  // both sides gets its real value re-upserted below regardless).
  if (staleChecklistItemIds.length > 0) {
    await prisma.question.updateMany({
      where: { skipIfChecklistItemShownId: { in: staleChecklistItemIds } },
      data: { skipIfChecklistItemShownId: null },
    });
  }
  if (staleQuestionIds.length > 0) {
    await prisma.questionBranch.updateMany({
      where: { nextQuestionId: { in: staleQuestionIds } },
      data: { nextQuestionId: null },
    });
  }

  if (staleQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: staleQuestionIds } } });
    console.log(`Deleted ${staleQuestionIds.length} stale questions`);
  }
  if (staleChecklistItemIds.length > 0) {
    await prisma.checklistItem.deleteMany({ where: { id: { in: staleChecklistItemIds } } });
    console.log(`Deleted ${staleChecklistItemIds.length} stale checklist items`);
  }

  // --- Checklist items (created before Questions so skipIfChecklistItemShownId can reference them) ---
  for (const row of rows) {
    const checklistItemId = infoChecklistItemFor(row);
    if (!checklistItemId) continue;
    // DESCRIPTION_OVERRIDES applies here too — the row's own description
    // feeds both the Question shown mid-survey and the ChecklistItem
    // shown on the final checklist; they'd otherwise silently diverge.
    const { cleaned, links } = extractLinks(
      DESCRIPTION_OVERRIDES[row.uid] ?? (row.description || ""),
    );
    const generalOverride = CHECKLIST_ITEM_GENERAL_OVERRIDES[checklistItemId];
    await prisma.checklistItem.upsert({
      where: { id: checklistItemId },
      create: {
        id: checklistItemId,
        eventTypeId: EVENT_TYPE_ID,
        title: checklistItemTitleFor(row),
        description: cleaned,
        category: categoryFromTopic(row.topic),
        relatedLinks: links,
        generalDescription: generalOverride?.description ?? null,
        generalRelatedLinks: generalOverride?.relatedLinks ?? [],
        vendorCategoryId: vendorCategoryIdFor(row),
      },
      update: {
        title: checklistItemTitleFor(row),
        description: cleaned,
        category: categoryFromTopic(row.topic),
        relatedLinks: links,
        generalDescription: generalOverride?.description ?? null,
        generalRelatedLinks: generalOverride?.relatedLinks ?? [],
        vendorCategoryId: vendorCategoryIdFor(row),
      },
    });
  }
  for (const [uidStr, item] of Object.entries(RARE_TOPIC_CHECKLIST_ITEMS)) {
    const row = byUid.get(Number(uidStr));
    if (!row) continue;
    const { cleaned, links } = extractLinks(row.description || "");
    await prisma.checklistItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        eventTypeId: EVENT_TYPE_ID,
        title: item.title,
        description: cleaned,
        category: categoryFromTopic(row.topic),
        relatedLinks: links,
        vendorCategoryId: null,
      },
      update: {
        title: item.title,
        description: cleaned,
        category: categoryFromTopic(row.topic),
        relatedLinks: links,
        vendorCategoryId: null,
      },
    });
  }
  console.log(`Seeded ${checklistItemSlugs.size} checklist items`);

  // --- Questions + answer options ---------------------------------------
  for (const row of rows) {
    if (EXCLUDED_QUESTION_UIDS.has(row.uid)) continue;
    const hasRealOptions = row.type === "bool" || row.type === "select";
    // Kept as raw text (markdown links intact) — QuestionCard/MultiselectGroupCard
    // render it through <LinkedText>, unlike ChecklistItem's description below,
    // which has links extracted into its own relatedLinks list instead.
    const prompt = PROMPT_OVERRIDES[row.uid] ?? row.name;
    const description = DESCRIPTION_OVERRIDES[row.uid] ?? (row.description || null);
    const multiselectGroup = MULTISELECT_GROUP_FIXES[row.uid] ?? (row.multiselect_group || null);
    const generalOverride = QUESTION_GENERAL_OVERRIDES[row.uid];

    await prisma.question.upsert({
      where: { id: questionId(row.uid) },
      create: {
        id: questionId(row.uid),
        eventTypeId: EVENT_TYPE_ID,
        mode: MODE,
        type: row.type,
        jurisdictionId: jurisdictionIdFor(row.uid),
        prompt,
        description,
        generalPrompt: generalOverride?.prompt ?? null,
        generalDescription: generalOverride?.description ?? null,
        category: categoryFromTopic(row.topic),
        order: row.uid,
        skipIfChecklistItemShownId: row.skip_if_already_shown || null,
        multiselectGroup,
        vendorCategoryId: vendorCategoryIdFor(row),
      },
      update: {
        type: row.type,
        jurisdictionId: jurisdictionIdFor(row.uid),
        prompt,
        description,
        generalPrompt: generalOverride?.prompt ?? null,
        generalDescription: generalOverride?.description ?? null,
        category: categoryFromTopic(row.topic),
        order: row.uid,
        skipIfChecklistItemShownId: row.skip_if_already_shown || null,
        multiselectGroup,
        vendorCategoryId: vendorCategoryIdFor(row),
      },
    });

    if (hasRealOptions) {
      const options = parseAnswerOptions(
        ANSWER_OPTIONS_OVERRIDES[row.uid] ?? row.answer_options,
      );
      for (const [index, option] of options.entries()) {
        await prisma.answerOption.upsert({
          where: { id: `${questionId(row.uid)}-opt-${index}` },
          create: {
            id: `${questionId(row.uid)}-opt-${index}`,
            questionId: questionId(row.uid),
            label: option.label,
            value: option.label,
            order: index,
          },
          update: { label: option.label, value: option.label, order: index },
        });
      }
    } else {
      // info / topic_selection: a single synthetic "Continue" option.
      await prisma.answerOption.upsert({
        where: { id: `${questionId(row.uid)}-opt-0` },
        create: {
          id: `${questionId(row.uid)}-opt-0`,
          questionId: questionId(row.uid),
          label: "Continue",
          value: "continue",
          order: 0,
        },
        update: {},
      });
    }
  }
  console.log(`Seeded ${rows.length - EXCLUDED_QUESTION_UIDS.size} questions`);

  // --- Question branches + checklist item triggers ----------------------
  let branchCount = 0;
  let triggerCount = 0;
  for (const row of rows) {
    if (EXCLUDED_QUESTION_UIDS.has(row.uid)) continue;
    const hasRealOptions = row.type === "bool" || row.type === "select";
    const options = hasRealOptions
      ? parseAnswerOptions(ANSWER_OPTIONS_OVERRIDES[row.uid] ?? row.answer_options)
      : [{ label: "Continue", next: "" }];

    for (const [index, option] of options.entries()) {
      const targetUid = hasRealOptions
        ? resolvedOptionTarget(row, option)
        : resolvedAlwaysJumpTo(row);
      const answerOptionId = `${questionId(row.uid)}-opt-${index}`;
      const nextQuestionId = targetUid !== null ? questionId(targetUid) : null;
      const skipQuestionIds = (SKIP_QUESTION_IDS_FIXES[`${row.uid}:${option.label}`] ?? []).map(
        questionId,
      );

      await prisma.questionBranch.upsert({
        where: {
          questionId_answerOptionId: {
            questionId: questionId(row.uid),
            answerOptionId,
          },
        },
        create: {
          questionId: questionId(row.uid),
          answerOptionId,
          nextQuestionId,
          skipQuestionIds,
        },
        update: { nextQuestionId, skipQuestionIds },
      });
      branchCount++;

      const targetRow = targetUid !== null ? byUid.get(targetUid) : undefined;
      const targetChecklistItemId = targetRow ? infoChecklistItemFor(targetRow) : "";
      if (targetChecklistItemId) {
        await prisma.checklistItemTrigger.upsert({
          where: {
            checklistItemId_questionId_answerOptionId: {
              checklistItemId: targetChecklistItemId,
              questionId: questionId(row.uid),
              answerOptionId,
            },
          },
          create: {
            checklistItemId: targetChecklistItemId,
            questionId: questionId(row.uid),
            answerOptionId,
          },
          update: {},
        });
        triggerCount++;
      }
    }
  }
  console.log(`Seeded ${branchCount} question branches and ${triggerCount} checklist item triggers`);

  // --- Rare-topic checklist triggers --------------------------------------
  // Unlike the general case above, these fire directly off the row's own
  // "Yes"/"Unknown" answer rather than off a separate target row's
  // info_checklist_item — see RARE_TOPIC_CHECKLIST_ITEMS.
  let rareTopicTriggerCount = 0;
  for (const [uidStr, item] of Object.entries(RARE_TOPIC_CHECKLIST_ITEMS)) {
    const row = byUid.get(Number(uidStr));
    if (!row) continue;
    const options = parseAnswerOptions(row.answer_options);
    const tellMeMoreIndexes = options
      .map((option, index) => ({ label: option.label, index }))
      .filter(({ label }) => label === "Yes" || label === "Unknown")
      .map(({ index }) => index);

    for (const index of tellMeMoreIndexes) {
      const answerOptionId = `${questionId(row.uid)}-opt-${index}`;
      await prisma.checklistItemTrigger.upsert({
        where: {
          checklistItemId_questionId_answerOptionId: {
            checklistItemId: item.id,
            questionId: questionId(row.uid),
            answerOptionId,
          },
        },
        create: {
          checklistItemId: item.id,
          questionId: questionId(row.uid),
          answerOptionId,
        },
        update: {},
      });
      rareTopicTriggerCount++;
    }
  }
  console.log(`Seeded ${rareTopicTriggerCount} rare-topic checklist item triggers`);

  // --- Triggers for grouped questions whose info screen was excluded -----
  // For notifying_loved_ones_optional / post_death_benefits_less_common /
  // possessions_less_common, resolvedOptionTarget now skips straight past
  // each member's excluded "Yes" target (see skipExcluded), so the general
  // "target row has info_checklist_item" trigger mechanism above never
  // sees that row anymore. Recover the same trigger directly: whichever
  // excluded row a member's "Yes" was *originally* authored to reach still
  // carries the real info_checklist_item — reuse it here rather than
  // hardcoding the id a second time.
  let excludedTargetTriggerCount = 0;
  for (const uidStr of Object.keys(MULTISELECT_GROUP_FIXES)) {
    const uid = Number(uidStr);
    const row = byUid.get(uid);
    if (!row) continue;
    const options = parseAnswerOptions(row.answer_options);
    const yesIndex = options.findIndex((option) => option.label === "Yes");
    if (yesIndex === -1) continue;
    const rawNext = options[yesIndex].next;
    const originalTargetUid = rawNext && rawNext !== "null" ? Number(rawNext) : null;
    if (originalTargetUid === null || !EXCLUDED_QUESTION_UIDS.has(originalTargetUid)) continue;
    const checklistItemId = byUid.get(originalTargetUid)?.info_checklist_item;
    if (!checklistItemId) continue;

    const answerOptionId = `${questionId(uid)}-opt-${yesIndex}`;
    await prisma.checklistItemTrigger.upsert({
      where: {
        checklistItemId_questionId_answerOptionId: {
          checklistItemId,
          questionId: questionId(uid),
          answerOptionId,
        },
      },
      create: { checklistItemId, questionId: questionId(uid), answerOptionId },
      update: {},
    });
    excludedTargetTriggerCount++;
  }
  console.log(
    `Seeded ${excludedTargetTriggerCount} checklist item triggers for grouped questions whose info screen was excluded`,
  );

  await prisma.$disconnect();
}
