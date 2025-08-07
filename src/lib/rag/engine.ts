// Main RAG engine for LexMX legal queries

import type { RAGConfig, RAGResponse, ProcessedQuery } from '@/types/rag';
import type { LLMRequest, LLMResponse, QueryContext } from '@/types/llm';
import type { LegalQuery, LegalResponse, LegalArea, QueryType } from '@/types/legal';

import { IndexedDBVectorStore } from '@/lib/storage/indexeddb-vector-store';
import { HybridSearchEngine } from './hybrid-search';
import { MexicanLegalDocumentProcessor } from '@/lib/legal/document-processor';
import { providerManager } from '@/lib/llm/provider-manager';

export interface RAGEngineConfig extends RAGConfig {
  enableCache: boolean;
  cacheExpiration: number; // in milliseconds
  maxContextLength: number;
  enableLegalValidation: boolean;
}

export class LegalRAGEngine {
  private vectorStore: IndexedDBVectorStore;
  private searchEngine: HybridSearchEngine;
  private documentProcessor: MexicanLegalDocumentProcessor;
  private cache: Map<string, { response: RAGResponse; timestamp: number }> = new Map();
  
  private config: RAGEngineConfig = {
    corpusPath: '/legal-corpus/',
    embeddingsPath: '/embeddings/',
    chunkSize: 512,
    chunkOverlap: 50,
    vectorDimensions: 1536,
    similarityThreshold: 0.7,
    maxResults: 5,
    enableCache: true,
    cacheExpiration: 24 * 60 * 60 * 1000, // 24 hours
    maxContextLength: 4000,
    enableLegalValidation: true
  };

  private initialized = false;

