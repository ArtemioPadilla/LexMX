/**
 * Development-specific mock data generators
 * Provides realistic test data for development environment
 */

import type { LegalDocument } from '../../types/legal';
import type { CorpusDocument } from '../../types/corpus';
import type { QualityMetrics, QualityTestResult } from '../../types/quality';
import type { CaseData } from '../../types/case-management';

/**
 * Check if running in development environment
 */
export function isDevelopmentEnvironment(): boolean {
  return (
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('localhost') || 
     window.location.hostname.includes('127.0.0.1')) &&
    import.meta.env.DEV === true
  );
}

/**
 * Generate mock legal documents for development
 */
export class DevLegalDocumentGenerator {
  private static readonly LEGAL_AREAS = [
    'Civil', 'Penal', 'Laboral', 'Fiscal', 'Mercantil', 
    'Constitucional', 'Administrativo', 'Familiar'
  ] as const;

  private static readonly DOCUMENT_TYPES = [
    'Código', 'Ley', 'Reglamento', 'Decreto', 'Acuerdo', 
    'Circular', 'Manual', 'Norma Oficial Mexicana'
  ] as const;

  static generateCorpusDocuments(count: number = 50): CorpusDocument[] {
    const documents: CorpusDocument[] = [];
    
    for (let i = 0; i < count; i++) {
      const legalArea = this.LEGAL_AREAS[Math.floor(Math.random() * this.LEGAL_AREAS.length)];
      const docType = this.DOCUMENT_TYPES[Math.floor(Math.random() * this.DOCUMENT_TYPES.length)];
      
      documents.push({
        id: `dev-doc-${i + 1}`,
        title: `${docType} ${legalArea} Ejemplo ${i + 1}`,
        content: this.generateRealisticLegalContent(legalArea, docType, i + 1),
        metadata: {
          title: `${docType} ${legalArea} Ejemplo ${i + 1}`,
          legalArea: legalArea.toLowerCase(),
          hierarchy: Math.floor(Math.random() * 7) + 1,
          lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          article: `Artículo ${Math.floor(Math.random() * 500) + 1}`,
          section: Math.random() > 0.5 ? `Sección ${Math.floor(Math.random() * 10) + 1}` : undefined
        },
        embedding: this.generateMockEmbedding(),
        chunks: this.generateDocumentChunks(`${docType} ${legalArea} Ejemplo ${i + 1}`, 3 + Math.floor(Math.random() * 5)),
        sourceUrl: `https://dev.mock/documents/${docType.toLowerCase()}-${legalArea.toLowerCase()}-${i + 1}.pdf`,
        ingestionDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        version: '1.0.0'
      });
    }
    
    return documents;
  }

  private static generateRealisticLegalContent(legalArea: string, docType: string, index: number): string {
    const templates = {
      Civil: [
        'Artículo {num}.- Toda persona física o moral tiene derecho a la protección de sus datos personales.',
        'Artículo {num}.- Los contratos civiles se perfeccionan por el simple consentimiento de las partes.',
        'Artículo {num}.- La responsabilidad civil surge del daño causado por actos u omisiones.'
      ],
      Penal: [
        'Artículo {num}.- Comete el delito de fraude quien con ánimo de lucro engañe a otro.',
        'Artículo {num}.- Se impondrán de tres meses a dos años de prisión por el delito de lesiones.',
        'Artículo {num}.- La tentativa es punible cuando se inicia la ejecución del delito.'
      ],
      Laboral: [
        'Artículo {num}.- Trabajo es toda actividad humana, intelectual o material.',
        'Artículo {num}.- Los trabajadores tendrán derecho a participar en las utilidades.',
        'Artículo {num}.- La jornada máxima de trabajo diurno será de ocho horas.'
      ],
      Fiscal: [
        'Artículo {num}.- Son obligaciones de los contribuyentes pagar las contribuciones.',
        'Artículo {num}.- Las autoridades fiscales podrán realizar visitas domiciliarias.',
        'Artículo {num}.- Los ingresos acumulables se determinarán por ejercicio fiscal.'
      ]
    };

    const areaTemplates = templates[legalArea as keyof typeof templates] || templates.Civil;
    const baseContent = areaTemplates[Math.floor(Math.random() * areaTemplates.length)]
      .replace('{num}', String(index * 10 + Math.floor(Math.random() * 10)));
    
    // Add more detailed content
    return `TÍTULO ${Math.floor(Math.random() * 10) + 1}\n\n${baseContent}\n\nEste artículo establece las bases fundamentales para la aplicación de la normatividad ${legalArea.toLowerCase()} en el territorio nacional. Su interpretación debe realizarse en concordancia con los principios constitucionales y los tratados internacionales ratificados por México.\n\nPara efectos del presente ordenamiento, se entenderá por:\n\nI. Parte interesada: Toda persona física o moral que tenga un interés jurídico en el procedimiento;\nII. Autoridad competente: El órgano facultado por la ley para conocer del asunto;\nIII. Resolución: El acto administrativo que decide sobre la cuestión planteada.\n\nLa aplicación de este precepto deberá considerar las circunstancias particulares de cada caso, garantizando siempre el debido proceso y la seguridad jurídica de los gobernados.`;
  }

