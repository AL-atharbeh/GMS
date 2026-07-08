-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "optInMarketing" BOOLEAN DEFAULT true,
ADD COLUMN     "preferredContactMethod" TEXT;
