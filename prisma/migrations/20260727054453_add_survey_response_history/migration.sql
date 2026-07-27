-- AlterTable
ALTER TABLE "survey_responses" ADD COLUMN     "history" TEXT[] DEFAULT ARRAY[]::TEXT[];
