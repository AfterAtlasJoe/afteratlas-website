/*
  Warnings:

  - Added the required column `singularName` to the `vendor_categories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Default is a backfill placeholder for pre-existing rows (immediately
-- overwritten by the next `prisma db seed` run) — the column itself
-- stays required, matching the schema (no default there).
ALTER TABLE "vendor_categories" ADD COLUMN     "singularName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vendor_categories" ALTER COLUMN "singularName" DROP DEFAULT;
