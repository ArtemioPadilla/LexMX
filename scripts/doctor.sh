#!/usr/bin/env bash
# Preflight check for the scaffold. Prints what is missing and how to fix it.
# Used by `npm run doctor`.
set -u

ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$*"; ERRORS=$((ERRORS + 1)); }

ERRORS=0
echo "Preflight: scaffold readiness"
echo

# Node version
if command -v node >/dev/null 2>&1; then
  node_version="$(node --version)"
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  if [ "$node_major" -ge 22 ]; then
    ok "node $node_version (>= 22)"
  else
    fail "node $node_version is too old; need >= 22 (use nvm or fnm to upgrade)"
  fi
else
  fail "node not found on PATH"
fi

# npm
if command -v npm >/dev/null 2>&1; then
  ok "npm $(npm --version)"
else
  fail "npm not found on PATH"
fi

# gh CLI
if command -v gh >/dev/null 2>&1; then
  ok "gh $(gh --version | head -1 | awk '{print $3}')"
  if gh auth status >/dev/null 2>&1; then
    ok "gh auth: signed in"
  else
    warn "gh auth: not signed in — run \`gh auth login\` for the Inceptor flow to work"
  fi
else
  warn "gh not found — install from https://cli.github.com (needed for /goal, ship, monday)"
fi

# Git working tree
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [ -z "$(git status --porcelain)" ]; then
    ok "working tree clean"
  else
    warn "working tree has uncommitted changes (run \`git status\` to see)"
  fi
  branch="$(git branch --show-current)"
  if [ "$branch" = "main" ]; then
    ok "on main branch"
  elif printf "%s" "$branch" | grep -qE '^(phase-[0-9]+/issue-[0-9]+-|chore/|docs/|test/|fix/)' ; then
    ok "branch \`$branch\` follows naming convention"
  else
    warn "branch \`$branch\` does not match Inceptor naming (phase-N/issue-NNN-slug or chore/...)"
  fi
else
  fail "not inside a git repository"
fi

# Dependencies installed
if [ -d node_modules ]; then
  ok "node_modules present"
else
  fail "node_modules missing — run \`npm install\`"
fi

# Astro check
if [ -f astro.config.mjs ]; then
  ok "astro.config.mjs present"
else
  fail "astro.config.mjs missing"
fi

# src/env.d.ts — easy to forget on a selective port; its absence makes
# `import.meta.env` fail type-check with a cryptic ts(2339) error.
if [ -f src/env.d.ts ]; then
  ok "src/env.d.ts present"
else
  fail "src/env.d.ts missing — add '/// <reference types=\"astro/client\" />'"
fi

# ANTHROPIC_API_KEY (optional but helpful for the Claude triage workflow)
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  ok "ANTHROPIC_API_KEY is set"
else
  warn "ANTHROPIC_API_KEY not set — Claude triage workflow will need it as a GitHub repo secret"
fi

# ---------------------------------------------------------------------------
# Placeholder / template-default scan (#185)
# Warns when the canonical origin or API key placeholders look like they were
# never updated after forking from the Inceptor template.
# ---------------------------------------------------------------------------
echo
echo "Placeholder scan"

# Read package.json name so we can skip the check when running IN the template
PKG_NAME=""
if [ -f package.json ] && command -v node >/dev/null 2>&1; then
  PKG_NAME="$(node -e "try{process.stdout.write(require('./package.json').name||'')}catch(e){}")"
fi

if [ "$PKG_NAME" = "inceptor" ] || [ "$PKG_NAME" = "" ]; then
  ok "package name is '$PKG_NAME' — skipping re-brand check (running in template repo)"
else
  # Derived project: flag leftover template defaults in key files
  PLACEHOLDER_FILES="src/lib/site-meta.ts site.config.mjs public/robots.txt"
  TEMPLATE_ORIGINS="artemiop.com ArtemioPadilla"
  found_placeholder=0
  for f in $PLACEHOLDER_FILES; do
    if [ -f "$f" ]; then
      for pat in $TEMPLATE_ORIGINS; do
        if grep -q "$pat" "$f" 2>/dev/null; then
          warn "$f still contains template default '$pat' — re-brand before shipping"
          found_placeholder=1
        fi
      done
    fi
  done
  if [ "$found_placeholder" -eq 0 ]; then
    ok "no leftover template-origin placeholders found"
  fi
fi

# API key / secret placeholders — checked regardless of package name
SCAN_DIRS="public src"
PLACEHOLDER_PATTERNS="YOUR_[A-Z_]*_KEY YOUR_[A-Z_]*_TOKEN localhost:3000 http://localhost"
placeholder_hits=0
for pat in $PLACEHOLDER_PATTERNS; do
  # grep -r returns 1 if no match; we only want to flag actual matches
  hits="$(grep -rn --include="*.ts" --include="*.tsx" --include="*.astro" \
            --include="*.mjs" --include="*.json" --include="*.txt" \
            "$pat" $SCAN_DIRS 2>/dev/null | grep -v node_modules || true)"
  if [ -n "$hits" ]; then
    warn "Found placeholder pattern '$pat' in source:"
    printf "%s\n" "$hits" | head -5 | while IFS= read -r line; do
      warn "  $line"
    done
    placeholder_hits=$((placeholder_hits + 1))
  fi
done
if [ "$placeholder_hits" -eq 0 ]; then
  ok "no API-key or localhost placeholder patterns found in source"
fi

echo
if [ "$ERRORS" -gt 0 ]; then
  printf "\033[31m%d issue(s) need attention.\033[0m\n" "$ERRORS"
  exit 1
else
  printf "\033[32mAll critical checks passed.\033[0m\n"
fi
