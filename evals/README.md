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
