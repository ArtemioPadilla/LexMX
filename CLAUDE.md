# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LexMX is a Mexican legal AI assistant that combines the complete Mexican legal corpus with RAG (Retrieval Augmented Generation) technology to provide accurate, contextualized legal responses. The project is designed as a fully static application deployed on GitHub Pages, optimized for privacy and cost efficiency.

**Key Technologies:** Astro, React Islands, TypeScript, Tailwind CSS, Multi-LLM integration (OpenAI, Claude, Gemini, AWS Bedrock)

## Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Legal corpus management
npm run build:corpus     # Download and process Mexican legal documents
npm run build:embeddings # Generate embeddings (requires API key)
npm run download:embeddings # Use pre-generated embeddings

# Quality assurance
npm run lint         # ESLint checking
npm run type-check   # TypeScript type checking
npm run test         # Run tests
npm run test:e2e     # End-to-end tests with Playwright
```

## Architecture Overview

### Islands Architecture with Astro
- **Static Components** (.astro): Header, Footer, Legal document viewers, Static content
- **Interactive Islands** (.tsx): ChatInterface, RAGEngine, TokenManager, DocumentUploader
- **Selective Hydration**: Only interactive components load JavaScript client-side

### Directory Structure
```
src/
├── pages/              # Astro routes
│   └── admin/         # Admin dashboards
├── components/         # Static Astro components
├── islands/            # Interactive React components
├── lib/
│   ├── rag/           # RAG engine core
│   │   └── chunking/  # Advanced chunking strategies
│   ├── llm/           # Multi-LLM management
│   ├── legal/         # Mexican legal processing
│   ├── storage/       # Hybrid storage system
│   ├── corpus/        # Document corpus loader
│   └── ingestion/     # Document ingestion pipeline
├── data/
│   ├── legal-corpus/  # Mexican legal documents
│   └── embeddings/    # Pre-computed vectors
└── workers/           # Web Workers for background processing
```

### Core Systems

1. **RAG Engine** (`lib/rag/`):
   - Hybrid search (semantic + keyword)
   - Legal document chunking and retrieval
   - Context optimization for Mexican law
   - Contextual chunking with legal structure preservation
   - Configurable chunking strategies (semantic, hierarchical, entity-aware)
   - Dynamic chunk sizing based on content type
   - **Real corpus document loading** from legal-corpus directory
   - **Automatic fallback** to mock documents when corpus is empty

2. **Multi-LLM Manager** (`lib/llm/`):
   - Cost-optimized provider selection
   - Intelligent routing based on query complexity
   - Fallback strategies

3. **Legal Processing** (`lib/legal/`):
   - Mexican legal document parsing
   - Query classification (civil, penal, laboral, fiscal, etc.)
   - Citation extraction and validation
   - **NEW**: Contradiction detection across documents
   - **NEW**: Legal issue spotting and argument building
   - **NEW**: Missing information detection

4. **Storage System** (`lib/storage/`):
   - Hybrid storage: IndexedDB + LocalStorage + SessionStorage
   - Semantic caching for similar queries
   - Token encryption (AES-256)
   - **NEW**: Case workspace storage and management
   - **NEW**: Document versioning and sets

5. **Case Management** (`lib/case-management/`):
   - Case workspace creation and organization
   - Document library with multi-file upload
   - Document sets for selective analysis
   - Timeline and deadline tracking
   - Party and evidence management
   - Notes and annotations system

6. **Document Ingestion Pipeline** (`lib/ingestion/`) - **NEW**:
   - **DocumentFetcher**: Downloads from official Mexican government sources
   - **DocumentParser**: Extracts structured content from PDFs/HTML/XML
   - **ContextualChunker**: Maintains legal context across chunks
   - **Real-time progress tracking** with stage-by-stage updates
   - **Official source validation** for government domains
   - **Batch processing** support for multiple documents

## Legal Domain Knowledge

### Mexican Legal Hierarchy
1. **Constitución Política** (Level 1)
2. **Treaties/International** (Level 2) 
3. **Federal Laws/Codes** (Level 3)
4. **Regulations** (Level 4)
5. **Official Standards (NOMs)** (Level 5)
6. **State Laws** (Level 6)
7. **Administrative Formats** (Level 7)

### Key Legal Areas Covered
- **Constitutional Law**: CPEUM, Amparo
- **Labor Law**: LFT, LSS, INFONAVIT
- **Civil Law**: CCF, Family law
- **Criminal Law**: CPF, CNPP
- **Tax Law**: CFF, LISR, LIVA
- **Commercial Law**: CCom, LGSM
- **Administrative Law**: LGRA, LGTAIP

### Legal Document Processing
- Documents are chunked maintaining legal structure (articles, sections)
- Legal citations are preserved and validated
- Jurisprudence and legal precedents are properly indexed
- Updates are tracked with reformation dates
- **Automated ingestion** from official sources (DOF, SCJN, Diputados)
- **Smart chunking** with contextual overlap and cross-references
- **Legal-aware parsing** that preserves article hierarchy

## API Integration

### Supported LLM Providers
- **OpenAI**: GPT-4 Turbo, GPT-4 (primary for complex legal analysis)
- **Anthropic Claude**: Claude-3.5-Sonnet (recommended for legal reasoning)
- **Google Gemini**: Gemini Pro (cost-effective option)
- **AWS Bedrock**: Enterprise deployment

### Token Management
- Client-side AES-256 encryption
- SessionStorage for security by default
- No server-side token storage
- Automatic cost tracking and limits

## Security & Privacy

### Data Protection
- All processing happens client-side
- No legal queries sent to servers
- GDPR/LFPDPPP compliance
- Encrypted token storage

### Legal Compliance
- Always includes disclaimers about professional legal advice
- Cites specific legal sources
- Warns about information currency
- Maintains audit trails for legal references

## Performance Optimization

### Caching Strategy
- Multi-level cache (memory → session → local → indexed)
- Semantic query matching for cache hits
- Legal document pre-loading for common queries
- Aggressive compression for legal text

### Cost Optimization
- Intelligent provider routing
- Context compression while preserving legal accuracy
- Token prediction and optimization
- Bulk processing for document updates

## Testing Strategy

### Test Categories
- **Unit Tests**: RAG engine, legal parsing, token management
- **Integration Tests**: Multi-LLM workflows, storage systems
- **E2E Tests**: Full legal query workflows
- **Legal Accuracy Tests**: Validation against known legal precedents

## Deployment

### GitHub Pages Configuration
- Fully static build with Astro
- Automatic deployment on push to main
- Pre-built legal corpus and embeddings
- CDN optimization for legal documents

### Environment Variables
```bash
# Optional for corpus building
OPENAI_API_KEY=sk-...          # For embedding generation
CLAUDE_API_KEY=sk-ant-...      # For legal validation
```

## Code Quality Standards

### TypeScript Configuration
- Strict mode enabled
- Legal-specific type definitions
- Interface-driven development
- Comprehensive error handling

### Legal Content Standards
- Always cite specific articles and laws
- Include reformation dates
- Validate legal citations
- Maintain source traceability

## Advanced User Features

### Power User Configuration
When implementing advanced features, ensure:
- **Developer Mode**: Toggle to show/hide advanced features
- **RAG Configuration Panel**: Visual controls for all parameters
- **Performance Metrics**: Real-time display of token usage, latency, costs
- **Query Execution Plan**: Transparent view of how queries are processed
- **Custom Prompts**: Allow users to save and reuse custom prompt templates

### Case Management Implementation
For case management features:
- Use IndexedDB for large document storage
- Implement file chunking for uploads over 10MB
- Support drag-and-drop for file uploads
- Maintain document relationships and versions
- Ensure all analysis respects document set boundaries

### Advanced RAG Strategies
When implementing advanced chunking:
```typescript
interface ChunkingStrategy {
  type: 'fixed' | 'semantic' | 'contextual' | 'hierarchical' | 'entity-aware';
  config: {
    minSize: number;  // 128 tokens minimum
    maxSize: number;  // 2048 tokens maximum
    overlap: number;  // 0-50% overlap
    preserveStructure: boolean;
    preserveEntities: boolean;
    preserveCitations: boolean;
  };
}
```

## Common Development Tasks

### Adding New Legal Documents

#### Method 1: Manual Upload (Recommended for single documents)
1. Navigate to `/admin/documents`
2. Upload PDF/TXT file or enter official URL
3. System automatically:
   - Validates source (checks if from official domain)
   - Parses document structure
   - Creates contextual chunks
   - Generates embeddings
   - Stores in corpus

#### Method 2: Document Request System
1. Create request at `/requests/new`
2. Provide document details and official source
3. Community votes on priority
4. Approved documents are automatically ingested

#### Method 3: Batch Processing (For corpus updates)
1. Place document JSON in `public/legal-corpus/`
2. Run `npm run build:embeddings` to generate vectors
3. Documents are automatically loaded on next startup

### Integrating New LLM Provider
1. Create provider class in `src/lib/llm/providers/`
2. Implement standard interface with error handling
3. Add cost calculation logic
4. Update selection algorithm

### Legal Query Enhancement
1. Analyze query patterns in `src/lib/legal/classifier.ts`
2. Update prompts in i18n files (`src/i18n/locales/[es|en].json`)
3. Use PromptBuilder for centralized prompt management
4. Update chunking strategy for specific legal areas
5. Test against known legal precedents

## Internationalization (i18n) Guide

### Overview
LexMX uses a **dual translation system** to support both static and dynamic content:
1. **Client-side translations** for interactive components (React islands)
2. **Data attributes** for static Astro pages

### Translation Systems

#### 1. Client-Side Translations (React Components)
For React components and islands, use the `useTranslation` hook:

```typescript
import { useTranslation } from '../i18n/index';