  private static generateMockEmbedding(): number[] {
    // Generate a realistic-looking 384-dimensional embedding
    return Array.from({ length: 384 }, () => (Math.random() - 0.5) * 2);
  }

  private static generateDocumentChunks(title: string, count: number) {
    const chunks = [];
    for (let i = 0; i < count; i++) {
      chunks.push({
        id: `chunk-${Date.now()}-${i}`,
        content: `Fragmento ${i + 1} de ${title}. Este contenido incluye disposiciones relevantes sobre la materia legal correspondiente.`,
        metadata: {
          title,
          chunkIndex: i,
          totalChunks: count
        },
        embedding: this.generateMockEmbedding()
      });
    }
    return chunks;
  }
}

/**
 * Generate mock quality metrics for development
 */
export class DevQualityMetricsGenerator {
  static generateQualityMetrics(): QualityMetrics {
    return {
      totalTests: Math.floor(Math.random() * 100) + 50,
      passedTests: Math.floor(Math.random() * 50) + 40,
      failedTests: Math.floor(Math.random() * 10) + 2,
      averageAccuracy: 0.85 + Math.random() * 0.1,
      averageRelevance: 0.80 + Math.random() * 0.15,
      averageLatency: 1200 + Math.random() * 800,
      lastUpdated: new Date().toISOString(),
      testCategories: {
        legal_accuracy: {
          passed: Math.floor(Math.random() * 20) + 15,
          failed: Math.floor(Math.random() * 3) + 1,
          accuracy: 0.90 + Math.random() * 0.08
        },
        citation_validation: {
          passed: Math.floor(Math.random() * 25) + 20,
          failed: Math.floor(Math.random() * 2) + 1,
          accuracy: 0.92 + Math.random() * 0.06
        },
        response_relevance: {
          passed: Math.floor(Math.random() * 18) + 12,
          failed: Math.floor(Math.random() * 4) + 2,
          accuracy: 0.78 + Math.random() * 0.15
        }
      }
    };
  }

  static generateTestResults(count: number = 20): QualityTestResult[] {
    const results: QualityTestResult[] = [];
    const testTypes = ['legal_accuracy', 'citation_validation', 'response_relevance', 'performance'];
    const legalAreas = ['civil', 'penal', 'laboral', 'fiscal'];
    
    for (let i = 0; i < count; i++) {
      const passed = Math.random() > 0.2; // 80% pass rate
      
      results.push({
        id: `test-${Date.now()}-${i}`,
        testType: testTypes[Math.floor(Math.random() * testTypes.length)],
        query: `Consulta de desarrollo ${i + 1} sobre ${legalAreas[Math.floor(Math.random() * legalAreas.length)]}`,
        expectedResponse: `Respuesta esperada para la consulta ${i + 1}`,
        actualResponse: `Respuesta real generada por el sistema para la consulta ${i + 1}`,
        passed,
        accuracy: passed ? 0.8 + Math.random() * 0.2 : Math.random() * 0.6,
        relevanceScore: passed ? 0.75 + Math.random() * 0.25 : Math.random() * 0.7,
        latency: 800 + Math.random() * 1500,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          legalArea: legalAreas[Math.floor(Math.random() * legalAreas.length)],
          complexity: ['basic', 'intermediate', 'advanced'][Math.floor(Math.random() * 3)],
          provider: ['openai', 'claude', 'gemini'][Math.floor(Math.random() * 3)]
        }
      });
    }
    
    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

/**
 * Generate mock case data for development
 */
export class DevCaseDataGenerator {
  private static readonly CASE_TYPES = [
    'Civil', 'Penal', 'Laboral', 'Mercantil', 'Familiar', 'Administrativo'
  ] as const;

