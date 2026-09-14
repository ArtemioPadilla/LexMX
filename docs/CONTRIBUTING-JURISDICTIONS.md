# Añadir una jurisdicción (país) a LexMX

Una jurisdicción es un módulo en `src/jurisdictions/<cc>/` que implementa el
contrato `Jurisdiction` de `src/jurisdictions/types.ts` y una línea en el
registro `src/jurisdictions/index.ts`. Nada específico de un país vive fuera
de su módulo (plan § 11.2).

## 1. Módulo

```
src/jurisdictions/<cc>/
  index.ts          # Jurisdiction: entidades, jerarquía, fuentes, citas, marco legal
  calculators.ts    # opcional: calculadoras deterministas con parámetros fechados
```

- `entities`: divisiones subnacionales con código ISO 3166-2 (o el oficial local).
- `hierarchy`: niveles 1..n con ejemplos reales (1 = norma suprema).
- `sources`: fuentes abiertas con `access` (`open-api`, `open-download`,
  `scraping`, `licensed`, `unverified`) y `verifyUrl` con `{id}` cuando exista.
  Marca `unverified` mientras no se haya comprobado el acceso programático.
- `citation`: usa `makeCitationStyle` de `_shared/citation.ts` (español o
  portugués) con la Constitución, los encabezados de instrumento y los
  patrones de resoluciones del país. México tiene estilo propio (tesis).
- `legal`: ley de protección de datos, autoridad y aviso que acompaña cada
  respuesta.
- `calculators`: cada calculadora declara `fields`, `parameters` con
  `asOf` y `source`, y `compute` que devuelve líneas con `basis` (artículo).

## 2. Pruebas

`src/jurisdictions/__tests__/latam.test.ts` valida el contrato para todos los
países (entidades únicas, jerarquía consecutiva, fuentes con URL, aviso con
"fuente oficial"). Añade casos de citas reales del país y, si hay
calculadoras, casos con cifras verificables.

## 3. Corpus

El corpus de un país es un shard `<cc>-<ámbito>` (`parseCorpusScope`).
El adaptador de importación vive en `scripts/corpus/` y escribe el mismo
formato que `import-legalia.ts` (`LegalDocument` con `jurisdiction: '<cc>'`,
`officialUrl` y un chunk por `content[i]`; ver `docs/DATA-COMPATIBILITY.md`).
Publica el shard como release y agrega el caso al benchmark `evals/`.

## 4. Interfaz

Con el módulo registrado, el selector de jurisdicción del chat y de
`/herramientas` lo muestra solo. Las respuestas se filtran por
`corpusFilter.jurisdiction`; sin shard, el país aparece como "corpus
pendiente".

## 5. Lista de verificación

- [ ] Fuentes verificadas o marcadas `unverified` con nota.
- [ ] Citas: formato y parser con pruebas.
- [ ] Ley de privacidad y autoridad correctas.
- [ ] Sin nombres de competidores ni datos personales.
- [ ] `npm run check` verde.
