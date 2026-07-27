-- Superseded by runtime traversal order derived from TopicBucket data
-- (see src/lib/survey-engine.ts and the PATCH /api/survey-responses/[id]
-- route) — category visit order now follows the topic-selection bucket
-- picker's own order instead of the spreadsheet's hand-authored tour.
ALTER TABLE "questions" DROP COLUMN "categorySequence";
