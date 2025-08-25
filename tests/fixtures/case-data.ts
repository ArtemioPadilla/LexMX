/**
 * Test data fixtures for case management tests
 * Provides consistent, predictable test data for E2E tests
 */

export interface TestCase {
  id: string;
  title: string;
  description: string;
  client: string;
  caseNumber: string;
  legalArea: 'civil' | 'criminal' | 'labor' | 'tax' | 'commercial' | 'administrative' | 'constitutional';
  status: 'active' | 'pending' | 'resolved' | 'archived';
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  documents?: any[];
  notes?: any[];
  conversations?: any[];
  deadlines?: any[];
  parties?: any[];
}

export interface CreateCaseData {
  title: string;
  description?: string;
  client?: string;
  caseNumber?: string;
  area?: string;
  status?: string;
}

/**
 * Standard test cases with different characteristics
 */
export const TEST_CASES: Record<string, TestCase> = {
  CIVIL_ACTIVE: {
    id: 'test-case-1',
    title: 'Divorcio García vs. García',
    description: 'Divorcio por mutuo consentimiento con convenio de separación de bienes',
    client: 'María García Hernández',
    caseNumber: 'FAM-2024-001',
    legalArea: 'civil',
    status: 'active',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-20T15:30:00.000Z',
    documents: [],
    notes: [],
    conversations: [],
    deadlines: [],
    parties: [],
  },
  
  COMMERCIAL_PENDING: {
    id: 'test-case-2', 
    title: 'Contrato de Compraventa Inmueble',
    description: 'Revisión y elaboración de contrato de compraventa para propiedad en CDMX',
    client: 'Pedro Martínez Silva',
    caseNumber: 'CIV-2024-002',
    legalArea: 'commercial',
    status: 'pending',
    createdAt: '2024-01-10T09:00:00.000Z',
    updatedAt: '2024-01-18T14:00:00.000Z',
    documents: [],
    notes: [],
    conversations: [],
    deadlines: [],
    parties: [],
  },
  
  LABOR_RESOLVED: {
    id: 'test-case-3',
    title: 'Despido Injustificado - Empresa XYZ',
    description: 'Demanda laboral por despido injustificado y pago de prestaciones',
    client: 'Ana López Rodríguez',
    caseNumber: 'LAB-2024-003',
    legalArea: 'labor',
    status: 'resolved',
    createdAt: '2024-01-05T08:00:00.000Z',
    updatedAt: '2024-01-25T16:00:00.000Z',
    documents: [],
    notes: [],
    conversations: [],
    deadlines: [],
    parties: [],
  },
  
  TAX_ARCHIVED: {
    id: 'test-case-4',
    title: 'Recurso de Revocación SAT',
    description: 'Impugnación de multa fiscal por declaración extemporánea',
    client: 'Comercializadora ABC S.A.',
    caseNumber: 'FIS-2024-004',
    legalArea: 'tax',
    status: 'archived',
    createdAt: '2023-12-01T10:30:00.000Z',
    updatedAt: '2023-12-30T12:00:00.000Z',
    documents: [],
    notes: [],
    conversations: [],
    deadlines: [],
    parties: [],
  },
} as const;

/**
 * Case creation test data for form filling
 */
export const CREATE_CASE_DATA: Record<string, CreateCaseData> = {
  SIMPLE: {
    title: 'Caso de Prueba Simple',
    description: 'Descripción básica del caso de prueba',
    client: 'Cliente de Prueba',
    caseNumber: 'TEST-001',
    area: 'civil',
  },
  
  MINIMAL: {
    title: 'Caso Mínimo',
  },
  
  COMPLETE: {
    title: 'Caso Completo de Prueba',
    description: 'Este es un caso de prueba completo con todos los campos llenos para verificar el funcionamiento del formulario de creación de casos.',
    client: 'Cliente Completo Test',
    caseNumber: 'COMP-2024-001',
    area: 'labor',
  },
  
  SEARCH_TEST: {
    title: 'Caso Búsqueda Test',
    description: 'Caso específico para probar funcionalidad de búsqueda',
    client: 'Cliente Búsqueda',
    caseNumber: 'SEARCH-001',
    area: 'commercial',
  },
} as const;

