-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Carry over the previously-hardcoded admin allowlist so that account
-- doesn't lose access once the code-level allowlist is removed.
UPDATE "users" SET "isAdmin" = true WHERE "email" = 'codyforprez@gmail.com';
