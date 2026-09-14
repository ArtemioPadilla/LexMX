#!/usr/bin/env bash
# scripts/pre-commit.sh — opt-in pre-commit hook for Inceptor contributors.
#
# INSTALLATION (opt-in — never auto-enabled):
#   npm run hooks:install
#   # which runs: git config core.hooksPath scripts/hooks
#
# This script runs lint + type-check on staged files before every commit.
# It does NOT run the full build (too slow for interactive use); that stays in CI.
#
# To bypass in an emergency: git commit --no-verify
# To uninstall: git config --unset core.hooksPath

set -euo pipefail

echo "pre-commit: running lint + type-check..."

# ESLint — only staged .ts/.tsx files (fast; no full project scan)
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -n "$STAGED" ]; then
  echo "  eslint: $STAGED"
  npx eslint --max-warnings=0 $STAGED
fi

# Type-check always runs on the full project (tsc needs all files for
# cross-reference resolution; partial checks give false positives)
echo "  tsc: full project type-check..."
npx tsc --noEmit

# TS pragma check
echo "  check-ts-pragmas: scanning src/..."
node scripts/check-ts-pragmas.mjs

echo "pre-commit: OK"
