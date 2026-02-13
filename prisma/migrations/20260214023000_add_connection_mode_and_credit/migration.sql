-- CreateEnum
CREATE TYPE "OpenAIConnectionMode" AS ENUM ('ORGANIZATION', 'PERSONAL');

-- AlterTable
ALTER TABLE "OpenAIConnection"
ADD COLUMN "mode" "OpenAIConnectionMode" NOT NULL DEFAULT 'ORGANIZATION',
ADD COLUMN "creditTotalGranted" DECIMAL(18,6),
ADD COLUMN "creditTotalUsed" DECIMAL(18,6),
ADD COLUMN "creditTotalAvailable" DECIMAL(18,6),
ADD COLUMN "creditCurrency" TEXT;