export default function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
      <p>{t('myComponent.description', { count: 5 })}</p>
    </div>
  );
}
```

**When to use**: 
- React components (`.tsx` files)
- Interactive islands
- Dynamic content that changes based on user interaction

#### 2. Data Attributes (Astro Pages)
For static Astro pages, use `data-i18n` attributes:

```astro
<h1 data-i18n="page.title">Título en Español</h1>
<p data-i18n="page.description">Descripción en español</p>
```

The `ClientTranslations.astro` script automatically replaces content based on selected language.

**When to use**:
- Static Astro pages (`.astro` files)
- Server-rendered content
- SEO-critical content that needs to be in the HTML

### Adding New Translations

#### Step 1: Add Translation Keys
Edit both language files:
- `src/i18n/locales/en.json` (English)
- `src/i18n/locales/es.json` (Spanish)

```json
{
  "myFeature": {
    "title": "My Feature Title",
    "description": "Feature description",
    "actions": {
      "save": "Save",
      "cancel": "Cancel"
    }
  }
}
```

#### Step 2: Use in Components

**React Component**:
```typescript
const { t } = useTranslation();
return <h1>{t('myFeature.title')}</h1>;
```

**Astro Page**:
```astro
<h1 data-i18n="myFeature.title">Mi Característica</h1>
```

### Common Pitfalls & Solutions

#### 1. Hydration Mismatches
**Problem**: Server renders Spanish, client renders English, causing hydration errors.

**Solution**: Remove internal hydration boundaries in components:
```typescript
// ❌ Don't do this
if (!isHydrated) {
  return <LoadingState />;
}

