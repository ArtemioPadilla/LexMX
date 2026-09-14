# Programa de comunidad: despachos aliados y estudiantes (plan § 11.4 G)

LexMX crece con quien lo usa. Dos programas, sin costo, con reglas claras
sobre qué se recibe y qué se pide.

## Despachos aliados

**Qué recibe un despacho**

- LexMX completo en sus equipos (local-first) y LexMX Escritorio.
- Una organización en LexMX Servidor con asientos para su equipo cuando el
  servidor esté activo (`/cuenta`).
- Prioridad en la cola de leyes estatales y materias de su práctica
  (`/requests`).
- Aparecer en el directorio verificado por materia y entidad (línea D)
  cuando exista, con el consentimiento explícito del despacho.

**Qué se pide**

- Diez casos reales anonimizados al trimestre para el benchmark de
  recuperación (`evals/`): pregunta, ley y artículo esperado. Nunca datos de
  clientes; el formato es el de `evals/mx-federal/retrieval.jsonl`.
- Reportar respuestas incorrectas con el botón de retroalimentación
  (`AIFeedback`) o con el FAB de reporte; cada reporte se vuelve un issue con
  diagnóstico prellenado.
- Revisar, cuando puedan, las plantillas de su materia (`/plantillas`) y las
  calculadoras (`/herramientas`) contra su práctica.

**Cómo entrar**: abre un issue con la plantilla "Despacho aliado" indicando
materia principal, entidad y tamaño del equipo. No se comparte nada
confidencial en el issue.

## Estudiantes y clínicas jurídicas

**Qué recibe**

- Todo LexMX, sin cuenta, en su equipo; con cuenta de estudiante, acceso a
  las funciones de equipo del servidor para su clínica.
- Un camino de contribución guiado: primero casos de benchmark, luego
  jurisdicciones (`docs/CONTRIBUTING-JURISDICTIONS.md`), luego plantillas y
  calculadoras por país.
- Reconocimiento en el archivo de contribuidores y en la página de cada
  jurisdicción que ayudaron a construir.

**Qué se pide**

- Casos de benchmark de sus materias (mismo formato que arriba).
- Un módulo de jurisdicción o una plantilla por semestre para quien quiera
  ir más lejos; los PRs pasan por `npm run check` como cualquier otro.

**Cómo entrar**: issue con la plantilla "Clínica / estudiante" con
universidad, materia y semestre. Las clínicas pueden pedir una sesión de
arranque.

## Reglas que aplican a ambos

1. **Nada confidencial entra al repositorio.** Casos anonimizados, sin
   nombres, sin números de expediente reales.
2. **Orientación, no asesoría.** LexMX no sustituye al abogado; los
   programas no crean relación profesional con el proyecto.
3. **Ética antes que métricas.** Ninguna contribución de analítica de
   criterios entra sin la compuerta de `docs/ETHICS.md`.
4. **Crédito y licencia.** Contribuciones bajo la licencia del repositorio;
   el crédito es público salvo que se pida lo contrario.

## Benchmark comunitario

`evals/` publica por corpus el conjunto de casos y el resultado del último
run (`npm run eval:retrieval`). Los aliados pueden proponer casos por PR;
el umbral de `evals/baseline.json` solo sube. Cuando existan corpus de otros
países, cada uno tendrá su carpeta y su línea base.
