# LexMX como fuente (servidor MCP local)

Expone el corpus legal abierto a cualquier cliente MCP sin nube ni cuenta:
búsqueda semántica con el mismo modelo del cliente web, texto íntegro de
artículos y lista de documentos. Todo corre en tu máquina.

```bash
npm run corpus:import -- --out build/corpus/legal-corpus
npm run corpus:embeddings -- --corpus build/corpus/legal-corpus --out build/corpus/embeddings
npm run mcp -- --corpus build/corpus/legal-corpus --embeddings build/corpus/embeddings
```

Configuración de ejemplo para Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "lexmx": {
      "command": "node",
      "args": ["--experimental-strip-types", "/ruta/a/LexMX/scripts/mcp/server.ts", "--corpus", "/ruta/a/LexMX/build/corpus/legal-corpus", "--embeddings", "/ruta/a/LexMX/build/corpus/embeddings"]
    }
  }
}
```

Herramientas: `search_corpus` (`query`, `limit`, `documentIds`), `get_article`
(`documentId`, `article`), `list_documents`. Cada resultado trae la cita en
formato mexicano y el enlace oficial en la SCJN para verificar.

La versión hospedada de esta misma API vive en `supabase/functions/search`
(plan § 11.9); el protocolo es el mismo.
