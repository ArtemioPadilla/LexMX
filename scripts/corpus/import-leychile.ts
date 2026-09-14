/**
 * Importa legislación chilena desde LeyChile (Biblioteca del Congreso
 * Nacional) al formato del corpus de LexMX (plan § 11.4 B, segunda oleada).
 *
 *   node --experimental-strip-types scripts/corpus/import-leychile.ts \
 *     --out build/corpus-cl/legal-corpus [--norms 207436,242302] [--cache .cache/leychile]
 *
 * Para cada `idNorma` descarga `obtxml?opt=7&idNorma=<id>` (texto vigente),
 * lo convierte con `src/pipeline/leychile.ts` y escribe `<slug>.json`,
 * `index.json` y `metadata.json` con la misma forma que el corpus mexicano,
 * de modo que `build-embeddings.ts`, el instalador y el benchmark lo tratan
 * igual. Un corpus por jurisdicción: se publica como release `corpus-cl`.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLeyChile, toLegalDocumentCl } from '../../src/pipeline/leychile.ts';
import { corpusIndexEntry } from '../../src/pipeline/legalia.ts';

const XML_URL = (id: string) => `https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=${id}`;

/** Primera oleada CL: constitución, códigos y leyes de mayor consulta. */
export const DEFAULT_NORMS: Array<{ id: string; slug: string; title: string }> = [
  { id: '242302', slug: 'cl-cpr', title: 'Constitución Política de la República de Chile' },
  { id: '207436', slug: 'cl-ct', title: 'Código del Trabajo' },
  { id: '172986', slug: 'cl-cc', title: 'Código Civil' },
  { id: '1984', slug: 'cl-cp', title: 'Código Penal' },
  { id: '1974', slug: 'cl-ccom', title: 'Código de Comercio' },
  { id: '176595', slug: 'cl-cpp', title: 'Código Procesal Penal' },
  { id: '22740', slug: 'cl-cpc', title: 'Código de Procedimiento Civil' },
  { id: '6368', slug: 'cl-lir', title: 'Ley sobre Impuesto a la Renta (DL 824)' },
  { id: '61438', slug: 'cl-lpc', title: 'Ley 19.496 sobre protección de los derechos de los consumidores' },
  { id: '141599', slug: 'cl-lpd', title: 'Ley 19.628 sobre protección de la vida privada' },
  { id: '30667', slug: 'cl-lbgma', title: 'Ley 19.300 sobre bases generales del medio ambiente' },
];

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function fetchXml(id: string, cacheDir: string): Promise<string> {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `${id}.xml`);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const res = await fetch(XML_URL(id), { headers: { 'user-agent': 'LexMX corpus importer (+https://github.com/ArtemioPadilla/LexMX)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for idNorma ${id}`);
  const xml = await res.text();
  if (!/<Norma[\s>]/.test(xml)) throw new Error(`unexpected payload for idNorma ${id}`);
  writeFileSync(file, xml);
  return xml;
}

async function main(): Promise<void> {
  const outDir = arg('out', 'build/corpus-cl/legal-corpus')!;
  const cacheDir = arg('cache', '.cache/leychile')!;
  const requested = arg('norms');
  const norms = requested
    ? requested.split(',').map((s) => s.trim()).filter(Boolean).map((id) => DEFAULT_NORMS.find((n) => n.id === id) ?? { id, slug: `cl-${id}`, title: '' })
    : DEFAULT_NORMS;
  mkdirSync(outDir, { recursive: true });

  const entries: ReturnType<typeof corpusIndexEntry>[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const { id, slug, title } of norms) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    try {
      const xml = await fetchXml(id, cacheDir);
      const doc = toLegalDocumentCl(parseLeyChile(xml), slug, title || undefined);
      const json = JSON.stringify(doc);
      writeFileSync(join(outDir, `${slug}.json`), json);
      entries.push(corpusIndexEntry(doc, Buffer.byteLength(json), { jurisdiction: 'cl-nacional', source: 'leychile:bcn' }));
      console.log(`✓ ${slug.padEnd(16)} ${doc.content.filter((c) => c.type === 'article').length.toString().padStart(5)} artículos  ${doc.status.padEnd(9)} ${doc.title.slice(0, 70)}`);
    } catch (error) {
      failures.push(`${slug} (${id}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const buildDate = new Date().toISOString();
  const count = (key: 'type' | 'primaryArea' | 'hierarchy') =>
    entries.reduce<Record<string, number>>((acc, e) => ({ ...acc, [String(e[key])]: (acc[String(e[key])] ?? 0) + 1 }), {});
  writeFileSync(
    join(outDir, 'index.json'),
    JSON.stringify({ version: '2.0.0', buildDate, source: { name: 'LeyChile (BCN)', url: 'https://www.bcn.cl/leychile' }, jurisdiction: 'cl', documents: entries }, null, 2),
  );
  writeFileSync(
    join(outDir, 'metadata.json'),
    JSON.stringify(
      {
        version: '2.0.0',
        buildDate,
        jurisdiction: 'cl',
        totalDocuments: entries.length,
        totalSize: entries.reduce((s, e) => s + e.size, 0),
        legalAreas: count('primaryArea'),
        documentTypes: count('type'),
        hierarchyDistribution: count('hierarchy'),
        checksum: createHash('sha256').update(entries.map((e) => `${e.id}:${e.size}`).join('|')).digest('hex').slice(0, 16),
        documents: entries,
      },
      null,
      2,
    ),
  );
  console.log(`\n${entries.length} documentos escritos en ${outDir}`);
  if (failures.length) {
    console.error(`\n${failures.length} fallo(s):\n  ${failures.join('\n  ')}`);
    process.exitCode = entries.length ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