  private static readonly CASE_STATUSES = [
    'active', 'pending', 'closed', 'archived'
  ] as const;

  static generateCases(count: number = 15): CaseData[] {
    const cases: CaseData[] = [];
    
    for (let i = 0; i < count; i++) {
      const caseType = this.CASE_TYPES[Math.floor(Math.random() * this.CASE_TYPES.length)];
      const status = this.CASE_STATUSES[Math.floor(Math.random() * this.CASE_STATUSES.length)];
      
      cases.push({
        id: `case-${Date.now()}-${i}`,
        title: `Caso ${caseType} ${i + 1}`,
        description: `Descripción detallada del caso ${caseType.toLowerCase()} número ${i + 1} para desarrollo.`,
        type: caseType.toLowerCase(),
        status,
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: Math.random() > 0.3 ? new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        assignedTo: Math.random() > 0.4 ? `Abogado ${Math.floor(Math.random() * 5) + 1}` : undefined,
        client: {
          name: `Cliente ${i + 1}`,
          email: `cliente${i + 1}@example.com`,
          phone: `555-${Math.floor(Math.random() * 9000) + 1000}`
        },
        parties: this.generateParties(),
        documents: this.generateCaseDocuments(3 + Math.floor(Math.random() * 5)),
        events: this.generateCaseEvents(2 + Math.floor(Math.random() * 8)),
        tags: this.generateTags(caseType),
        metadata: {
          court: Math.random() > 0.5 ? `Juzgado ${Math.floor(Math.random() * 10) + 1}` : undefined,
          caseNumber: `${Math.floor(Math.random() * 9000) + 1000}/${new Date().getFullYear()}`,
          jurisdiction: ['Federal', 'Local', 'Municipal'][Math.floor(Math.random() * 3)]
        }
      });
    }
    
    return cases.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  private static generateParties() {
    return [
      {
        id: `party-${Date.now()}-1`,
        name: 'Parte Demandante',
        type: 'plaintiff' as const,
        contact: 'demandante@example.com'
      },
      {
        id: `party-${Date.now()}-2`,
        name: 'Parte Demandada',
        type: 'defendant' as const,
        contact: 'demandado@example.com'
      }
    ];
  }

  private static generateCaseDocuments(count: number) {
    const docTypes = ['Demanda', 'Contestación', 'Pruebas', 'Alegatos', 'Sentencia'];
    return Array.from({ length: count }, (_, i) => ({
      id: `doc-${Date.now()}-${i}`,
      name: `${docTypes[Math.floor(Math.random() * docTypes.length)]} ${i + 1}.pdf`,
      type: 'legal_document' as const,
      size: Math.floor(Math.random() * 1000000) + 50000,
      uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['documento', 'legal']
    }));
  }

  private static generateCaseEvents(count: number) {
    const eventTypes = ['created', 'document_added', 'status_change', 'deadline', 'note_added'] as const;
    return Array.from({ length: count }, (_, i) => ({
      id: `event-${Date.now()}-${i}`,
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      title: `Evento ${i + 1}`,
      description: `Descripción del evento ${i + 1} en el caso`,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      metadata: {}
    }));
  }

  private static generateTags(caseType: string) {
    const baseTags = [caseType.toLowerCase(), 'desarrollo', 'mock'];
    const additionalTags = ['urgente', 'revisión', 'pendiente', 'completado'];
    
    return [
      ...baseTags,
      ...additionalTags.slice(0, Math.floor(Math.random() * 2) + 1)
    ];
  }
}

/**
 * Development feature toggle system
 */
export class DevFeatureToggle {
  private static readonly DEV_FEATURES = {
    // Mock data features
    useMockCorpus: 'USE_MOCK_CORPUS',
    useMockQuality: 'USE_MOCK_QUALITY',
    useMockCases: 'USE_MOCK_CASES',
    
    // Development tools
    showDebugInfo: 'SHOW_DEBUG_INFO',
    enablePerformanceMetrics: 'ENABLE_PERF_METRICS',
    enableDetailedLogging: 'ENABLE_DETAILED_LOGGING',
    
    // API testing
    simulateNetworkDelay: 'SIMULATE_NETWORK_DELAY',
    enableApiMocking: 'ENABLE_API_MOCKING',
    
    // UI development
    showBoundingBoxes: 'SHOW_BOUNDING_BOXES',
    enableUITesting: 'ENABLE_UI_TESTING'
  } as const;

