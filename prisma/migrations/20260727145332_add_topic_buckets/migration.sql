-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('bool', 'select', 'info', 'topic_selection');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'bool';

-- AlterTable
ALTER TABLE "survey_responses" ADD COLUMN     "selectedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "topic_buckets" (
    "id" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "mode" "SurveyMode" NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "categories" TEXT[],

    CONSTRAINT "topic_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_buckets_eventTypeId_mode_idx" ON "topic_buckets"("eventTypeId", "mode");

-- AddForeignKey
ALTER TABLE "topic_buckets" ADD CONSTRAINT "topic_buckets_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
