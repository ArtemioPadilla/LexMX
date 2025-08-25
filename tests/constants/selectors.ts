/**
 * Centralized test selectors for consistent and maintainable E2E tests
 * This file provides a single source of truth for all test selectors,
 * making it easy to update selectors when components change.
 */

export const CASE_SELECTORS = {
  // Case Manager Main Container
  MANAGER: '[data-testid="case-manager"]',
  
  // Case Creation
  NEW_CASE_BUTTON: '[data-testid="new-case-button"]',
  CREATION_FORM: '[data-testid="case-creation-form"]',
  TITLE_INPUT: '[data-testid="case-title-input"]',
  DESCRIPTION_INPUT: '[data-testid="case-description-input"]',
  CLIENT_INPUT: '[data-testid="case-client-input"]',
  NUMBER_INPUT: '[data-testid="case-number-input"]',
  LEGAL_AREA_SELECT: '[data-testid="case-legal-area-select"]',
  SUBMIT_BUTTON: '[data-testid="case-submit-button"]',
  CANCEL_BUTTON: '[data-testid="case-cancel-button"]',
  
  // Case List and Search
  SEARCH_INPUT: '[data-testid="search-cases-input"]',
  CASES_LIST: '[data-testid="cases-list"]',
  EMPTY_CASES_MESSAGE: '[data-testid="empty-cases-message"]',
  CASE_ITEM: (caseId: string) => `[data-testid="case-item-${caseId}"]`,
  CASE_STATUS: (status: string) => `[data-testid="case-status-${status}"]`,
  
  // Filter Elements
  FILTER_STATUS_SELECT: '[data-testid="filter-status-select"]',
  FILTER_AREA_SELECT: '[data-testid="filter-area-select"]',
  
  // Empty State Messages
  SELECT_CASE_MESSAGE: '[data-testid="select-case-message"]',
  OR_CREATE_NEW_MESSAGE: '[data-testid="or-create-new-message"]',
  
  // File Upload
  FILE_INPUT: '[data-testid="file-input"]',
} as const;

// Tab-Specific Selectors
export const TAB_SELECTORS = {
  // Tab Navigation
  OVERVIEW_TAB: 'button[data-tab="overview"]',
  DOCUMENTS_TAB: 'button[data-tab="documents"]', 
  NOTES_TAB: 'button[data-tab="notes"]',
  CHAT_TAB: 'button[data-tab="chat"]',
  TIMELINE_TAB: 'button[data-tab="timeline"]',
  
  // Tab Content Areas
  DOCUMENTS_CONTENT: '[data-tab-content="documents"]',
  NOTES_CONTENT: '[data-tab-content="notes"]',
  OVERVIEW_CONTENT: '[data-tab-content="overview"]',
  
  // Specific Elements within Tabs
  NOTES_TEXTAREA: '[data-testid="notes-textarea"]',
  UPLOAD_AREA: '[data-testid="upload-area"]',
  UPLOAD_TEXT: '[data-testid="upload-text"]',
  FILE_INPUT_IN_DOCS: '[data-tab-content="documents"] [data-testid="file-input"]',
} as const;

// Modal-Specific Selectors  
export const MODAL_SELECTORS = {
  // Edit Case Modal
  EDIT_CASE_MODAL: '[data-testid="edit-case-modal"]',
  EDIT_FORM: '[data-testid="edit-case-modal"] form',
  EDIT_TITLE_INPUT: '[data-testid="edit-title-input"]',
  EDIT_DESCRIPTION_TEXTAREA: '[data-testid="edit-description-textarea"]',
  EDIT_CLIENT_INPUT: '[data-testid="edit-client-input"]',
  EDIT_STATUS_SELECT: '[data-testid="edit-status-select"]',
  EDIT_SAVE_BUTTON: '[data-testid="edit-save-button"]',
  EDIT_CANCEL_BUTTON: '[data-testid="edit-cancel-button"]',
  
  // Modal Overlay
  MODAL_OVERLAY: '.fixed.inset-0.bg-black.bg-opacity-50',
} as const;

