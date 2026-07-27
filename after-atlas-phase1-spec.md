# After Atlas — Phase 1 Build Spec

## Vision (for context, not all built in Phase 1)

After Atlas helps people navigate major life transitions through a
guided, branching survey that produces a personalized action
checklist, plus curated vendor recommendations relevant to that
transition. The first supported life event is **death of a loved
one**. The platform is architected so that other life events —
**divorce**, **layoff/job loss**, and others in the future — can be
added later primarily as *content*, not new engineering, because the
survey/checklist/vendor engine is built generically around an
"event type" concept from day one.

Phase 1 goal: ship a working, useful product for the death checklist
use case, on a generic architecture, with static (non-bidding) vendor
recommendations. Vendor bidding/billing and full admin tooling are
explicitly deferred to later phases (see bottom of doc).

A second use case sits alongside the post-death checklist:
**pre-death planning**. Instead of "what do I need to do now that
someone has died," this mode asks "are we prepared, and what are our
gaps" (no will, no named executor, no life insurance, etc.), matches
gaps to relevant vendors (estate attorneys, insurance agents), and
produces the same underlying "map of accounts/institutions" output,
framed as what a family will need to know later. The schema below is
designed to support both modes from the start. Multi-person
collaboration on a shared plan (inviting a spouse, kids, or an
executor; a documented decision log) is a real feature but is bigger
than content/schema — it needs auth roles, permissions, and invite
flows. It's scoped and reflected in the data model below so it isn't
a retrofit later, but the actual build is deferred to a later phase
(see §3).

---

## 1. Core data model

### `EventType`
Represents a supported life transition (e.g. `death`, `divorce`,
`layoff`). Phase 1 ships with one fully-populated event type
(`death`); the schema supports more without changes.

| Field | Notes |
|---|---|
| id | slug, e.g. `death` |
| name | display name, e.g. "Loss of a Loved One" |
| description | shown on the event-selection landing page |
| active | boolean — lets us add `divorce`/`layoff` rows later without shipping them yet |

### `Jurisdiction`
Represents a state (or the general/fallback bucket) for the portions
of the survey that are legally state-specific — primarily intestate
succession (who inherits what without a will) and a handful of
state-specific links/forms (e.g. WA's death certificate order form,
WA Dept. of Revenue estate tax page).

| Field | Notes |
|---|---|
| id | slug, e.g. `wa`, `general` |
| name | e.g. "Washington", "Other / General" |

