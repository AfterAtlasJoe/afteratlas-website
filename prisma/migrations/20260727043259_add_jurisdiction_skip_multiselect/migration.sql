-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "jurisdictionId" TEXT,
ADD COLUMN     "multiselectGroup" TEXT,
ADD COLUMN     "skipIfChecklistItemShownId" TEXT;

-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_skipIfChecklistItemShownId_fkey" FOREIGN KEY ("skipIfChecklistItemShownId") REFERENCES "checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
