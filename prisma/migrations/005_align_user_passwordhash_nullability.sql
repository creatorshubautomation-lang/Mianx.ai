-- Align production with prisma/schema.prisma.
-- Existing password hashes are preserved; this only relaxes nullability for future OAuth-only accounts.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