// Case Detail Specific Selectors (to avoid strict mode violations)
export const CASE_DETAIL_SELECTORS = {
  // Case Header Area
  CASE_HEADER: '.case-header',
  CASE_TITLE_IN_DETAILS: '.case-details h1.text-2xl, h1.text-2xl',
  CLIENT_INFO_IN_DETAILS: '[data-field="client-info"]',
  CASE_NUMBER_IN_DETAILS: '[data-field="case-number"]',
  
  // Action Buttons
  EDIT_BUTTON: '[data-testid="edit-case-button"]',
  DELETE_BUTTON: '[data-testid="delete-case-button"]',
} as const;

export const COMMON_SELECTORS = {
  // Navigation
  MAIN_CONTAINER: 'main, [role="main"], .container',
  
  // Buttons and Forms
  SUBMIT_BUTTON: 'button[type="submit"]',
  CANCEL_BUTTON: 'button[type="button"]',
  
  // Loading states
  LOADING_SPINNER: '.animate-spin',
  
  // Headings
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
} as const;

export const TEXT_PATTERNS = {
  // Spanish patterns
  ES: {
    MIS_CASOS: /Mis Casos/i,
    NUEVO_CASO: /Nuevo Caso/i,
    CREAR_CASO: /Crear Caso/i,
    NO_HAY_CASOS: /No hay casos creados/i,
    SELECCIONA_CASO: /Selecciona un caso/i,
    O_CREA_NUEVO: /o crea uno nuevo/i,
    CANCELAR: /Cancelar/i,
  },
  
  // English patterns
  EN: {
    MY_CASES: /My Cases/i,
    NEW_CASE: /New Case/i,
    CREATE_CASE: /Create Case/i,
    NO_CASES: /No cases created/i,
    SELECT_CASE: /Select a case/i,
    OR_CREATE_NEW: /or create a new one/i,
    CANCEL: /Cancel/i,
  },
  
  // Bilingual patterns (for fallbacks)
  BILINGUAL: {
    MIS_CASOS_MY_CASES: /Mis Casos|My Cases/i,
    NUEVO_CASO_NEW_CASE: /Nuevo Caso|New Case/i,
    CREAR_CASO_CREATE_CASE: /Crear Caso|Create Case/i,
    NO_CASOS_NO_CASES: /No hay casos creados|No cases created/i,
    SELECCIONA_SELECT: /Selecciona un caso|Select a case/i,
    O_CREA_OR_CREATE: /o crea uno nuevo|or create a new one/i,
    CANCELAR_CANCEL: /Cancelar|Cancel/i,
  },
} as const;

/**
 * Helper functions for complex selectors
 */
export const selectorHelpers = {
  /**
   * Get a case item selector by ID
   */
  caseItem: (caseId: string) => CASE_SELECTORS.CASE_ITEM(caseId),
  
  /**
   * Get a case status indicator selector
   */
  caseStatus: (status: string) => CASE_SELECTORS.CASE_STATUS(status),
  
  /**
   * Get text selector with bilingual support
   */
  textContent: (textKey: keyof typeof TEXT_PATTERNS.BILINGUAL) => 
    `text=${TEXT_PATTERNS.BILINGUAL[textKey].source}`,
  
  /**
   * Get button by text content with bilingual support
   */
  buttonByText: (textKey: keyof typeof TEXT_PATTERNS.BILINGUAL) =>
    `button:has-text("${TEXT_PATTERNS.BILINGUAL[textKey].source}")`,
    
  /**
   * Get form input by placeholder pattern
   */
  inputByPlaceholder: (pattern: string) => `input[placeholder*="${pattern}"]`,
  
  /**
   * Get textarea by placeholder pattern  
   */
  textareaByPlaceholder: (pattern: string) => `textarea[placeholder*="${pattern}"]`,
} as const;

/**
 * Viewport and timing constants for consistent test behavior
 */
export const TEST_CONFIG = {
  TIMEOUTS: {
    SHORT: 2000,
    MEDIUM: 5000,
    LONG: 10000,
    NAVIGATION: 30000,
  },
  
  VIEWPORT: {
    WIDTH: 1280,
    HEIGHT: 720,
  },
  
  WAIT_TIMES: {
    INTERACTION: 100,
    HYDRATION: 500,
    ANIMATION: 300,
  },
} as const;