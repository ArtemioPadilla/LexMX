#!/usr/bin/env node
/**
 * scripts/check-ts-pragmas.mjs
 *
 * CI gate: fails (exit 1) when an uncommented @ts-nocheck or @ts-expect-error
 * appears in src/ without a required trailing reason comment.
 *
 * Allowed forms (pass):
 *   // @ts-expect-error -- reason here
 *   // @ts-nocheck -- reason here  (strongly discouraged but escapable)
 *
 * Blocked forms (fail):
 *   // @ts-nocheck
 *   // @ts-expect-error
 *   // @ts-expect-error some text without the " -- " delimiter
 *   @ts-ignore (always banned — use @ts-expect-error with reason instead)
 *
 * Usage:
 *   node scripts/check-ts-pragmas.mjs          # check src/
 *   node scripts/check-ts-pragmas.mjs --dir src # same, explicit
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const targetDir = join(repoRoot, dirArg !== -1 ? (args[dirArg + 1] ?? 'src') : 'src');

const EXTS = new Set(['.ts', '.tsx', '.mts', '.cts']);

// @ts-ignore is always banned — use @ts-expect-error with reason.
// @ts-nocheck and @ts-expect-error are allowed ONLY when followed by " -- <reason>".
const BANNED_RE =
  /@ts-ignore|@ts-nocheck(?!\s+--\s+\S)|@ts-expect-error(?!\s+--\s+\S)/;

/** Walk a directory recursively, yielding file paths with the given extensions. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (EXTS.has(extname(full))) {
      yield full;
    }
  }
}

const violations = [];

for (const file of walk(targetDir)) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (BANNED_RE.test(line)) {
      // Relative to repo root for readable output.
      violations.push(`  ${file.replace(repoRoot + '/', '')}:${i + 1}  ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    `\ncheck-ts-pragmas: ${violations.length} banned TypeScript suppression pragma(s) found:\n`,
  );
  for (const v of violations) console.error(v);
  console.error(`
Allowed form (requires a " -- reason" suffix):
  // @ts-expect-error -- <reason explaining why this is safe>

Banned:
  @ts-ignore              — always banned; use @ts-expect-error with reason
  // @ts-nocheck          — banned without " -- reason"
  // @ts-expect-error     — banned without " -- reason"

Fix the root cause or add a documented reason. See docs/PRINCIPLES.md §3.
`);
  process.exit(1);
}

console.log(`check-ts-pragmas: OK (${[...walk(targetDir)].length} files scanned, 0 violations)`);