  constructor(config?: Partial<RAGEngineConfig>) {
    this.config = { ...this.config, ...config };
    this.vectorStore = new IndexedDBVectorStore();
    this.searchEngine = new HybridSearchEngine(this.vectorStore);
    this.documentProcessor = new MexicanLegalDocumentProcessor();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize vector store
      await this.vectorStore.initialize();
      
      // Initialize provider manager
      await providerManager.initialize();

      this.initialized = true;
      console.log('RAG Engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RAG Engine:', error);
      throw error;
    }
  }

  /**
   * Process a legal query and generate a response
   */
  async processLegalQuery(
    query: string,
    options: {
      legalArea?: LegalArea;
      queryType?: QueryType;
      maxResults?: number;
      includeReferences?: boolean;
      forceRefresh?: boolean;
      corpusFilter?: {
        areas?: LegalArea[];
        documents?: string[];
      };
    } = {}
  ): Promise<LegalResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Check cache first
      if (this.config.enableCache && !options.forceRefresh) {
        const cached = this.getCachedResponse(query);
        if (cached) {
          return {
            ...cached,
            fromCache: true,
            processingTime: Date.now() - startTime
          };
        }
      }

      // Process and analyze the query
      const processedQuery = await this.preprocessQuery(query, options.legalArea, options.queryType);

      // Retrieve relevant legal documents
      const searchResults = await this.retrieveRelevantDocuments(processedQuery, options.maxResults || 5);

      // Build legal context
      const context = this.buildLegalContext(searchResults, processedQuery);

      // Generate response using LLM
      const llmResponse = await this.generateLegalResponse(
        processedQuery,
        context,
        options.legalArea
      );

      // Create final legal response
      const legalResponse: LegalResponse = {
        answer: llmResponse.content,
        sources: searchResults.map(result => ({
          documentId: result.id,
          title: result.metadata?.title || 'Unknown Document',
          article: result.metadata?.article,
          excerpt: this.createExcerpt(result.content, 200),
          relevanceScore: result.score,
          hierarchy: result.metadata?.hierarchy || 7,
          url: result.metadata?.url,
          lastUpdated: result.metadata?.lastUpdated
        })),
        confidence: this.calculateConfidence(searchResults, llmResponse),
        queryType: processedQuery.queryType as QueryType,
        legalArea: (processedQuery.legalArea || 'constitutional') as LegalArea,
        processingTime: Date.now() - startTime,
        fromCache: false,
        legalWarning: this.generateLegalWarning(),
        recommendedActions: this.generateRecommendedActions(processedQuery.queryType as QueryType),
        relatedQueries: this.generateRelatedQueries(processedQuery)
      };

      // Cache the response
      if (this.config.enableCache) {
        this.cacheResponse(query, legalResponse);
      }

      return legalResponse;

    } catch (error) {
      console.error('Error processing legal query:', error);
      
      // Return error response
      return {
        answer: 'Lo siento, ocurrió un error al procesar tu consulta legal. Por favor, intenta nuevamente o consulta directamente con un abogado.',
        sources: [],
        confidence: 0,
        queryType: 'conceptual' as QueryType,
        legalArea: 'constitutional' as LegalArea,
        processingTime: Date.now() - startTime,
        fromCache: false,
        legalWarning: this.generateLegalWarning()
      };
    }
  }

  /**
   * Process a legal query with streaming response
   */
  async processLegalQueryStreaming(
    query: string,
    onChunk: (chunk: string) => void,
    options: {
      legalArea?: LegalArea;
      queryType?: QueryType;
      maxResults?: number;
      includeReferences?: boolean;
      forceRefresh?: boolean;
      corpusFilter?: {
        areas?: LegalArea[];
        documents?: string[];
      };
    } = {}
  ): Promise<LegalResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Check cache first
      if (this.config.enableCache && !options.forceRefresh) {
        const cached = this.getCachedResponse(query);
        if (cached) {
          // For cached responses, send the entire content at once
          onChunk(cached.answer);
          return {
            ...cached,
            fromCache: true,
            processingTime: Date.now() - startTime
          };
        }
      }

      // Process and analyze the query
      const processedQuery = await this.preprocessQuery(query, options.legalArea, options.queryType);

      // Retrieve relevant legal documents
      const searchResults = await this.retrieveRelevantDocuments(processedQuery, options.maxResults || 5);

      // Build legal context
      const context = this.buildLegalContext(searchResults, processedQuery);

      // Generate streaming response using LLM
      const llmResponse = await this.generateLegalResponseStreaming(
        processedQuery,
        context,
        onChunk,
        options.legalArea
      );

      // Create final legal response
      const legalResponse: LegalResponse = {
        answer: llmResponse.content,
        sources: searchResults.map(result => ({
          documentId: result.id,
          title: result.metadata?.title || 'Unknown Document',
          article: result.metadata?.article,
          excerpt: this.createExcerpt(result.content, 200),
          relevanceScore: result.score,
          hierarchy: result.metadata?.hierarchy || 7,
          url: result.metadata?.url,
          lastUpdated: result.metadata?.lastUpdated
        })),
        confidence: this.calculateConfidence(searchResults, llmResponse),
        queryType: processedQuery.queryType as QueryType,
        legalArea: (processedQuery.legalArea || 'constitutional') as LegalArea,
        processingTime: Date.now() - startTime,
        fromCache: false,
        legalWarning: this.generateLegalWarning(),
        recommendedActions: this.generateRecommendedActions(processedQuery.queryType as QueryType),
        relatedQueries: this.generateRelatedQueries(processedQuery)
      };

      // Cache the response
      if (this.config.enableCache) {
        this.cacheResponse(query, legalResponse);
      }

      return legalResponse;

    } catch (error) {
      console.error('Error processing legal query with streaming:', error);
      
      // Return error response
      return {
        answer: 'Lo siento, ocurrió un error al procesar tu consulta legal. Por favor, intenta nuevamente o consulta directamente con un abogado.',
        sources: [],
        confidence: 0,
        queryType: 'conceptual' as QueryType,
        legalArea: 'constitutional' as LegalArea,
        processingTime: Date.now() - startTime,
        fromCache: false,
        legalWarning: this.generateLegalWarning()
      };
    }
  }

  /**
   * Preprocess and analyze the legal query
   */
  private async preprocessQuery(
    query: string,
    legalArea?: LegalArea,
    queryType?: QueryType
  ): Promise<ProcessedQuery> {
    // Normalize query text
    const normalizedQuery = query.trim().toLowerCase();

    // Classify query type if not provided
    const detectedType = queryType || this.classifyQueryType(query);

    // Detect legal area if not provided
    const detectedArea = legalArea || this.detectLegalArea(query);

    // Extract legal entities (laws, articles, institutions)
    const entities = this.extractLegalEntities(query);

    // Determine query intent
    const intent = this.detectQueryIntent(query, detectedType);

    return {
      originalQuery: query,
      normalizedQuery,
      queryType: detectedType,
      intent,
      legalArea: detectedArea,
      extractedEntities: entities
    };
  }

  /**
   * Classify the type of legal query
   */
  private classifyQueryType(query: string): QueryType {
    const queryLower = query.toLowerCase();

    // Citation patterns
    if (/(?:artículo|art\.?)\s+\d+/.test(queryLower) || 
        /(?:código|ley)\s+\w+/.test(queryLower)) {
      return 'citation';
    }

    // Procedural patterns
    if (/(?:cómo|como)\s+\w+/.test(queryLower) ||
        /(?:proceso|procedimiento|trámite)/.test(queryLower) ||
        /(?:requisitos|pasos)/.test(queryLower)) {
      return 'procedural';
    }

    // Conceptual patterns
    if (/(?:qué|que)\s+es/.test(queryLower) ||
        /(?:definición|significado|concepto)/.test(queryLower)) {
      return 'conceptual';
    }

    // Comparative patterns
    if (/(?:diferencia|diferencias|comparar)/.test(queryLower) ||
        /(?:versus|vs|contra)/.test(queryLower)) {
      return 'comparative';
    }

    // Analytical patterns
    if (/(?:analizar|análisis|evaluar)/.test(queryLower) ||
        /(?:implicaciones|consecuencias)/.test(queryLower)) {
      return 'analytical';
    }

    return 'information'; // Default
  }

  /**
   * Detect the legal area from query content
   */
  private detectLegalArea(query: string): LegalArea | undefined {
    const queryLower = query.toLowerCase();

    const areaKeywords = {
      constitutional: ['constitución', 'constitucional', 'amparo', 'garantías', 'derechos fundamentales'],
      civil: ['civil', 'contrato', 'obligación', 'responsabilidad civil', 'daños', 'patrimonio'],
      criminal: ['penal', 'delito', 'pena', 'ministerio público', 'debido proceso', 'presunción'],
      labor: ['laboral', 'trabajo', 'empleado', 'patrón', 'salario', 'despido', 'imss', 'infonavit'],
      tax: ['fiscal', 'impuesto', 'contribuyente', 'sat', 'deducción', 'tributario'],
      commercial: ['mercantil', 'comercial', 'sociedad', 'empresa', 'comercio'],
      administrative: ['administrativo', 'servidor público', 'administración pública'],
      family: ['familiar', 'matrimonio', 'divorcio', 'patria potestad', 'alimentos'],
      property: ['propiedad', 'inmueble', 'posesión', 'usucapión', 'registro público']
    };

    for (const [area, keywords] of Object.entries(areaKeywords)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        return area as LegalArea;
      }
    }

    return undefined;
  }

  /**
   * Extract legal entities from query
   */
  private extractLegalEntities(query: string): Array<{ type: string; text: string; normalized: string; confidence: number }> {
    const entities = [];

    // Extract article references
    const articleMatches = [...query.matchAll(/(?:artículo|art\.?)\s+(\d+(?:\.\d+)*(?:\s*[A-Z])?)/gi)];
    for (const match of articleMatches) {
      entities.push({
        type: 'article',
        text: match[0],
        normalized: `Artículo ${match[1]}`,
        confidence: 0.9
      });
    }

    // Extract law references
    const lawMatches = [...query.matchAll(/(?:ley|código)\s+([\w\s]+?)(?:\s*,|\s*;|\s*\.|\s*$)/gi)];
    for (const match of lawMatches) {
      entities.push({
        type: 'law',
        text: match[0],
        normalized: match[0].trim(),
        confidence: 0.8
      });
    }

    // Extract institutions
    const institutions = ['SCJN', 'IMSS', 'INFONAVIT', 'SAT', 'PROFECO', 'STPS'];
    for (const institution of institutions) {
      if (query.toUpperCase().includes(institution)) {
        entities.push({
          type: 'institution',
          text: institution,
          normalized: institution,
          confidence: 0.9
        });
      }
    }

    return entities;
  }

  /**
   * Detect query intent
   */
  private detectQueryIntent(query: string, queryType: QueryType): string {
    const intentMap = {
      citation: 'citation',
      procedural: 'procedure',
      conceptual: 'information',
      analytical: 'analysis',
      comparative: 'comparison'
    };

    return intentMap[queryType] || 'information';
  }

  /**
   * Retrieve relevant legal documents using hybrid search
   */
  private async retrieveRelevantDocuments(
    processedQuery: ProcessedQuery,
    maxResults: number
  ): Promise<any[]> {
    // Mock legal documents for demonstration
    // In production, this would use vector search with embeddings
    
    const mockDocuments = [
      {
        id: 'const-art-123',
        content: `Artículo 123. Toda persona tiene derecho al trabajo digno y socialmente útil; al efecto, se promoverán la creación de empleos y la organización social de trabajo, conforme a la ley.

El Congreso de la Unión, sin contravenir a las bases siguientes deberá expedir leyes sobre el trabajo, las cuales regirán:

A. Entre los obreros, jornaleros, empleados domésticos, artesanos y de una manera general, todo contrato de trabajo:

I. La duración de la jornada máxima será de ocho horas.
II. La jornada máxima de trabajo nocturno será de 7 horas. Quedan prohibidas: las labores insalubres o peligrosas, el trabajo nocturno industrial y todo otro trabajo después de las diez de la noche, de los menores de dieciséis años.
III. Queda prohibida la utilización del trabajo de los menores de quince años. Los mayores de esta edad y menores de dieciséis tendrán como jornada máxima la de seis horas.`,
        metadata: {
          title: 'Constitución Política de los Estados Unidos Mexicanos',
          article: '123',
          hierarchy: 1,
          legalArea: 'labor',
          lastUpdated: '2024-01-01'
        },
        score: 0.95
      },
      {
        id: 'lft-art-47',
        content: `Artículo 47.- Son causas de rescisión de la relación de trabajo, sin responsabilidad para el patrón:

I. Engañarlo el trabajador o en su caso, el sindicato que lo hubiese propuesto o recomendado con certificados falsos o referencias en los que se atribuyan al trabajador capacidad, aptitudes o facultades de que carezca.
II. Incurrir el trabajador, durante sus labores, en faltas de probidad u honradez, en actos de violencia, amagos, injurias o malos tratamientos en contra del patrón, sus familiares o del personal directivo o administrativo de la empresa o establecimiento, o en contra de clientes y proveedores del patrón, salvo que medie provocación o que obre en defensa propia.
III. Cometer el trabajador contra alguno de sus compañeros, cualquiera de los actos enumerados en la fracción anterior, si como consecuencia de ellos se altera la disciplina del lugar en que se desempeña el trabajo.`,
        metadata: {
          title: 'Ley Federal del Trabajo',
          article: '47',
          hierarchy: 3,
          legalArea: 'labor',
          lastUpdated: '2023-05-01'
        },
        score: 0.85
      },
      {
        id: 'amparo-concept',
        content: `El juicio de amparo es el medio protector por excelencia de las garantías individuales establecidas en la Constitución. Procede contra actos de autoridad que violen garantías individuales, contra leyes o actos de autoridad federal que vulneren o restrinjan la soberanía de los estados, y contra leyes o actos de las autoridades de éstos que invadan la esfera de la autoridad federal.

El amparo protege a las personas contra:
- Leyes o actos de autoridad que violen las garantías individuales
- Invasiones de soberanía entre federación y estados
- Actos de autoridad que carezcan de fundamentación y motivación`,
        metadata: {
          title: 'Ley de Amparo',
          article: 'Introducción',
          hierarchy: 2,
          legalArea: 'constitutional',
          lastUpdated: '2023-06-15'
        },
        score: 0.75
      }
    ];

    // Filter based on legal area if specified
    let results = mockDocuments;
    if (processedQuery.legalArea) {
      results = mockDocuments.filter(doc => 
        doc.metadata.legalArea === processedQuery.legalArea
      );
    }

    // Return top results
    return results.slice(0, maxResults);
  }

  /**
   * Build legal context from search results
   */
  private buildLegalContext(searchResults: any[], processedQuery: ProcessedQuery): string {
    if (searchResults.length === 0) {
      return 'No se encontraron documentos legales relevantes para esta consulta.';
    }

    let context = 'Contexto legal relevante:\n\n';
    
    for (const result of searchResults.slice(0, 3)) { // Limit to top 3 for context
      context += `**${result.metadata?.title || 'Documento Legal'}**\n`;
      if (result.metadata?.article) {
        context += `Artículo ${result.metadata.article}\n`;
      }
      context += `${result.content.substring(0, 300)}...\n\n`;
    }

    return context;
  }

  /**
   * Generate legal response using LLM
   */
  private async generateLegalResponse(
    processedQuery: ProcessedQuery,
    context: string,
    legalArea?: LegalArea
  ): Promise<LLMResponse> {
    const systemPrompt = this.createLegalSystemPrompt(legalArea);
    
    const prompt = `${context}

Consulta del usuario: ${processedQuery.originalQuery}

Tipo de consulta: ${processedQuery.queryType}
Área legal: ${processedQuery.legalArea || 'general'}

Por favor, proporciona una respuesta legal precisa y completa, citando las fuentes relevantes del contexto proporcionado.`;

    const queryContext: QueryContext = {
      query: processedQuery.originalQuery,
      legalArea: processedQuery.legalArea,
      complexity: this.assessQueryComplexity(processedQuery),
      urgency: 'medium',
      privacyRequired: false,
      offlineMode: false,
      userBudget: 100 // Default budget
    };

    const llmRequest: LLMRequest = {
      model: 'default', // Will be selected by provider manager
      messages: [
        { role: 'user', content: prompt }
      ],
      systemPrompt,
      temperature: 0.1,
      maxTokens: Math.min(this.config.maxContextLength, 2000)
    };

    return await providerManager.processRequest(llmRequest, queryContext);
  }

  /**
   * Generate legal response using LLM with streaming
   */
  private async generateLegalResponseStreaming(
    processedQuery: ProcessedQuery,
    context: string,
    onChunk: (chunk: string) => void,
    legalArea?: LegalArea
  ): Promise<LLMResponse> {
    const systemPrompt = this.createLegalSystemPrompt(legalArea);
    
    const prompt = `${context}

Consulta del usuario: ${processedQuery.originalQuery}

Tipo de consulta: ${processedQuery.queryType}
Área legal: ${processedQuery.legalArea || 'general'}

Por favor, proporciona una respuesta legal precisa y completa, citando las fuentes relevantes del contexto proporcionado.`;

    const queryContext: QueryContext = {
      query: processedQuery.originalQuery,
      legalArea: processedQuery.legalArea,
      complexity: this.assessQueryComplexity(processedQuery),
      urgency: 'medium',
      privacyRequired: false,
      offlineMode: false,
      userBudget: 100 // Default budget
    };

    const llmRequest: LLMRequest = {
      model: 'default', // Will be selected by provider manager
      messages: [
        { role: 'user', content: prompt }
      ],
      systemPrompt,
      temperature: 0.1,
      maxTokens: Math.min(this.config.maxContextLength, 2000),
      stream: true // Enable streaming
    };

    return await providerManager.processStreamingRequest(llmRequest, queryContext, onChunk);
  }

  /**
   * Create legal system prompt
   */
  private createLegalSystemPrompt(legalArea?: LegalArea): string {
    let prompt = `Eres un asistente legal especializado en derecho mexicano. Tu función es proporcionar información legal precisa basada en:

- Constitución Política de los Estados Unidos Mexicanos
- Códigos y leyes federales mexicanas vigentes
- Jurisprudencia de la Suprema Corte de Justicia de la Nación
- Legislación mexicana actualizada

INSTRUCCIONES CRÍTICAS:
1. Siempre cita artículos específicos y fuentes legales
2. Incluye referencias a jurisprudencia cuando sea relevante
3. SIEMPRE advierte que no constituye asesoría legal profesional
4. Recomienda verificar la vigencia de la información
5. Usa lenguaje claro pero técnicamente preciso

FORMATO:
- Respuesta directa y estructurada
- Fundamento legal específico
- Procedimientos paso a paso cuando aplique
- Advertencias sobre asesoría profesional`;

    if (legalArea) {
      const areaSpecializations = {
        constitutional: '\n\nESPECIALÍZATE en derecho constitucional mexicano, garantías individuales y juicio de amparo.',
        civil: '\n\nESPECIALÍZATE en derecho civil mexicano, contratos, responsabilidad civil y bienes.',
        criminal: '\n\nESPECIALÍZATE en derecho penal mexicano, sistema acusatorio y debido proceso.',
        labor: '\n\nESPECIALÍZATE en derecho laboral mexicano, Ley Federal del Trabajo y seguridad social.',
        tax: '\n\nESPECIALÍZATE en derecho fiscal mexicano, obligaciones tributarias y procedimientos fiscales.'
      };

      prompt += areaSpecializations[legalArea] || '';
    }

    return prompt;
  }

  /**
   * Assess query complexity for provider selection
   */
  private assessQueryComplexity(processedQuery: ProcessedQuery): number {
    let complexity = 0.5; // Base complexity

    // Increase complexity for analytical queries
    if (processedQuery.queryType === 'analytical') complexity += 0.3;
    if (processedQuery.queryType === 'comparative') complexity += 0.2;

    // Increase complexity for multiple legal entities
    if (processedQuery.extractedEntities.length > 2) complexity += 0.2;

    // Increase complexity for constitutional queries
    if (processedQuery.legalArea === 'constitutional') complexity += 0.2;

    return Math.min(complexity, 1.0);
  }

  /**
   * Calculate confidence score for the response
   */
  private calculateConfidence(searchResults: any[], llmResponse: LLMResponse): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on search results quality
    if (searchResults.length > 0) {
      const avgScore = searchResults.reduce((sum, result) => sum + result.score, 0) / searchResults.length;
      confidence += avgScore * 0.3;
    }

    // Adjust based on LLM response metadata
    if (llmResponse.metadata?.confidence) {
      confidence = (confidence + llmResponse.metadata.confidence) / 2;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Generate legal warning
   */
  private generateLegalWarning(): string {
    return "⚠️ Esta información es solo para fines educativos y no constituye asesoría legal profesional. Para casos específicos, siempre consulte con un abogado certificado.";
  }

  /**
   * Generate recommended actions
   */
  private generateRecommendedActions(queryType: QueryType): string[] {
    const actions = {
      citation: [
        "Verificar la vigencia del artículo citado",
        "Consultar jurisprudencia relacionada",
        "Revisar reformas recientes"
      ],
      procedural: [
        "Verificar requisitos específicos en la jurisdicción correspondiente",
        "Confirmar plazos y fechas límite",
        "Consultar con un abogado para casos complejos"
      ],
      conceptual: [
        "Profundizar en la jurisprudencia sobre el tema",
        "Revisar doctrina especializada",
        "Consultar casos prácticos similares"
      ]
    };

    return actions[queryType] || [
      "Verificar la información con fuentes oficiales",
      "Consultar con un profesional del derecho"
    ];
  }

  /**
   * Generate related queries
   */
  private generateRelatedQueries(processedQuery: ProcessedQuery): string[] {
    // This would be enhanced with actual semantic similarity
    return [
      "¿Qué dice la jurisprudencia sobre este tema?",
      "¿Cuáles son los procedimientos relacionados?",
      "¿Hay reformas recientes que afecten esta materia?"
    ];
  }

  /**
   * Create excerpt from content
   */
  private createExcerpt(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return truncated.substring(0, lastSpace) + '...';
  }

  /**
   * Cache management
   */
  private getCachedResponse(query: string): LegalResponse | null {
    if (!this.config.enableCache) return null;

    const cached = this.cache.get(query);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.config.cacheExpiration) {
      this.cache.delete(query);
      return null;
    }

    return cached.response as LegalResponse;
  }

  private cacheResponse(query: string, response: LegalResponse): void {
    if (!this.config.enableCache) return;

    this.cache.set(query, {
      response,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.config.cacheExpiration) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get engine statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      cacheSize: this.cache.size,
      searchStats: this.searchEngine.getStats()
    };
  }
}

export default LegalRAGEngine;