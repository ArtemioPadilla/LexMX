# Governance checklist (single source)

The baseline every Inceptor-derived repo should satisfy. `prometeo` reads this
on its governance pre-check; humans use it during repo setup. Mirrors
`docs/PRINCIPLES.md` §6 and `docs/governance/branch-protection.md`.

## Files present at the repo root / `.github/`

- [x] `LICENSE` — MIT
- [x] `SECURITY.md` — disclosure policy + no-penalty pledge
- [x] `CODE_OF_CONDUCT.md` — Contributor Covenant reference
- [x] `.github/dependabot.yml` — weekly npm + GitHub Actions updates
- [x] `.github/PULL_REQUEST_TEMPLATE.md` — TDD evidence + tiered 8-item ethics checklist
- [x] `.github/CODEOWNERS` — default owner + examples

## Branch protection on `main` (configure once per repo)

See `docs/governance/branch-protection.md` for the one-shot `gh api` command.

- [ ] Require a PR before merging (no direct pushes)
- [ ] Required status checks: `build`, `test`, `type-check`, `visual`
- [ ] Linear history (squash-merge)
- [ ] Signed commits (`required_signatures`)
- [ ] Dismiss stale reviews; require code-owner review

## Per-PR gates (enforced by the PR template + centinela)

- [ ] Tier-appropriate ethics items answered (see `.claude/checklists/ethics.json`)
- [ ] TDD evidence: `Tdd-Red:` trailer or `Tdd-Red-Verified: inline`
- [ ] `risk:high` triggers → Stakeholder Analysis ADR in `docs/decisions/`
- [ ] No forbidden imports (see `.claude/checklists/forbidden-imports.json`)
