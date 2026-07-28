-- CreateEnum
CREATE TYPE "AdminDigestFrequency" AS ENUM ('off', 'instant', 'daily', 'weekly', 'monthly');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminDigestFrequency" "AdminDigestFrequency" NOT NULL DEFAULT 'instant',
ADD COLUMN     "digestLastSentAt" TIMESTAMP(3),
ADD COLUMN     "receiveChecklistEmail" BOOLEAN NOT NULL DEFAULT true;
