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

const XLSX_PATH = join(
  import.meta.dirname,
  "..",
  "After_Atlas_July26 2026_Claude updated.xlsx",
);
const EVENT_TYPE_ID = "death";
const JURISDICTION_ID = "wa";
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
 * The actual order categories are entered in the authored tour — found by
 * simulating a full traversal from uid 5 and recording each category's
 * first-visit position. This is NOT the same as sorting categories by
 * their own uid range: several (Guardianship, Employment, Digital Assets)
 * only became reachable at all via the `171: 42` splice below, entered
 * from Post-Death Benefits late in the tour despite sitting at low uids.
 * Matches the ALWAYS_JUMP_TO_FIXES comments exactly. Used to compute
 * each Question's `categorySequence`, which `advanceSurvey` uses to jump
 * directly to the next *selected* category when the natural next one
 * wasn't chosen — uid-order fallback can't reach a category whose block
 * sits earlier in uid space than wherever the walk currently is.
 */
const CANONICAL_CATEGORY_ORDER: string[] = [
  "Filing Paperwork",
  "Notifying Loved Ones",
  "Possessions",
  "Expenses",
  "Finances",
  "Business",
  "Loose Ends",
  "Last wishes",
  "Post-Death Benefits",
  "Guardianship",
  "Employment",
  "Digital Assets",
  "Self Care",
];

function categorySequenceFor(category: string): number | null {
  const index = CANONICAL_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? null : index;
}

/**
 * Minimal link corrections needed for full reachability, found by
 * simulating traversal from uid 5 and checking for orphaned rows (see
 * change history in §6 — several categories/items were added to the
 * bank but never spliced into the existing chain). Each entry
 * reconnects exactly one gap at its most natural point; every other
 * authored link is imported untouched.
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
};

/**
 * Some multiselect_group members ask about a less-common situation (a
 * "check this if you're unsure" item) and already carry a guide link in
 * their own `description` — but, unlike most bool rows, they don't route
 * to a separate "info" row, so nothing ever creates a ChecklistItem for
 * them and the guide link never makes it onto the final checklist. This
 * gives each one a checklist entry (title + the same description/link,
 * reusing authored content rather than writing new copy) and wires it to
 * fire on "Yes" or "Unknown" — either means "tell me more." The pilot
 * category is Possessions' `possessions_other` group; the mechanism
 * (see the PATCH route's `newlyTriggeredItems` diff and
 * <TriggeredItemsSummary>) is generic to any multiselect_group answer
 * that triggers a checklist item, not specific to these six rows.
 */