Phase 1 ships two rows: `wa` (fully populated from the existing
question bank) and `general` (a simplified, state-agnostic version of
the same section — e.g. "Inheritance without a will is determined by
your state's law; here's how it generally works, and we recommend
consulting a local probate attorney to confirm specifics for your
state" rather than a full branching statutory tree). Most of the
survey (categories 2–11 in the existing bank — First Steps, Notifying
Family, Possessions, Expenses, Finances, Business, Loose Ends, Last
Wishes, Post-Death Benefits, Self Care) is jurisdiction-agnostic and
shared across both; only the intestate-succession section (and a
small number of state-specific links) actually branches on
`jurisdiction_id`.

### `Question`
Belongs to an `EventType`, a `mode`, and — only where relevant —
a `Jurisdiction`.

| Field | Notes |
|---|---|
| id | |
| event_type_id | FK |
| mode | `post_event` (post-death, "what to do now") or `planning` (pre-death, "are we prepared") — same engine, different question sets and outputs |
| jurisdiction_id | nullable FK — null means the question applies to every jurisdiction (the vast majority of questions); set only for the intestate-succession branch and other state-specific content |
| prompt | question text |
| category | grouping used for TurboTax-style section nav (e.g. "Home & Property", "Financial Accounts") |
| answer_options | list of `{ id, label, value }` |
| order / section | for default flow ordering |

### `Gap` (planning mode only)
The `planning`-mode equivalent of `ChecklistItem` — instead of "do
this task," it's "this is missing from your plan." Triggered the same
way as `ChecklistItem` (via an equivalent trigger table keyed on
`planning`-mode questions/answers), and links to a `VendorCategory`
the same way, so gap → vendor recommendation reuses the existing
vendor matching logic.

| Field | Notes |
|---|---|
| id | |
| event_type_id | FK |
| title | e.g. "No will on file" |
| description | why this matters, what to do about it |
| category | matches question categories |
| vendor_category_id | optional FK — e.g. probate/estate lawyer for a missing-will gap |

### `Plan` (schema only in Phase 1 — collaboration UI is a later phase)
Represents a shared household planning effort (e.g. a married
couple). In Phase 1, a `Plan` can simply default to a single owner
with no invite flow built yet; the shape exists so multi-person
collaboration doesn't require a schema migration later.

| Field | Notes |
|---|---|
| id | |
| owner_user_id | FK |
| planning_survey_response_id | FK — links to the `SurveyResponse` for the `planning` mode |

### `PlanMember` (schema only — not built in Phase 1)
Placeholder for future invited participants (spouse, kids, executor)
and their role/permissions on a `Plan`. Not implemented in Phase 1;
included here so the `Plan` table doesn't need reshaping when
collaboration is built.

### `QuestionBranch`
Defines the "next question" logic.

| Field | Notes |
|---|---|
| question_id | FK |
| answer_option_id | FK |
| next_question_id | nullable — null can mean "skip to end of section" |
| skip_question_ids | optional list — questions to exclude entirely based on this answer (e.g. skip all "house" questions if answer is "I don't own a house") |

### `ChecklistItem`
Master library of possible checklist tasks, per event type.

| Field | Notes |
|---|---|
| id | |
| event_type_id | FK |
| title | e.g. "Notify the mortgage lender" |
| description | longer guidance text |
| category | matches question categories, for grouping in the final checklist |
| related_links | URLs surfaced during the survey and again in the final checklist |
| vendor_category_id | optional FK — links this task to a relevant vendor category |

### `ChecklistItemTrigger`
Maps which survey answers cause a `ChecklistItem` to appear.

| Field | Notes |
|---|---|
| checklist_item_id | FK |
| question_id | FK |
| answer_option_id | FK |

### `VendorCategory`
E.g. Realtors, Probate Lawyers, Estate Sale Providers, Funeral Homes,
Burial Plot Providers, Grief Counselors, Family Therapists, Financial
Advisors, Obituary Providers. Admin-editable list (schema supports
this even if the Phase 1 admin UI is minimal — see §5).

### `Vendor`
Phase 1: manually entered by you (no vendor self-signup, no bidding).

| Field | Notes |
|---|---|
| id | |
| name, description, image_url, price_range | |
| vendor_category_id | FK |
| zip_codes / service_area | simple list or radius, TBD based on how precise you want Phase 1 matching to be |
| website_url | |
| review_source_url | optional — Yelp/Google link if you're not pulling review data programmatically yet |
| priority | manual sort order within a category (stand-in for future bidding rank) |

Fallback rule: if no `Vendor` exists for a user's category + location,
show a Yelp search link instead (as in the current site).

### `User`
Standard auth — email/password to start; social login (Google/
Facebook) is a nice-to-have, not a Phase 1 blocker.

### `SurveyResponse`
Tracks a user's in-progress or completed survey.

| Field | Notes |
|---|---|
| user_id | FK |
| event_type_id | FK |
| mode | `post_event` or `planning` |
| answers | question_id → answer_option_id map |
| status | in_progress / completed |
| last_question_id | for resume |
| created_at / updated_at | |

### `Article` (blog)

| Field | Notes |
|---|---|
| slug | used in `/blog/[slug]` |
| title, body, published_at | |
| event_type_id | optional — tag articles to a life event for cross-linking |

---

## 2. Page structure

- `/` — landing page. Phase 1: can lead directly with death, but
  structure it so `/` can later become an event picker without a
  rebuild (e.g. a hero CTA that's easy to swap for a 2–3 option
  chooser).
- `/survey/death` — the post-event branching survey flow ("what to do
  now"). TurboTax-style:
  - Early question: "What state are you in?" with WA fully detailed
    and all other states routed to the `general` jurisdiction content
  - Section-based navigation sidebar/table of contents, jump between
    completed sections
  - Progress saved continuously (not just on exit)
  - Keyword search over question categories is a stretch goal, not a
    Phase 1 blocker
- `/plan/death` — the pre-death planning survey flow ("are we
  prepared"), same UX pattern as `/survey/death`, `mode: planning`.
  Single-user in Phase 1 (no invites yet).
- `/checklist/[response_id]` — generated checklist (post-event mode):
  grouped by category, downloadable (PDF), links included, vendor
  recommendations inline per relevant category
- `/gaps/[response_id]` — generated gap report (planning mode):
  grouped by category, each gap paired with a relevant vendor
  recommendation where one exists
- `/vendors/[category]` — optional standalone browse view of
  recommended vendors, matching what was shown in survey/checklist
- `/blog` and `/blog/[slug]` — article library
- `/login`, `/register`, `/dashboard` — auth + user dashboard (profile,
  survey status/resume, visited vendor list)
- Lightweight CMS-lite: rather than a full admin UI in Phase 1, page
  copy can live in structured content files/DB rows you (or I, via
  Claude Code) edit directly — avoids building an admin CMS UI before
  it's needed.

---

## 3. Explicitly deferred to later phases

**Phase 2 — Vendor marketplace**
- Vendor self-signup + admin approval
- Bid-per-click auction/ranking logic, budgets, daily card billing
- Vendor dashboard + performance metrics
- Fraud-override controls for admin

**Phase 3 — Full admin tooling**
- Survey/question builder UI (non-technical question editing)
- Full CMS for page content
- Payment transaction tracking
- User management dashboard

**Phase 1.5 (after Phase 1 ships and is stable) — New event types**
- Add `divorce` and `layoff` as new `EventType` rows: new questions,
  checklist items, and vendor categories, reusing the same engine

**Also deferred — Household collaboration**
- Invite flow (spouse, kids, executor) onto a shared `Plan`
- Roles/permissions per `PlanMember`
- Decision/conversation log documenting choices made together
  (e.g. named executor, location of documents)
- The `Plan` and `PlanMember` tables are scoped in §1 now so this
  doesn't require a schema migration when it's built

---

## 4. Suggested tech stack

Recommendation, open to adjustment based on your/Claude Code's
preference:

- **Next.js (React)** — good SEO story (SSR/static generation), fits
  the `/blog/[slug]` and clean URL requirements well
- **Postgres** for the relational data above (branching logic, users,
  vendors)
- **Auth**: NextAuth or similar, email/password first, Google/Facebook
  OAuth as an add-on
- **Hosting**: Vercel (pairs naturally with Next.js + GitHub, auto
  deploys on push — sidesteps the AWS access issues entirely for now)
- **PDF generation** for the downloadable checklist: a library like
  `@react-pdf/renderer` or server-side HTML-to-PDF

---

## 5. Notes for whoever (Claude Code) implements this

- Build the survey engine and checklist-trigger logic **generically**
  against `EventType` — never hardcode "death" logic into the
  survey/checklist components themselves. All death-specific content
  lives in the seeded data (questions, branches, checklist items,
  vendor categories), not in code branches.
- Seed data for the `death` event type should be created as a
  structured seed file (JSON or DB seed script) so it's easy to
  extend for `divorce`/`layoff` later, and so you can hand me updated
  question/checklist content to seed without touching app code.
- Build `post_event` and `planning` as a shared `mode` on the same
  survey/question/response components — not two separate codebases.
  The branching engine, resume logic, and section navigation should
  be mode-agnostic; only the seeded content and the output framing
  (checklist vs. gap report) differ.
- Implement the two engine conventions used by the seed data (§6):
  session-level dedup keyed on `skip_if_already_shown` (skip a
  question if the `ChecklistItem` it maps to was already triggered
  earlier in the same session — build this generically, not as a
  one-off for the social-media case it currently covers), and
  `multiselect_group` (render grouped rows as one "select all that
  apply" screen instead of sequential single-question screens).

## 6. Seed data: `After_Atlas_March_26_updated.xlsx`

This spreadsheet is the authoritative seed source for the `death`
event type, `wa` jurisdiction, `post_event` mode content. It has been
fully cleaned and restructured (see change history below) and should
be imported directly rather than re-derived from the original
`After_Atlas_March_26.xlsx`. 177 rows, uid 5–181, single sheet named
`Washington`.

### Column reference (single sheet, one row per question/info node)

| Column | Maps to | Notes |
|---|---|---|
| `uid` | `Question.id` / `ChecklistItem` trigger key | Sequential, contiguous, no gaps |
| `topic` | `Question.category` | Format `"<order#> <Category Name>"`, e.g. `"1 Guardianship"` — the leading number is the intended display/flow order (see Category order below). Blank for the pre-category-selection intestate succession block and the topic-selection screen itself |
| `type` | Determines row handling | `bool` (Yes/No question), `select` (multiple-choice question), `info` (a checklist item, a bridge/transition screen, or a category header — see below), `topic_selection` (the one screen listing all categories) |
| `vendors_suggestion` | `VendorCategory` reference | Format `"<category_number> <Category Name>"` on `info` rows that should show vendor recommendations, e.g. `"2 Probate lawyers"`. Numbers are now sequential 1–7 with no gaps |
| `name` | `Question.prompt` (for bool/select) or `ChecklistItem.title` / screen title (for info) | |
| `answer_options` | `QuestionBranch` | Format `"Label,next_uid,vendor_or_checklist_slug;Label,next_uid,slug;"` — semicolon-separated options, each a comma-separated triple. `next_uid` is `null` for a dead-end leaf answer. The third field is occasionally a slug reference (legacy — cross-check against `info_checklist_item` on the target row rather than relying on it) |
| `info_checklist_item` | `ChecklistItem` slug | Present only on `info` rows that represent an actual checklist item the user should see in their final output (as opposed to a pure narrative/legal-explainer info screen, a bridge screen, or a category header — those have this blank) |
| `always_jump_to` | `QuestionBranch.next_question_id` for `info`/`select`/`topic_selection` rows | The next uid in sequence. Blank only on the single true end-of-survey row (currently the last Self Care item) |
| `description` | `ChecklistItem.description` / question help text | Contains the resource links in the form `[Here](url)`, already cleaned of Word-export artifacts |
| `skip_if_already_shown` | Engine dedup hint | If set (currently only on the Loose Ends social-media question), the engine should skip this question if a `ChecklistItem` with this slug was already shown earlier in the same session — see §5 note below |
| `multiselect_group` | UI grouping hint, not a data relationship | Rows sharing a non-empty value here are inventory-style yes/no questions about unrelated, non-branching items (mineral rights, timeshares, boats, insurance types, digital asset types, etc.) that should render as **one multi-select screen** ("select all that apply") rather than sequential single-question screens. Each row still gets its own `ChecklistItem`/link if answered yes — the grouping is presentational only, not a schema relationship |

### Category order

The `topic` column's leading number is deliberate and reflects
priority/urgency, most pressing first — the UI's default category
order (and the order categories are offered in the `topic_selection`
screen) should follow it directly:

1. Guardianship 2. Last Wishes 3. Notifying Loved Ones
4. Filing Paperwork 5. Loose Ends 6. Employment 7. Finances
8. Expenses 9. Possessions 10. Business 11. Post-Death Benefits
12. Digital Assets 13. Self Care

### Flow structure ahead of category selection

Before the `topic_selection` screen, there's a fixed intro sequence
(uid 5–40) that is **not** one of the 13 categories and always runs
first:
1. "Did the decedent have a valid will?" — gates into either a full
   Washington intestate-succession branching tree (no will) or
   straight through (will exists)
2. Both paths converge on "are you the named personal representative
   / executor?"
3. A short bridge screen ("What's Next") that transitions tone from
   the legal explainer into the actionable checklist
4. The `topic_selection` screen

This entire intro sequence is `wa`-jurisdiction content — see the
`Jurisdiction` section above. When the `general` jurisdiction is
built, it needs an equivalent (much shorter) version of steps 1–2,
per that section's guidance.

### Change history (for context, not action items)

Already fixed in this file, included here so nothing gets re-applied:
broken pets-question link, Word-export artifacts in descriptions, a
row-id gap, vendor-category numbering gaps, the duplicate social-media
question (kept, but tagged with `skip_if_already_shown` so it doesn't
ask twice), added Guardianship/Employment/Digital Assets as new
categories, added several new items to Possessions/Finances/Loose
Ends, reordered all categories by urgency, and fixed a bug where the
personal-representative question was skipped entirely for anyone
without a will.
