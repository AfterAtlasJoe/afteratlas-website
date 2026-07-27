/*
  Warnings:

  - Added the required column `description` to the `topic_buckets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Default is a backfill placeholder for any pre-existing rows (immediately
-- overwritten by the next `prisma db seed` run) — the column itself stays
-- required, matching the schema (no default there).
ALTER TABLE "topic_buckets" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "topic_buckets" ALTER COLUMN "description" DROP DEFAULT;
