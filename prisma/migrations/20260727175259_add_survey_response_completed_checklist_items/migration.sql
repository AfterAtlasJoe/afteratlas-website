-- AlterTable
ALTER TABLE "survey_responses" ADD COLUMN     "completedChecklistItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
