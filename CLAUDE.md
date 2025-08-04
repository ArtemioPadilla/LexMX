# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LexMX is a Mexican legal AI assistant that combines the complete Mexican legal corpus with RAG (Retrieval Augmented Generation) technology to provide accurate, contextualized legal responses. The project is designed as a fully static application deployed on GitHub Pages, optimized for privacy and cost efficiency.

**Key Technologies:** Astro, React Islands, TypeScript, Tailwind CSS, Multi-LLM integration (OpenAI, Claude, Gemini, AWS Bedrock)

## Development Commands

Currently, the project is in the planning/documentation phase. Once the codebase is established, these commands are expected to be available:

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

### Directory Structure (Planned)
```
src/
├── pages/              # Astro routes
├── components/         # Static Astro components
├── islands/            # Interactive React components
├── lib/
│   ├── rag/           # RAG engine core
│   ├── llm/           # Multi-LLM management
│   ├── legal/         # Mexican legal processing
│   └── storage/       # Hybrid storage system
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
   - **NEW**: Contextual chunking with legal structure preservation
   - **NEW**: Configurable chunking strategies (semantic, hierarchical, entity-aware)
   - **NEW**: Dynamic chunk sizing based on content type

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

5. **Case Management** (`lib/case-management/`) - **NEW**:
   - Case workspace creation and organization
   - Document library with multi-file upload
   - Document sets for selective analysis
   - Timeline and deadline tracking
   - Party and evidence management
   - Notes and annotations system

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
1. Place document JSON in `src/data/legal-corpus/`
2. Run `npm run build:embeddings` to generate vectors
3. Update legal classification in `src/lib/legal/classifier.ts`
4. Add to document registry

### Integrating New LLM Provider
1. Create provider class in `src/lib/llm/providers/`
2. Implement standard interface with error handling
3. Add cost calculation logic
4. Update selection algorithm

### Legal Query Enhancement
1. Analyze query patterns in `src/lib/legal/classifier.ts`
2. Add specialized prompts in `src/data/configs/prompt-templates.json`
3. Update chunking strategy for specific legal areas
4. Test against known legal precedents

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

## Future Development

### Planned Features
- State-level legal documents
- PDF document analysis
- Legal document templates
- Real-time legal updates

### Scalability Considerations
- Modular architecture for legal area expansion
- Provider-agnostic LLM integration
- Efficient vector storage scaling
- Legal corpus versioning system