/**
 * Predefined sets of cases for different test scenarios
 */
export const CASE_SETS = {
  EMPTY: [],
  
  SINGLE: [TEST_CASES.CIVIL_ACTIVE],
  
  MULTIPLE_STATUS: [
    TEST_CASES.CIVIL_ACTIVE,
    TEST_CASES.COMMERCIAL_PENDING,
    TEST_CASES.LABOR_RESOLVED,
    TEST_CASES.TAX_ARCHIVED,
  ],
  
  SAME_AREA: [
    TEST_CASES.CIVIL_ACTIVE,
    {
      ...TEST_CASES.COMMERCIAL_PENDING,
      legalArea: 'civil' as const,
      title: 'Segundo Caso Civil',
    }
  ],
  
  SEARCH_TEST_SET: [
    { ...TEST_CASES.CIVIL_ACTIVE, title: 'Activo García' },
    { ...TEST_CASES.COMMERCIAL_PENDING, title: 'Pendiente Silva' },
    { ...TEST_CASES.LABOR_RESOLVED, title: 'Resuelto López' },
  ],
} as const;

/**
 * Factory functions for creating test cases with variations
 */
export const caseFactory = {
  /**
   * Create a basic case with custom overrides
   */
  create: (overrides: Partial<TestCase> = {}): TestCase => ({
    id: `test-${Date.now()}`,
    title: 'Test Case',
    description: 'Test case description',
    client: 'Test Client',
    caseNumber: `TEST-${Date.now()}`,
    legalArea: 'civil',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documents: [],
    notes: [],
    conversations: [],
    deadlines: [],
    parties: [],
    ...overrides,
  }),
  
  /**
   * Create multiple cases with incremental IDs
   */
  createMultiple: (count: number, baseCase: Partial<TestCase> = {}): TestCase[] => {
    return Array.from({ length: count }, (_, i) => 
      caseFactory.create({
        ...baseCase,
        id: `test-case-${i + 1}`,
        title: `${baseCase.title || 'Test Case'} ${i + 1}`,
        caseNumber: `TEST-${String(i + 1).padStart(3, '0')}`,
      })
    );
  },
  
  /**
   * Create cases with different statuses
   */
  createWithStatuses: (statuses: TestCase['status'][]): TestCase[] => {
    return statuses.map((status, i) =>
      caseFactory.create({
        id: `test-${status}-${i}`,
        title: `${status.charAt(0).toUpperCase() + status.slice(1)} Case`,
        status,
      })
    );
  },
  
  /**
   * Create cases for search testing
   */
  createForSearch: (searchTerms: string[]): TestCase[] => {
    return searchTerms.map((term, i) =>
      caseFactory.create({
        id: `search-${i}`,
        title: `Case with ${term}`,
        client: `Client ${term}`,
      })
    );
  },
};

/**
 * Helper functions for test data validation and conversion
 */
export const testDataHelpers = {
  /**
   * Convert TestCase to localStorage format
   */
  toStorageFormat: (cases: TestCase[]) => 
    cases.map(c => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      deadlines: c.deadlines?.map(d => ({
        ...d,
        date: new Date(d.date)
      })) || []
    })),
    
  /**
   * Validate case data structure
   */
  validateCase: (caseData: any): caseData is TestCase => {
    return (
      typeof caseData.id === 'string' &&
      typeof caseData.title === 'string' &&
      typeof caseData.status === 'string' &&
      ['active', 'pending', 'resolved', 'archived'].includes(caseData.status)
    );
  },
  
  /**
   * Get cases by status
   */
  getCasesByStatus: (cases: TestCase[], status: TestCase['status']) =>
    cases.filter(c => c.status === status),
    
  /**
   * Get cases by legal area
   */
  getCasesByArea: (cases: TestCase[], area: TestCase['legalArea']) =>
    cases.filter(c => c.legalArea === area),
    
  /**
   * Search cases by title or client
   */
  searchCases: (cases: TestCase[], query: string) =>
    cases.filter(c => 
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.client.toLowerCase().includes(query.toLowerCase())
    ),
};