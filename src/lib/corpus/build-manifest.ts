/**
 * Build-time view of the published corpus (Node only: used by
 * `getStaticPaths` in src/pages/document/[id].astro). Reads
 * public/legal-corpus/metadata.json, which the Pages deploy fills from the
 * corpus-latest release before `astro build`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface CorpusManifestEntry {
  id: string;
  title: string;
  primaryArea?: string;
  type?: string;
}

/** Ids that always get a page so old links keep working without a corpus. */
export const FALLBACK_DOCUMENTS: CorpusManifestEntry[] = [
  { id: 'cpeum', title: 'Constitución Política de los Estados Unidos Mexicanos' },
  { id: 'lft', title: 'Ley Federal del Trabajo' },
  { id: 'cpf', title: 'Código Penal Federal' },
  { id: 'cff', title: 'Código Fiscal de la Federación' },
  { id: 'ccom', title: 'Código de Comercio' },
  { id: 'ccf', title: 'Código Civil Federal' },
  { id: 'codigo-civil-federal', title: 'Código Civil Federal' },
];

export function corpusDocumentsAtBuild(root = process.cwd()): CorpusManifestEntry[] {
  const file = resolve(root, 'public/legal-corpus/metadata.json');
  if (!existsSync(file)) return [];
  try {
    const meta = JSON.parse(readFileSync(file, 'utf8')) as { documents?: CorpusManifestEntry[] };
    return (meta.documents ?? []).filter((d) => typeof d.id === 'string' && typeof d.title === 'string');
  } catch {
    return [];
  }
}

/** Corpus documents first, then fallbacks, without duplicate ids. */
export function documentPages(root?: string): CorpusManifestEntry[] {
  const seen = new Map<string, CorpusManifestEntry>();
  for (const d of [...corpusDocumentsAtBuild(root), ...FALLBACK_DOCUMENTS]) if (!seen.has(d.id)) seen.set(d.id, d);
  return [...seen.values()];
}
