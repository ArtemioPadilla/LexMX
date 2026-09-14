# Evaluación de recuperación (plan § 11.4 F, benchmark abierto)

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
- Las consultas llevan el prefijo `query: ` de multilingual-e5 (el corpus se
  embebe como pasajes sin prefijo); el motor hace lo mismo con
  `embedQuery`.

## Resultados

| Fecha | Corpus | doc recall@5 | art recall@5 | art recall@10 | Archivo |
|---|---|---|---|---|---|
| 2026-09-14 | 14 leyes | 1.00 | 0.79 | 0.93 | `results/mx-federal-2026-09-14.json` |
| 2026-09-14 | 39 leyes, solo artículos, transitorios ×0.92 | 0.98 | 0.81 | 0.93 | `results/mx-federal-39-2026-09-14.json` |

Las áreas más débiles son fiscal (0.60) y administrativa (0/2): el modelo
`e5-small` confunde artículos vecinos con numeración compuesta (`17-H`,
`93`) y las consultas de transparencia. Candidatos: embeddings afinados en
español jurídico (línea F) y re-ranking léxico por número de artículo.