// ✅ Do this
const { t } = useTranslation();
return <div>{t('key')}</div>;
```

#### 2. Missing Translation Keys
**Problem**: Console shows "Translation key not found" errors.

**Solution**: 
1. Ensure keys exist in both `en.json` and `es.json`
2. Use consistent key paths
3. Fallback to Spanish if English key missing

#### 3. HTML Content in Translations
**Problem**: HTML tags show as text instead of rendering.

**Solution**: The `ClientTranslations` script detects HTML and uses `innerHTML`:
```javascript
if (value.includes('<') && value.includes('>')) {
  element.innerHTML = value;
} else {
  element.textContent = value;
}
```

#### 4. Dynamic Parameters
Use placeholders for dynamic content:
```json
{
  "welcome": "Welcome, {{name}}!",
  "items": "You have {{count}} items"
}
```

```typescript
t('welcome', { name: 'Juan' })
t('items', { count: 5 })
```

### Testing Translation Coverage

1. **Visual Testing**: Switch languages and verify all text updates
2. **Console Check**: Look for "Translation key not found" warnings
3. **Automated Tests**: Run `npm test src/i18n/__tests__/i18n-validation.test.ts`

### Best Practices

1. **Consistent Key Naming**:
   - Use dot notation: `section.subsection.key`
   - Group related translations
   - Use descriptive key names

2. **Fallback Strategy**:
   - Spanish as primary language
   - English falls back to Spanish if key missing
   - Show key name as last resort

3. **Performance**:
   - Translations load once on initialization
   - Language changes trigger re-render only where needed
   - Use localStorage for persistence

4. **Maintenance**:
   - Keep both language files in sync
   - Document new translation keys
   - Test both languages when adding features

### System Prompts with i18n

#### Architecture
- **Centralized Prompt Builder**: `src/lib/llm/prompt-builder.ts`
- **Internationalized Prompts**: Stored in `src/i18n/locales/[es|en].json`
- **Dynamic Language Support**: Prompts adapt to user's selected language
- **Provider Optimization**: Each LLM provider can access optimized prompts

#### Adding/Modifying Prompts
1. Edit `systemPrompts` section in both `es.json` and `en.json`
2. Ensure consistent placeholder format (`{{variableName}}`)
3. Run tests: `npm test src/i18n/__tests__/i18n-validation.test.ts`
4. All providers automatically use updated prompts

#### Prompt Structure
```json
{
  "systemPrompts": {
    "base": { /* Core prompt components */ },
    "specializations": { /* Legal area-specific prompts */ },
    "queryTemplates": { /* Query formatting templates */ },
    "legalWarning": "...",
    "recommendedActions": { /* Query type-specific actions */ }
  }
}
```

## Mexican Legal Specifics

### Citation Formats
- Constitutional: "Artículo 123 constitucional"
- Legal: "Artículo 47 de la Ley Federal del Trabajo"
- Jurisprudence: "Tesis 1a./J. 15/2019"
- Regulations: "Artículo 15 del RLFT"

### Legal Language Processing
- Spanish legal terminology
- Formal legal writing style
- Mexican legal system structure
- Constitutional hierarchy respect

## Monitoring & Analytics

### Performance Metrics
- Query response time
- Cache hit rates
- Cost per query
- Legal accuracy scores

### User Privacy
- No personal data collection
- Anonymous usage patterns only
- Local storage of preferences
- No query logging

## Document Ingestion & Management

### Admin Dashboard (`/admin/documents`)
- **Real-time ingestion monitoring** with progress bars
- **Document statistics** (total docs, chunks, embeddings)
- **Recent activity tracking**
- **Quality metrics** for ingested documents

### Ingestion Pipeline Features

#### Supported Sources
- **Official Government Sites**:
  - dof.gob.mx (Diario Oficial de la Federación)
  - scjn.gob.mx (Suprema Corte de Justicia)
  - diputados.gob.mx (Cámara de Diputados)
  - senado.gob.mx (Senado de la República)
  - sat.gob.mx (SAT)
  - imss.gob.mx (IMSS)
  - infonavit.org.mx

#### Processing Stages
1. **Fetching**: Downloads from URL or processes uploaded file
2. **Parsing**: Extracts structure (titles, chapters, articles)
3. **Chunking**: Creates contextual chunks with overlap
4. **Embedding**: Generates vectors using Transformers.js
5. **Storing**: Saves to IndexedDB and corpus

#### Chunking Strategies
- **Hierarchical**: Preserves document structure
- **Contextual**: Maintains surrounding context
- **Cross-referenced**: Links related articles
- **Legal-aware**: Respects article boundaries

### API Endpoints (Planned)
```typescript
// Document ingestion
POST /api/ingest/url      // Ingest from URL
POST /api/ingest/file     // Ingest uploaded file
GET  /api/ingest/status   // Check ingestion status

// GitHub integration
POST /api/github/issue    // Create document request issue
GET  /api/github/requests // List pending requests
```

## Future Development

### Planned Features
- State-level legal documents
- PDF document analysis with OCR
- Legal document templates
- Real-time legal updates from RSS feeds
- GitHub Actions automation for corpus updates
- WebHook receivers for partner organizations

### Scalability Considerations
- Modular architecture for legal area expansion
- Provider-agnostic LLM integration
- Efficient vector storage scaling
- Legal corpus versioning system