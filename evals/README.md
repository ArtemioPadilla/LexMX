# Evaluación de recuperación (plan § 11.4 F, benchmark abierto)

Un conjunto por corpus: `mx-federal/` (México, línea base en `evals/baseline.json`) y
`cl-nacional/` (Chile, `evals/cl-nacional/baseline.json`, corpus de
`npm run corpus:import:cl`). `npm run eval:retrieval:cl -- --corpus … --embeddings …`
corre el chileno; `--cases` y `--baseline` eligen cualquier otro.

`mx-federal/retrieval.jsonl`: una línea por caso, con la pregunta en lenguaje
natural y el artículo que debe aparecer entre los primeros resultados. Los
casos cubren la Constitución y las leyes federales de la oleada 1 (laboral,
fiscal, civil, penal, mercantil, consumidor, transparencia).

```bash
# corpus y embeddings como los publica corpus-update.yml
npm run corpus:import -- --out build/corpus/legal-corpus
npm run corpus:embeddings -- --corpus build/corpus/legal-corpus --out build/corpus/embeddings
npm run eval:retrieval -- --corpus build/corpus/legal-corpus --embeddings build/corpus/embeddings
```

Reporta `recall@1`, `recall@5`, `recall@10` y MRR (documento correcto y
artículo correcto por separado), por área y en total, y escribe
`evals/results/<fecha>.json`. Los casos cuyo artículo no existe en el corpus
cargado se reportan como `missing` y no cuentan.

Reglas:

- Un caso nuevo cita el artículo exacto; se verifica contra el texto oficial
  antes de añadirlo.
- La métrica que gobierna el ratchet de calidad de recuperación es
  `recall@5` por artículo: solo puede subir (`evals/baseline.json`).
- Los cambios de modelo de embeddings o de chunking se justifican con este
  benchmark en el PR.

## Reglas de ranking (compartidas con el motor)

El benchmark aplica las mismas reglas que `src/lib/rag/ranking.ts` y que
`CorpusInstaller`/`build-embeddings` al construir el índice:

- Solo se indexan secciones de tipo `article`; títulos y capítulos son
  navegación y desplazaban artículos reales en consultas cortas.
- Los artículos transitorios (marcados `transitory: true` por el pipeline)
  se penalizan ×0.92 para que no superen al texto permanente que reforman.
- Re-ranking léxico sobre los 60 mejores por coseno: + 0.08 × fracción de
  términos de la consulta presentes en el chunk y + 0.06 si la consulta nombra
  el número de artículo del chunk (`rerankLexical`). Subió el recall@5 por
  artículo de 0.81 a 0.88 en México y de 0.71 a 0.79 en Chile sin tocar el modelo.
- Las consultas llevan el prefijo `query: ` de multilingual-e5 (el corpus se
  embebe como pasajes sin prefijo); el motor hace lo mismo con
  `embedQuery`.

## Resultados

| Fecha | Corpus | doc recall@5 | art recall@5 | art recall@10 | Archivo |
|---|---|---|---|---|---|
| 2026-09-14 | 14 leyes | 1.00 | 0.79 | 0.93 | `results/mx-federal-2026-09-14.json` |
| 2026-09-14 | 39 leyes, solo artículos, transitorios ×0.92 | 0.98 | 0.81 | 0.93 | `results/mx-federal-39-2026-09-14.json` |
| 2026-09-14 | Chile, 11 normas (24 casos) | 1.00 | 0.71 | 0.83 | `results/cl-nacional-2026-09-14.json` |
| 2026-09-14 | 39 leyes + re-ranking léxico | 1.00 | 0.88 | 0.91 | `results/mx-federal-39-lexical-2026-09-14.json` |
| 2026-09-14 | Chile + re-ranking léxico | 1.00 | 0.79 | 0.92 | `results/cl-nacional-lexical-2026-09-14.json` |

Lo que queda por debajo (fiscal en México, penal en Chile) son artículos
vecinos con numeración compuesta y textos largos partidos en varias partes.
Siguiente palanca: embeddings afinados en español jurídico (línea F).
