#!/bin/bash
# Mianx.ai — Production Database Setup Script
# Run this ONCE to push schema to your Supabase/Postgres database.
#
# Usage:
#   bash setup-prod-db.sh "postgres://user:pass@host:port/db"
#
# After running this:
#   1. Tables will be created in your Supabase project
#   2. The 24 AI agents will be auto-seeded on first API call
#   3. The first user to sign up will automatically become ADMIN

set -e

DB_URL="$1"

if [ -z "$DB_URL" ]; then
  echo "❌ Usage: bash setup-prod-db.sh <postgres-connection-string>"
  echo ""
  echo "Examples:"
  echo '  bash setup-prod-db.sh "postgres://postgres:password@db.sneshfeidnitwabmafsh.supabase.co:5432/postgres"'
  echo '  bash setup-prod-db.sh "postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname"'
  exit 1
fi

echo "🚀 Setting up Mianx.ai production database..."
echo ""

# Verify URL looks like postgres
if [[ ! "$DB_URL" =~ ^postgres ]]; then
  echo "⚠️  Warning: URL doesn't start with 'postgres'. Are you sure this is a Postgres connection string?"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# Backup current schema
cp prisma/schema.prisma prisma/schema.backup.prisma
echo "✓ Backed up current schema to prisma/schema.backup.prisma"

# Swap to postgres schema
cp prisma/schema.postgres.prisma prisma/schema.prisma
echo "✓ Switched to Postgres schema"

# Set DATABASE_URL for this command
export DATABASE_URL="$DB_URL"

# Generate Prisma client for postgres
echo "✓ Generating Prisma client..."
bun run db:generate 2>&1 | tail -3

# Push schema to database
echo ""
echo "📤 Pushing schema to database..."
bun run db:push 2>&1 | tail -10

# Restore SQLite schema for local dev
cp prisma/schema.backup.prisma prisma/schema.prisma
rm prisma/schema.backup.prisma
echo ""
echo "✓ Restored SQLite schema for local dev"

echo ""
echo "🎉 SUCCESS! Your production database is ready."
echo ""
echo "Next steps:"
echo "  1. Go to your Vercel project settings"
echo "  2. Add Environment Variable: DATABASE_URL = $DB_URL"
echo "  3. Add Environment Variable: NEXTAUTH_SECRET = (random 32-char string)"
echo "  4. Add Environment Variable: NEXTAUTH_URL = https://your-app.vercel.app"
echo "  5. Redeploy your Vercel project"
echo "  6. Visit your deployed app and Sign Up — the FIRST user becomes ADMIN automatically"
echo ""
