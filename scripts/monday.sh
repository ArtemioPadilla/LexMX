#!/usr/bin/env bash
# Monday-morning dashboard. Shows the state of play in one screen.
set -uo pipefail

bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
muted() { printf "\033[90m%s\033[0m\n" "$*"; }

bold "── Open PRs awaiting review ──"
if gh pr list --state open --limit 10 --json number,title,headRefName,createdAt --template '{{range .}}#{{.number}} · {{.title}}  ({{.headRefName}}, opened {{timeago .createdAt}})
{{end}}' 2>/dev/null; then :; else muted "  gh not available or not authed"; fi
echo

bold "── Recently merged ──"
gh pr list --state merged --limit 5 --json number,title,mergedAt --template '{{range .}}#{{.number}} · {{.title}}  (merged {{timeago .mergedAt}})
{{end}}' 2>/dev/null || muted "  none"
echo

bold "── Top open issues ──"
gh issue list --state open --limit 5 --json number,title,labels --template '{{range .}}#{{.number}} · {{.title}}  [{{range .labels}}{{.name}} {{end}}]
{{end}}' 2>/dev/null || muted "  none"
echo

bold "── Local branches ──"
git for-each-ref --sort=-committerdate refs/heads/ --format='  %(refname:short)  (%(committerdate:relative))' | head -8
echo

bold "── Next steps ──"
echo "  1. \`npm run doctor\`     — sanity-check the environment"
echo "  2. \`/goal <scope>\`      — start (or continue) a phase"
echo "  3. \`npm run ship\`       — push current branch + open PR"
echo "  4. \`npm run docs\`       — open the docs INDEX if you forget where things live"