  /**
   * Check if a development feature is enabled
   */
  static isEnabled(feature: keyof typeof DevFeatureToggle.DEV_FEATURES): boolean {
    if (!isDevelopmentEnvironment()) {
      return false;
    }

    const envVar = this.DEV_FEATURES[feature];
    
    // Check localStorage first (user preference)
    if (typeof window !== 'undefined') {
      const localValue = localStorage.getItem(`dev_feature_${feature}`);
      if (localValue !== null) {
        return localValue === 'true';
      }
    }
    
    // Fallback to environment variable or default
    return import.meta.env[envVar] === 'true' || import.meta.env[envVar] === true;
  }

  /**
   * Toggle a development feature
   */
  static toggle(feature: keyof typeof DevFeatureToggle.DEV_FEATURES, enabled?: boolean): void {
    if (!isDevelopmentEnvironment() || typeof window === 'undefined') {
      return;
    }

    const newValue = enabled ?? !this.isEnabled(feature);
    localStorage.setItem(`dev_feature_${feature}`, String(newValue));
    
    // Trigger a custom event for reactive UI updates
    window.dispatchEvent(new CustomEvent('devFeatureToggled', {
      detail: { feature, enabled: newValue }
    }));
  }

  /**
   * Get all available development features and their status
   */
  static getAllFeatures(): Record<string, boolean> {
    const features: Record<string, boolean> = {};
    
    for (const feature in this.DEV_FEATURES) {
      features[feature] = this.isEnabled(feature as keyof typeof this.DEV_FEATURES);
    }
    
    return features;
  }

  /**
   * Reset all development features to default
   */
  static resetAll(): void {
    if (!isDevelopmentEnvironment() || typeof window === 'undefined') {
      return;
    }

    for (const feature in this.DEV_FEATURES) {
      localStorage.removeItem(`dev_feature_${feature}`);
    }
    
    window.dispatchEvent(new CustomEvent('devFeaturesReset'));
  }
}

/**
 * Export convenience functions for immediate use
 */
export const DevData = {
  // Quick access to generators
  generateCorpusDocuments: DevLegalDocumentGenerator.generateCorpusDocuments.bind(DevLegalDocumentGenerator),
  generateQualityMetrics: DevQualityMetricsGenerator.generateQualityMetrics.bind(DevQualityMetricsGenerator),
  generateTestResults: DevQualityMetricsGenerator.generateTestResults.bind(DevQualityMetricsGenerator),
  generateCases: DevCaseDataGenerator.generateCases.bind(DevCaseDataGenerator),
  
  // Feature toggles
  isFeatureEnabled: DevFeatureToggle.isEnabled.bind(DevFeatureToggle),
  toggleFeature: DevFeatureToggle.toggle.bind(DevFeatureToggle),
  getAllFeatures: DevFeatureToggle.getAllFeatures.bind(DevFeatureToggle),
  resetFeatures: DevFeatureToggle.resetAll.bind(DevFeatureToggle),
  
  // Environment check
  isDev: isDevelopmentEnvironment
};