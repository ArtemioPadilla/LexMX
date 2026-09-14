# Ethics checklist (single source)

This is the canonical 8-item checklist. The PR template and `docs/ETHICS.md`
mirror it. **Edit `.claude/checklists/ethics.json` first**, then propagate
changes here and in the user-facing docs. Centinela's ethics gate reads the
JSON; humans read this file.

| # | Item | Required at tier | Fogg concern | Question |
|---|---|---|---|---|
| 1 | Intent declared | 1, 2 | #1 | What behaviour change does this PR push the user toward, and whose benefit does it serve? |
| 2 | No deception, no coercion | 2 | Methods-Always-Unethical | Does any copy, default, or affordance mislead about consequences or remove a reasonable opt-out? |
| 3 | Asymmetric persistence justified | — | #3 + #4 | If the UI nags, retries, or auto-reopens, is the user clearly in control of stopping it? |
| 4 | Borrowed credibility honest | — | #2 | Do badges, charts, or "AI-powered" labels imply more authority than the system actually has? |
| 5 | Emotional cues reciprocal or disclosed | — | #5 | Does the UI express feelings without a way for the user's emotion to alter the system? |
| 6 | Surveillance overt and supportive | 2 | surveillance | Is any telemetry visible to the user at the moment of capture, and used for help, not punishment? |
| 7 | Vulnerable-group impact considered | 1, 2 | Ch. 9 | Could a child, non-native reader, anxious / low-vision / motor-impaired user be harmed by this pattern? |
| 8 | Unintended-but-predictable outcomes named | 1, 2 | Methods-Sometimes-Unethical | What is the worst-case misuse or escalation of this behavior change, and is the design resilient to it? |

## Tier rubric

- **Tier 0** — docs/tests only. No ethics items required.
- **Tier 1** — default for `type:feat` / `type:fix`. Items 1, 7, 8 required.
- **Tier 2** — `risk:high` triggers (see `docs/ETHICS.md` §risk-high-triggers).
  Items 1, 2, 6, 7, 8 required.

## How centinela consumes this

`centinela` reads `.claude/checklists/ethics.json` at gate time and:

1. Determines the PR's tier from labels (`tdd-tier:strict` → 1, `risk:high` → 2).
2. Computes the required-item set for that tier.
3. Greps the PR description for each required item's marker (the `**1.`, `**2.`,
   … headings the PR template emits) and asserts a non-empty answer.
4. Returns `verdict: REJECTED` with `failure_class: ETHICS_OR_UX_FAIL` if any
   required item is empty or marked N/A without a justification line.

Edit the JSON to change the rubric; centinela picks up the change on its next
run without code edits.
