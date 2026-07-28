-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN     "generalDescription" TEXT,
ADD COLUMN     "generalRelatedLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "generalDescription" TEXT,
ADD COLUMN     "generalPrompt" TEXT;
