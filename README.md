# After Atlas

A guided survey that turns a major life transition into a personalized
action checklist, plus vendor recommendations. See
[`after-atlas-phase1-spec.md`](./after-atlas-phase1-spec.md) for the full
product spec this build follows.

Phase 1 ships one fully-populated event type (`death`), but the survey /
checklist / vendor engine is built generically around `EventType` from day
one — adding `divorce` or `layoff` later is a content change (a new seed
file), not new engineering.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind)
- **Postgres** via **Prisma 7** (driver adapter: `@prisma/adapter-pg`)
- **Auth.js (NextAuth v5)** — Credentials provider (email/password) today;
  OAuth is a drop-in addition later
- **`@react-pdf/renderer`** for the downloadable checklist PDF

## Getting started

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and AUTH_SECRET

npm run db:migrate      # applies prisma/migrations
npm run db:seed         # loads prisma/seed-data/*.json, then the WA spreadsheet import
npm run dev
```

## Architecture

### Data model (`prisma/schema.prisma`)

Mirrors spec §1 directly. The load-bearing idea: `EventType` is the only
thing that varies between "death," "divorce," and "layoff" — `Question`,
`QuestionBranch`, `ChecklistItem`/`Gap`, and their trigger tables all key
off `eventTypeId` and never hardcode a life event. `SurveyMode`
(`post_event` | `planning`) is a column, not a separate schema — the same
`Question`/`AnswerOption`/`QuestionBranch` tables back both the post-death
checklist flow and the pre-death planning/gap-report flow.

`Plan` and `PlanMember` are schema-only for Phase 1 (see spec §3) —
present so household collaboration doesn't require a migration later, but
with no invite flow or permissions built yet.

### Survey engine (`src/lib/survey-engine.ts`, `src/lib/survey-responses.ts`)

Pure, mode-agnostic functions that resolve branching (`advanceSurvey`),
skip logic, and which `ChecklistItem`/`Gap` rows are triggered by a given
answer set. `src/components/survey/` (SectionNav, QuestionCard,
SurveyRunner) and the two thin route pages
(`src/app/survey/[eventType]`, `src/app/plan/[eventType]`) share one
`SurveyPage` component (`src/components/survey/survey-page.tsx`) that
only differs by `mode` and result path — never by event type.

### Seed content (`prisma/seed-data/*.json`, `prisma/seed.ts`)

Each event type is one JSON file (currently just `death.json`, holding
the hand-authored `planning`-mode content) describing its questions,
branches, checklist items/gaps + triggers, vendor categories, vendors,
and articles. `prisma/seed.ts` loads every file in the directory
generically — adding `divorce.json` requires no script changes.
Question `order` is a single global sequence across the whole
event-type + mode question set (not scoped per category — `category` is
only a display label for the section nav).

### WA spreadsheet import (`prisma/seed-xlsx.ts`, spec §6)

The real `death`/`wa`/`post_event` content (177 rows) comes from
`After_Atlas_July26 2026_Claude updated.xlsx`, parsed and upserted by
`prisma/seed-xlsx.ts` (chained after `seed.ts` in `prisma.config.ts`'s
seed command). Two engine conventions from the spreadsheet are
implemented generically in `src/lib/survey-engine.ts` — not hardcoded to
the specific rows that currently use them:

- **`skip_if_already_shown`** (`Question.skipIfChecklistItemShownId`):
  `advanceSurvey` treats any upcoming question as skipped if the
  `ChecklistItem` it names was already triggered earlier in the same
  session, walking forward to whatever comes next.
- **`multiselect_group`** (`Question.multiselectGroup`): `SurveyRunner`
  detects a contiguous run of questions sharing a group value and
  renders them as one "select all that apply" screen
  (`MultiselectGroupCard`), submitting all answers in a single batch via
  `PATCH /api/survey-responses/[id]` (`{ answers: [...] }`).

`Jurisdiction` (`wa` fully populated, `general` a stub with no content
yet) backs the nullable `Question.jurisdictionId` — set only on the
will/intestate-succession intro sequence (uid 5–40), matching spec's
"most of the survey is jurisdiction-agnostic" guidance.

**Data-quality note:** the source spreadsheet's own change history shows
three categories (Guardianship, Employment, Digital Assets) and a
handful of items added to existing categories, but the links needed to
splice them into the traversable chain were never added — they'd be
unreachable by answering questions straight through, only reachable via
the section-nav category list. `seed-xlsx.ts` documents and applies the
minimal set of link corrections found by simulating traversal from the
first question (`ALWAYS_JUMP_TO_FIXES` / `ANSWER_OPTION_TARGET_FIXES`);
every other authored link is imported untouched. Verified end-to-end
(automated reachability check against the imported data, 177/177
questions, zero broken links, plus a full Playwright walkthrough
including the multiselect and skip mechanics) before this was
considered done.

### Vendors

Phase 1 vendors are manually seeded (no self-signup/bidding — see spec
§3). `/checklist/[responseId]` and `/gaps/[responseId]` show up to two
vendors per relevant category, sorted by `priority`; if a category has no
vendors, the page falls back to a Yelp search link, per the spec's
fallback rule.

### Known gaps vs. the page-structure blurb in spec §2

- No "visited vendor list" on `/dashboard` — that would need a tracking
  table that isn't part of the §1 data model, so it was left out rather
  than invented.
- Section-nav keyword search and OAuth login are explicitly stretch
  goals / nice-to-haves in the spec, not built.

## Everything deferred to later phases

See spec §3: vendor marketplace (bidding/billing), full admin tooling
(question/CMS builder), new event types as content, and household
collaboration (invite flow, roles, decision log).
