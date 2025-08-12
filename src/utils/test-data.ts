/**
 * Centralized test data for consistent testing
 */

import type { LegalArea } from '../types/legal';

export const TEST_DATA = {
  // Mock providers for testing
  providers: {
    webllm: {
      id: 'webllm',
      name: 'WebLLM',
      apiKey: '',
      models: ['Llama-3.2-3B', 'Gemma-2B'],
      enabled: true,
      type: 'browser' as const,
    },
    openai: {
      id: 'openai',
      name: 'OpenAI',
      apiKey: 'test-key-123',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      enabled: true,
      type: 'api' as const,
    },
    claude: {
      id: 'claude',
      name: 'Claude',
      apiKey: 'test-key-456',
      models: ['claude-3-opus', 'claude-3-sonnet'],
      enabled: true,
      type: 'api' as const,
    },
  },

  // Mock cases for testing
  cases: {
    divorce: {
      id: 'test-case-1',
      title: 'Divorcio Express',
      description: 'Caso de divorcio por mutuo consentimiento',
      client: 'Juan Pérez',
      area: 'civil' as LegalArea,
      createdAt: new Date('2024-01-15'),
      status: 'active' as const,
    },
    labor: {
      id: 'test-case-2',
      title: 'Despido Injustificado',
      description: 'Reclamación por despido sin causa justificada',
      client: 'María García',
      area: 'labor' as LegalArea,
      createdAt: new Date('2024-02-01'),
      status: 'active' as const,
    },
    tax: {
      id: 'test-case-3',
      title: 'Consulta ISR',
      description: 'Consulta sobre deducciones de ISR',
      client: 'Empresa ABC',
      area: 'tax' as LegalArea,
      createdAt: new Date('2024-02-15'),
      status: 'completed' as const,
    },
  },

  // Mock chat messages
  messages: {
    welcome: {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Bienvenido a LexMX. ¿En qué puedo ayudarte?',
      timestamp: new Date(),
    },
    userQuery: {
      id: 'msg-2',
      role: 'user' as const,
      content: '¿Cuáles son los requisitos para un divorcio?',
      timestamp: new Date(),
    },
    assistantResponse: {
      id: 'msg-3',
      role: 'assistant' as const,
      content: 'Según el Código Civil Federal, los requisitos para divorcio son...',
      timestamp: new Date(),
      sources: ['CCF Art. 266', 'CCF Art. 267'],
    },
  },

  // Mock corpus documents
  corpus: {
    areas: ['constitutional', 'civil', 'labor', 'criminal', 'tax', 'commercial', 'administrative'] as LegalArea[],
    documents: {
      cpeum: { id: 'cpeum', title: 'Constitución Política', area: 'constitutional' as LegalArea },
      ccf: { id: 'ccf', title: 'Código Civil Federal', area: 'civil' as LegalArea },
      lft: { id: 'lft', title: 'Ley Federal del Trabajo', area: 'labor' as LegalArea },
      cpf: { id: 'cpf', title: 'Código Penal Federal', area: 'criminal' as LegalArea },
      cff: { id: 'cff', title: 'Código Fiscal', area: 'tax' as LegalArea },
    },
  },

  // Mock legal questions
  questions: {
    spanish: [
      '¿Qué dice el artículo 123 constitucional?',
      '¿Cuáles son las causales de divorcio?',
      '¿Cómo calcular el finiquito laboral?',
      '¿Qué es el amparo directo?',
    ],
    english: [
      'What does constitutional article 123 say?',
      'What are the grounds for divorce?',
      'How to calculate labor settlement?',
      'What is direct amparo?',
    ],
  },

  // Mock error messages
  errors: {
    noProvider: 'No tienes proveedores de IA configurados',
    networkError: 'Error de conexión. Por favor intenta de nuevo.',
    invalidKey: 'La clave API no es válida',
    timeout: 'La operación tardó demasiado tiempo',
  },

  // Mock translations for testing
  translations: {
    es: {
      'nav.chat': 'Chat Legal',
      'nav.cases': 'Mis Casos',
      'nav.wiki': 'Wiki Legal',
      'nav.codes': 'Códigos',
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'common.delete': 'Eliminar',
      'common.edit': 'Editar',
      'common.search': 'Buscar',
      'common.loading': 'Cargando...',
    },
    en: {
      'nav.chat': 'Legal Chat',
      'nav.cases': 'My Cases',
      'nav.wiki': 'Legal Wiki',
      'nav.codes': 'Legal Codes',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.search': 'Search',
      'common.loading': 'Loading...',
    },
  },

  // Timing constants for tests
  timing: {
    hydration: 1000,
    animation: 300,
    debounce: 500,
    networkRequest: 2000,
    longOperation: 5000,
  },

  // Viewport sizes for responsive testing
  viewports: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 720 },
    wide: { width: 1920, height: 1080 },
  },
};

// Helper functions for test data
export function getMockProvider(type: 'webllm' | 'openai' | 'claude' = 'webllm') {
  return TEST_DATA.providers[type];
}

export function getMockCase(type: 'divorce' | 'labor' | 'tax' = 'divorce') {
  return TEST_DATA.cases[type];
}

export function getMockMessage(type: 'welcome' | 'userQuery' | 'assistantResponse' = 'welcome') {
  return TEST_DATA.messages[type];
}

export function getTranslation(key: string, lang: 'es' | 'en' = 'es'): string {
  return TEST_DATA.translations[lang][key] || key;
}