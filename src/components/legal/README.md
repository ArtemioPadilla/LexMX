# Sistema de Visualización de Documentos Legales - LexMX

Este directorio contiene el sistema completo de visualización de documentos legales para LexMX, diseñado específicamente para el sistema legal mexicano con integración RAG y características avanzadas.

## Arquitectura General

### 🏗️ Estructura de Componentes

```
src/components/legal/
├── DocumentTextView.tsx         # Vista principal de texto estructurado
├── DocumentPDFView.tsx          # Visor de PDF integrado
├── DocumentChunksView.tsx       # Vista de chunks para análisis RAG
├── DocumentMetadataView.tsx     # Panel de metadatos y linaje
├── DocumentNavigation.tsx       # Navegación jerárquica lateral
├── DocumentSearch.tsx           # Búsqueda inteligente en documento
├── DocumentExport.tsx           # Exportación multi-formato
├── ViewModeSelector.tsx         # Selector de modo de vista
├── BreadcrumbNavigation.tsx     # Navegación tipo breadcrumb
└── README.md                    # Esta documentación
```

### 🔗 Integración con el Sistema

```
src/pages/document/[...slug].astro    # Rutas dinámicas
src/islands/DocumentViewer.tsx        # Componente principal hidratado
src/lib/document-viewer/              # Lógica de integración RAG
src/styles/legal-components.css       # Estilos especializados
```

## Características Principales

### 📄 Múltiples Vistas de Visualización

1. **Vista de Texto** (`DocumentTextView`)
   - Renderizado jerárquico respetando la estructura legal
   - Highlighting de términos de búsqueda
   - Navegación por artículos/secciones
   - Modo de enfoque para secciones específicas

2. **Vista PDF** (`DocumentPDFView`)
   - Visor PDF integrado con controles de zoom
   - Navegación por páginas
   - Descarga y impresión
   - Fallback a generación desde texto

3. **Vista de Chunks** (`DocumentChunksView`)
   - Visualización de chunks para análisis RAG
   - Filtrado por tipo de contenido
   - Métricas de texto y relevancia
   - Expansión/contracción de chunks

4. **Vista de Metadatos** (`DocumentMetadataView`)
   - Información completa del documento
   - Linaje y dependencias
   - Estadísticas de contenido
   - Datos técnicos del procesamiento

### 🔍 Sistema de Búsqueda Avanzada

- **Búsqueda en tiempo real** con debouncing
- **Historial de búsquedas** persistente
- **Highlighting** de términos encontrados
- **Sugerencias contextuales** para el sistema legal mexicano
- **Resultados con scoring** de relevancia

### 🧭 Navegación Inteligente

- **Navegación jerárquica** respetando la estructura legal
- **Breadcrumbs** contextuales con estado del documento
- **Indicadores de jerarquía** por niveles legales
- **Expansión/contracción** de secciones
- **Navegación por teclado** con atajos

### 📤 Exportación Multi-formato

Formatos soportados:
- **PDF** - Documento completo con formato legal
- **Word (DOCX)** - Editable para análisis
- **HTML** - Con estilos y estructura preservada
- **Markdown** - Para documentación técnica
- **JSON** - Datos estructurados completos
- **Texto plano** - Para análisis de texto

### 🎨 UX/UI Optimizada

#### Diseño Responsive
- **Desktop**: Sidebar de navegación + contenido principal
- **Tablet**: Navegación colapsable con overlay
- **Mobile**: FAB para navegación + vista optimizada

#### Accesibilidad (A11y)
- **Navegación por teclado** completa
- **Screen reader** friendly
- **Alto contraste** soportado
- **Reducción de movimiento** respetada
- **Focus indicators** visibles

#### Temas
- **Modo claro/oscuro** automático
- **Colores jerárquicos** por nivel legal
- **Tipografía legal** optimizada (Georgia/Times)

## Integración RAG

### 🔧 Funcionalidades RAG

El sistema incluye integración completa con el motor RAG:

```typescript
// Generación de chunks
const ragIntegration = new DocumentRAGIntegration(document);
const chunks = ragIntegration.generateChunks({
  maxChunkSize: 1000,
  overlapSize: 100,
  preserveStructure: true
});

// Búsqueda semántica
const results = await ragIntegration.semanticSearch(query, {
  topK: 5,
  minScore: 0.1,
  filterTypes: ['article', 'paragraph']
});

// Extracción de contexto
const context = ragIntegration.extractContext(sectionId, {
  contextWindow: 2,
  includeHierarchy: true
});
```

### 📊 Características RAG

- **Chunking inteligente** preservando estructura legal
- **Embeddings** por sección/artículo
- **Búsqueda semántica** dentro del documento
- **Contexto jerárquico** para mejor comprensión
- **Scoring de relevancia** optimizado para contenido legal

