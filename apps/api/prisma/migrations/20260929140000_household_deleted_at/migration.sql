-- Soft-delete flag for households closed when the last member leaves
ALTER TABLE "Household" ADD COLUMN "deletedAt" TIMESTAMP(3);
