-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "vendorCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_vendorCategoryId_fkey" FOREIGN KEY ("vendorCategoryId") REFERENCES "vendor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
