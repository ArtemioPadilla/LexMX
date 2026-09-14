#!/usr/bin/env -S node --experimental-strip-types
/**
 * scripts/corpus/import-legalia.ts — importa leyes federales desde los releases
 * de LegalIA (INGEOTEC, UNAM; Apache-2.0) al corpus de LexMX.
 *
 *   node --experimental-strip-types scripts/corpus/import-legalia.ts \
 *     --slugs cpeum,lft,ccf,cpf,cff,lisr,liva,lss,ccom,lgsm,cnpp \
 *     --out public/legal-corpus
 *
 *   node --experimental-strip-types scripts/corpus/import-legalia.ts --all --out build/corpus
 *
 * Qué hace:
 *   1. Descarga `indice-global.json.gz` del release `scjn-leyes` (o lo lee de
 *      `--cache`), que trae por instrumento: nombre, asset, materia, vigencia, resumen.
 *   2. Para cada slug pedido descarga `<slug>.tgz`, toma el snapshot más reciente
 *      (texto vigente) y lo convierte con `src/pipeline/legalia.ts`.
 *   3. Escribe `<out>/<slug>.json`, `<out>/index.json` y `<out>/metadata.json` en el
 *      formato que lee `src/lib/corpus/document-loader.ts`.
 *
 * Atribución: los textos son documentos oficiales de la SCJN; el empaquetado y
 * el historial de reformas los mantiene LegalIA. Cada documento lleva
 * `source: legalia:scjn-leyes`. No se redistribuyen los `notas/` del DOF.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { corpusIndexEntry, toLegalDocument, type InstrumentMeta } from '../../src/pipeline/legalia.ts';

const RELEASE_BASE = 'https://github.com/INGEOTEC/LegalIA/releases/download/scjn-leyes';
const DEFAULT_SLUGS = ['cpeum', 'lft', 'ccf', 'cpf', 'cff', 'lisr', 'liva', 'lss', 'ccom', 'lgsm', 'cnpp', 'cfpc', 'lfpc', 'lgtaip'];

interface GlobalIndex {
  generado: string;
  coleccion: string;
  instrumentos: Record<string, { nombre: string; asset: string; snapshots: number; materia?: string | null; vigencia?: string | null; resumen?: string | null }>;
}

interface IndexEntry {
  archivo: string;
  fecha_publicacion: string;
  codNota?: number | null;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const outDir = resolve(arg('out', 'public/legal-corpus')!);
const cacheDir = resolve(arg('cache', join(tmpdir(), 'lexmx-legalia-cache'))!);
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

async function download(name: string): Promise<Buffer> {
  const cached = join(cacheDir, name);
  if (existsSync(cached)) return readFileSync(cached);
  const url = `${RELEASE_BASE}/${name}`;
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'LexMX-corpus-import/1.0' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(cached, buf);
  return buf;
}

function extractTgz(tgz: Buffer, slug: string): string {
  const dir = join(cacheDir, 'x', slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const file = join(cacheDir, `${slug}.tgz`);
  if (!existsSync(file)) writeFileSync(file, tgz);
  execFileSync('tar', ['-xzf', file, '-C', dir]);
  return join(dir, slug);
}

function latestSnapshot(dir: string): { file: string; index: IndexEntry[] } {
  const indexPath = join(dir, 'indice.json');
  const index: IndexEntry[] = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];
  const byDate = (a: string) => {
    const m = /^(\d{2})-(\d{2})-(\d{4})(?:-(\d+))?\.md$/.exec(a);
    return m ? `${m[3]}${m[2]}${m[1]}${(m[4] ?? '0').padStart(3, '0')}` : '';
  };
  const candidates = index.length
    ? index.map((e) => e.archivo)
    : readdirSync(dir).filter((f) => /^\d{2}-\d{2}-\d{4}(-\d+)?\.md$/.test(f));
  const file = candidates.sort((a, b) => byDate(a).localeCompare(byDate(b))).at(-1);
  if (!file) throw new Error(`No snapshot found in ${dir}`);
  return { file: join(dir, file), index };
}

async function main() {
  const global: GlobalIndex = JSON.parse(gunzipSync(await download('indice-global.json.gz')).toString('utf8'));
  const requested = flag('all')
    ? Object.keys(global.instrumentos)
    : (arg('slugs') ?? DEFAULT_SLUGS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);

  const entries: ReturnType<typeof corpusIndexEntry>[] = [];
  const failures: string[] = [];
  for (const slug of requested) {
    const meta = global.instrumentos[slug];
    if (!meta) {
      failures.push(`${slug}: not in indice-global (coleccion ${global.coleccion})`);
      continue;
    }
    try {
      const dir = extractTgz(await download(meta.asset), slug);
      const { file, index } = latestSnapshot(dir);
      const dates = index.map((e) => e.fecha_publicacion).filter(Boolean);
      const sorted = [...dates].sort((a, b) => (a.split('-').reverse().join('') < b.split('-').reverse().join('') ? -1 : 1));
      const instrument: InstrumentMeta = {
        slug,
        nombre: meta.nombre,
        materia: meta.materia,
        vigencia: meta.vigencia,
        resumen: meta.resumen,
        fechaPublicacion: sorted.at(-1),
        fechaOriginal: sorted[0],
        totalSnapshots: meta.snapshots,
      };
      const doc = toLegalDocument(instrument, readFileSync(file, 'utf8'));
      const json = JSON.stringify(doc);
      writeFileSync(join(outDir, `${slug}.json`), json);
      entries.push(corpusIndexEntry(doc, Buffer.byteLength(json)));
      console.log(`✓ ${slug.padEnd(8)} ${doc.content.filter((c) => c.type === 'article').length.toString().padStart(5)} artículos  ${doc.status.padEnd(9)} ${doc.title}`);
    } catch (error) {
      failures.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const buildDate = new Date().toISOString();
  const count = (key: 'type' | 'primaryArea' | 'hierarchy') =>
    entries.reduce<Record<string, number>>((acc, e) => ({ ...acc, [String(e[key])]: (acc[String(e[key])] ?? 0) + 1 }), {});
  writeFileSync(
    join(outDir, 'index.json'),
    JSON.stringify({ version: '2.0.0', buildDate, source: { name: 'LegalIA scjn-leyes', generado: global.generado, url: RELEASE_BASE }, documents: entries }, null, 2),
  );
  writeFileSync(
    join(outDir, 'metadata.json'),
    JSON.stringify(
      {
        version: '2.0.0',
        buildDate,
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
    console.error(`\n${failures.length} fallos:\n  ${failures.join('\n  ')}`);
    process.exitCode = flag('all') ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
