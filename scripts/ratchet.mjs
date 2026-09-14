#!/usr/bin/env node
/**
 * scripts/ratchet.mjs — quality ratchet.
 *
 * LexMX carries legacy type errors and `any` warnings. Instead of letting the
 * gate stay red (and therefore ignored), this script measures both counts and
 * fails only when they GROW past the committed baseline. Lowering the numbers
 * is expected; raising them requires an explicit `--update` in the same PR,
 * which reviewers (and centinela) will see in the diff of quality-baseline.json.
 *
 *   node scripts/ratchet.mjs            # compare against quality-baseline.json
 *   node scripts/ratchet.mjs --update   # rewrite the baseline with current counts
 *
 * Counts:
 *   tscErrors   — `tsc --noEmit -p tsconfig.json` diagnostics
 *   anyWarnings — eslint `@typescript-eslint/no-explicit-any` warnings in src/
 *
 * See docs/INCEPTOR-MIGRATION-ANALYSIS.md § 5 (Fase 2) for the rationale.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import process from 'node:process';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const baselinePath = join(root, 'quality-baseline.json');
const update = process.argv.includes('--update');

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  return `${res.stdout ?? ''}${res.stderr ?? ''}`;
}

function countTscErrors() {
  const out = run('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false']);
  return (out.match(/error TS\d+/g) ?? []).length;
}

function countAnyWarnings() {
  const out = run('npx', ['eslint', 'src', '--format', 'json']);
  const start = out.indexOf('[');
  if (start === -1) return 0;
  let report;
  try {
    report = JSON.parse(out.slice(start));
  } catch {
    return 0;
  }
  return report.reduce(
    (sum, file) =>
      sum + file.messages.filter((m) => m.ruleId === '@typescript-eslint/no-explicit-any').length,
    0,
  );
}

const current = { tscErrors: countTscErrors(), anyWarnings: countAnyWarnings() };

if (update || !existsSync(baselinePath)) {
  writeFileSync(baselinePath, `${JSON.stringify({ ...current, updatedAt: new Date().toISOString().slice(0, 10) }, null, 2)}\n`);
  console.log(`ratchet: baseline written → ${JSON.stringify(current)}`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
let failed = false;
for (const key of Object.keys(current)) {
  const was = baseline[key] ?? Infinity;
  const now = current[key];
  const mark = now > was ? '✗' : now < was ? '↓' : '=';
  console.log(`ratchet: ${key.padEnd(12)} ${mark} ${now} (baseline ${was})`);
  if (now > was) failed = true;
}

if (failed) {
  console.error(
    '\nratchet: quality regressed. Fix the new errors/anys, or run `npm run ratchet:update` ' +
      'in the same PR if the increase is deliberate and reviewed.',
  );
  process.exit(1);
}

if (current.tscErrors < baseline.tscErrors || current.anyWarnings < baseline.anyWarnings) {
  console.log('ratchet: counts went down — run `npm run ratchet:update` to lock in the gain.');
}