## Uso del Sistema

### 🚀 Implementación Básica

```astro
---
// En una página Astro
import DocumentViewer from '../islands/DocumentViewer.tsx';
import type { LegalDocument } from '../types/legal';

const document: LegalDocument = await loadDocument(documentId);
---

<DocumentViewer 
  document={document}
  initialView="text"
  initialSection={null}
  client:load 
/>
```

### ⚙️ Configuración de Rutas

Las rutas se generan automáticamente:
- `/document/[id]` - Vista principal
- `/document/[id]/text` - Vista de texto
- `/document/[id]/pdf` - Vista PDF
- `/document/[id]/chunks` - Vista de chunks
- `/document/[id]/metadata` - Vista de metadatos
- `/document/[id]/article/[number]` - Artículo específico

### 🎯 Personalización

```typescript
// Configuración de vista
const viewerConfig = {
  showSidebar: true,
  defaultView: 'text',
  enableExport: true,
  enableSearch: true,
  highlightMode: 'semantic'
};

// Configuración RAG
const ragConfig = {
  maxChunkSize: 1000,
  overlapSize: 100,
  preserveStructure: true,
  generateEmbeddings: true
};
```

## Estructura Legal Mexicana

### 📚 Jerarquía Soportada

1. **Nivel 1** - Constitución Política (Rojo)
2. **Nivel 2** - Tratados Internacionales (Naranja)
3. **Nivel 3** - Leyes Federales y Códigos (Ámbar)
4. **Nivel 4** - Reglamentos (Verde)
5. **Nivel 5** - Normas Oficiales (Cian)
6. **Nivel 6** - Leyes Estatales (Púrpura)
7. **Nivel 7** - Formatos Administrativos (Rosa)

### 🏷️ Tipos de Contenido

- **title** - Títulos principales
- **chapter** - Capítulos
- **section** - Secciones
- **article** - Artículos (núcleo del contenido legal)
- **paragraph** - Párrafos dentro de artículos
- **fraction** - Fracciones/incisos

### 📖 Formato de Citas

El sistema reconoce y formatea automáticamente:
- `Artículo 123 constitucional`
- `Artículo 47 de la Ley Federal del Trabajo`
- `Tesis 1a./J. 15/2019`
- `Artículo 15 del RLFT`

## Performance y Optimización

### ⚡ Características de Rendimiento

- **Lazy loading** de contenido pesado
- **Virtualización** para documentos grandes
- **Debouncing** en búsquedas
- **Caching** de resultados de búsqueda
- **Compresión** de datos JSON

### 💾 Gestión de Memoria

- **Cleanup** automático de resources
- **Blob URLs** para archivos generados
- **IndexedDB** para caché persistente
- **Web Workers** para procesamiento pesado

## Testing y Calidad

### 🧪 Estrategia de Testing

```bash
# Tests unitarios de componentes
npm run test:unit

# Tests de integración RAG
npm run test:integration

# Tests de accesibilidad
npm run test:a11y

# Tests de performance
npm run test:performance
```

### 📏 Métricas de Calidad

- **Lighthouse Score**: 95+ en todas las categorías
- **Core Web Vitals**: Cumplimiento completo
- **WCAG 2.1**: Nivel AA
- **Coverage**: 85%+ en código crítico

## Roadmap y Futuras Características

### 🔮 Próximas Funcionalidades

- [ ] **Comparación de versiones** side-by-side
- [ ] **Anotaciones colaborativas** en documentos
- [ ] **API REST** para integración externa
- [ ] **Sincronización offline** con service workers
- [ ] **Analytics** de uso y patrones de búsqueda
- [ ] **Machine Learning** para recomendaciones

### 🌟 Mejoras Planificadas

- [ ] **OCR** para documentos escaneados
- [ ] **Traducción automática** a lenguas indígenas
- [ ] **Voice search** para consultas habladas
- [ ] **AR/VR** para visualización inmersiva
- [ ] **Blockchain** para verificación de autenticidad

## Soporte y Mantenimiento

### 🆘 Solución de Problemas Comunes

1. **PDF no se muestra**: Verificar URL y permisos CORS
2. **Búsqueda lenta**: Verificar índices y caché
3. **Export falla**: Verificar permisos de descarga
4. **Navegación no responde**: Limpiar localStorage

### 📞 Contacto

Para soporte técnico o contribuciones:
- **Issues**: GitHub Issues del proyecto
- **Documentación**: `/docs` en el repositorio
- **Community**: Discord LexMX

---

**Desarrollado con ❤️ para el sistema legal mexicano**