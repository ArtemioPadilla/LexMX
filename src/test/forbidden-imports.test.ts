import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Single-source forbidden-import gate. Reads the banned list from
// .claude/checklists/forbidden-imports.json (the same file centinela greps)
// and asserts no source file actually IMPORTS a banned module.
//
// We match real import specifiers (`from '<pattern>'` / `import('<pattern>')`),
// NOT bare string mentions — so docs, comments, and the existing
// "does not import Radix" assertions in other tests don't false-positive.

interface BannedEntry {
  pattern: string;
  reason: string;
  allowedAlternative: string;
}

const checklist = JSON.parse(
  // process.cwd() is the repo root under vitest; import.meta.url is not a file: URL under jsdom.
  readFileSync(resolve(process.cwd(), '.claude/checklists/forbidden-imports.json'), 'utf8'),
) as { banned: BannedEntry[] };

// Eagerly load every source file as raw text. Exclude test files (they
// legitimately reference banned names in assertions) and generated dirs.
const sources = import.meta.glob('../**/*.{ts,tsx,astro}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const files = Object.entries(sources).filter(([path]) => !/\.test\.[tj]sx?$/.test(path));

function importsOf(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // static import / re-export / dynamic import of the specifier (or its subpaths)
  return new RegExp(`(from|import)\\s*\\(?\\s*['"]${esc}`);
}

describe('forbidden imports (single source: .claude/checklists/forbidden-imports.json)', () => {
  it('the checklist lists the known banned specifiers', () => {
    const pats = checklist.banned.map((b) => b.pattern);
    expect(pats).toEqual(
      expect.arrayContaining([
        '@radix-ui/',
        'radix-ui',
        '@tremor/react',
        'framer-motion',
        '@astrojs/tailwind',
        '@ark-ui/react',
      ]),
    );
  });

  it.each(checklist.banned)('no source file imports $pattern', ({ pattern }) => {
    const re = importsOf(pattern);
    const offenders = files.filter(([, src]) => re.test(src)).map(([p]) => p);
    expect(offenders, `banned import "${pattern}" found in: ${offenders.join(', ')}`).toHaveLength(0);
  });
});
