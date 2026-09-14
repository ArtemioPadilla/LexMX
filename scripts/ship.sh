#!/usr/bin/env bash
# `npm run ship` — runs the full local check, pushes the branch, opens a PR.
# Refuses to ship from main.
set -euo pipefail

branch="$(git branch --show-current)"
if [ "$branch" = "main" ]; then
  printf "\033[31mship: refusing to push from main\033[0m — checkout a feature branch first\n" >&2
  exit 2
fi

# Refuse on a dirty tree — half-shipped commits surprise centinela later.
if [ -n "$(git status --porcelain)" ]; then
  printf "\033[31mship: working tree is dirty\033[0m\n" >&2
  git status --short >&2
  printf "Commit or stash, then run \`npm run ship\` again.\n" >&2
  exit 2
fi

# Full check first — fail fast before pushing.
printf "\033[36m→ running npm run check\033[0m\n"
npm run check

# Push (creates remote tracking on first run, fast-forwards otherwise).
printf "\033[36m→ pushing %s\033[0m\n" "$branch"
git push -u origin "$branch"

# Open or update the PR. `gh pr create --fill` uses the commit messages.
if gh pr view >/dev/null 2>&1; then
  printf "\033[36m→ PR already exists; opening in browser\033[0m\n"
  gh pr view --web
else
  printf "\033[36m→ creating PR\033[0m\n"
  gh pr create --fill --web
fi