const RARE_TOPIC_CHECKLIST_ITEMS: Record<number, { id: string; title: string }> = {
  141: { id: "wa_safety-deposit-box-info", title: "Safety Deposit Box" },
  142: { id: "wa_mineral-rights-info", title: "Mineral Rights" },
  143: { id: "wa_timeshares-info", title: "Timeshares" },
  144: { id: "wa_personal-collections-info", title: "Personal Collections" },
  145: { id: "wa_intellectual-property-info", title: "Intellectual Property" },
  146: { id: "wa_boats-info", title: "Boats" },
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
  const workbook = XLSX.readFile(XLSX_PATH);
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

/** Extracts `[label](url)` links from text, returning the urls and the text with each link replaced by its bare label. */
function extractLinks(text: string): { cleaned: string; links: string[] } {
  const links: string[] = [];
  const cleaned = text.replace(LINK_PATTERN, (_match, label, url) => {
    links.push(url);
    return label;
  });
  return { cleaned, links };
}

export async function seedXlsx() {
  const rows = readRows();
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  const allUids = rows.map((r) => r.uid).sort((a, b) => a - b);

  function resolvedAlwaysJumpTo(row: Row): number | null {
    if (ALWAYS_JUMP_TO_FIXES[row.uid] !== undefined) {
      return ALWAYS_JUMP_TO_FIXES[row.uid];
    }
    return row.always_jump_to === "" ? null : Number(row.always_jump_to);
  }

  function resolvedOptionTarget(row: Row, option: ParsedOption): number | null {
    const fixKey = `${row.uid}:${option.label}`;
    if (ANSWER_OPTION_TARGET_FIXES[fixKey] !== undefined) {
      return ANSWER_OPTION_TARGET_FIXES[fixKey];
    }
    if (option.next && option.next !== "null") {
      return Number(option.next);
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
    await prisma.vendorCategory.upsert({
      where: { slug: category.slug },
      create: { id: category.slug, slug: category.slug, name: category.name },
      update: { name: category.name },
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
    ...rows.map((r) => r.info_checklist_item).filter(Boolean),
    ...Object.values(RARE_TOPIC_CHECKLIST_ITEMS).map((item) => item.id),
  ]);
  const expectedQuestionIds = new Set(rows.map((r) => questionId(r.uid)));

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
    if (!row.info_checklist_item) continue;
    const { cleaned, links } = extractLinks(row.description || "");
    await prisma.checklistItem.upsert({
      where: { id: row.info_checklist_item },
      create: {
        id: row.info_checklist_item,
        eventTypeId: EVENT_TYPE_ID,
        title: row.name,
        description: cleaned,
        category: categoryFromTopic(row.topic),
        relatedLinks: links,
        vendorCategoryId: vendorCategoryIdFor(row),
      },
      update: {
        title: row.name,
        description: cleaned,
        category: categoryFromTopic(row.topic),
        relatedLinks: links,
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
    const isWaSpecific = row.uid >= WA_JURISDICTION_UID_RANGE[0] && row.uid <= WA_JURISDICTION_UID_RANGE[1];
    const hasRealOptions = row.type === "bool" || row.type === "select";
    // Kept as raw text (markdown links intact) — QuestionCard/MultiselectGroupCard
    // render it through <LinkedText>, unlike ChecklistItem's description below,
    // which has links extracted into its own relatedLinks list instead.
    const description = row.description || null;

    await prisma.question.upsert({
      where: { id: questionId(row.uid) },
      create: {
        id: questionId(row.uid),
        eventTypeId: EVENT_TYPE_ID,
        mode: MODE,
        type: row.type,
        jurisdictionId: isWaSpecific ? JURISDICTION_ID : null,
        prompt: row.name,
        description,
        category: categoryFromTopic(row.topic),
        order: row.uid,
        categorySequence: categorySequenceFor(categoryFromTopic(row.topic)),
        skipIfChecklistItemShownId: row.skip_if_already_shown || null,
        multiselectGroup: row.multiselect_group || null,
        vendorCategoryId: vendorCategoryIdFor(row),
      },
      update: {
        type: row.type,
        jurisdictionId: isWaSpecific ? JURISDICTION_ID : null,
        prompt: row.name,
        description,
        category: categoryFromTopic(row.topic),
        order: row.uid,
        categorySequence: categorySequenceFor(categoryFromTopic(row.topic)),
        skipIfChecklistItemShownId: row.skip_if_already_shown || null,
        multiselectGroup: row.multiselect_group || null,
        vendorCategoryId: vendorCategoryIdFor(row),
      },
    });

    if (hasRealOptions) {
      const options = parseAnswerOptions(row.answer_options);
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
  console.log(`Seeded ${rows.length} questions`);

  // --- Question branches + checklist item triggers ----------------------
  let branchCount = 0;
  let triggerCount = 0;
  for (const row of rows) {
    const hasRealOptions = row.type === "bool" || row.type === "select";
    const options = hasRealOptions
      ? parseAnswerOptions(row.answer_options)
      : [{ label: "Continue", next: "" }];

    for (const [index, option] of options.entries()) {
      const targetUid = hasRealOptions
        ? resolvedOptionTarget(row, option)
        : resolvedAlwaysJumpTo(row);
      const answerOptionId = `${questionId(row.uid)}-opt-${index}`;
      const nextQuestionId = targetUid !== null ? questionId(targetUid) : null;

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
          skipQuestionIds: [],
        },
        update: { nextQuestionId },
      });
      branchCount++;

      const targetRow = targetUid !== null ? byUid.get(targetUid) : undefined;
      if (targetRow?.info_checklist_item) {
        await prisma.checklistItemTrigger.upsert({
          where: {
            checklistItemId_questionId_answerOptionId: {
              checklistItemId: targetRow.info_checklist_item,
              questionId: questionId(row.uid),
              answerOptionId,
            },
          },
          create: {
            checklistItemId: targetRow.info_checklist_item,
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

  await prisma.$disconnect();
}
