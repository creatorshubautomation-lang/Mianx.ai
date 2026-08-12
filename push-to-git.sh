#!/bin/bash
# Mianx.ai — Push to your Git repository
# Usage: bash push-to-git.sh <your-github-url>
# Example: bash push-to-git.sh https://github.com/username/mianx-ai.git

set -e

REPO_URL="$1"

if [ -z "$REPO_URL" ]; then
  echo "❌ Usage: bash push-to-git.sh <your-github-url>"
  echo ""
  echo "Examples:"
  echo "  bash push-to-git.sh https://github.com/username/mianx-ai.git"
  echo "  bash push-to-git.sh git@github.com:username/mianx-ai.git"
  echo "  bash push-to-git.sh https://gitlab.com/username/mianx-ai.git"
  exit 1
fi

echo "🚀 Pushing Mianx.ai to: $REPO_URL"
echo ""

# Add remote (or update if exists)
if git remote get-url origin >/dev/null 2>&1; then
  echo "📝 Updating existing origin remote..."
  git remote set-url origin "$REPO_URL"
else
  echo "📝 Adding origin remote..."
  git remote add origin "$REPO_URL"
fi

# Push
echo "📤 Pushing to main branch..."
git push -u origin main

echo ""
echo "✅ Done! Your Mianx.ai repository is now live at:"
echo "   $REPO_URL"
echo ""
echo "Next steps:"
echo "  1. Visit your repo URL to verify"
echo "  2. Clone on any machine: git clone $REPO_URL"
echo "  3. Install deps: bun install"
echo "  4. Set up DB: bun run db:push"
echo "  5. Run: bun run dev"
