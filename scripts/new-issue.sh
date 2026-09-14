#!/usr/bin/env bash
# Interactive wrapper around `gh issue create --template`. Infers a sensible
# label set from the current branch name and pre-fills the title prefix.
set -euo pipefail

branch="$(git branch --show-current)"
labels=""

case "$branch" in
  phase-0/*) labels="phase-0,type:chore" ;;
  phase-1/*) labels="phase-1,type:feat"  ;;
  phase-2/*) labels="phase-2,type:feat"  ;;
  phase-3/*) labels="phase-3,type:feat"  ;;
  phase-4/*) labels="phase-4,type:feat"  ;;
  phase-5/*) labels="phase-5,type:feat"  ;;
  phase-6/*) labels="phase-6,type:feat"  ;;
  phase-7/*) labels="phase-7,type:feat"  ;;
  chore/*)   labels="type:chore"         ;;
  docs/*)    labels="type:docs"          ;;
  fix/*)     labels="type:feat"          ;;
  *)         labels=""                   ;;
esac

if [ -n "$labels" ]; then
  printf "Inferred labels from branch \`%s\`: \033[36m%s\033[0m\n" "$branch" "$labels"
  exec gh issue create --label "$labels"
else
  printf "Branch \`%s\` doesn't match a known convention; opening interactive picker.\n" "$branch"
  exec gh issue create
fi
