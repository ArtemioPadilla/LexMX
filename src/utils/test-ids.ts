/**
 * Centralized test IDs for consistent testing across the application
 * All interactive elements should use these IDs via data-testid attribute
 */

export const TEST_IDS = {
  // Navigation
  nav: {
    home: 'nav-home',
    chat: 'nav-chat',
    cases: 'nav-cases',
    wiki: 'nav-wiki',
    codes: 'nav-codes',
    setup: 'nav-setup',
  },

  // Homepage
  home: {
    heroTitle: 'hero-title',
    ctaChat: 'cta-chat',
    ctaSetup: 'cta-setup',
    ctaDocuments: 'cta-documents',
  },

  // Chat Interface
  chat: {
    container: 'chat-container',
    messageList: 'chat-messages',
    input: 'chat-input',
    sendButton: 'chat-send',
    clearButton: 'chat-clear',
    welcomeMessage: 'chat-welcome',
    exampleQuestions: 'chat-examples',
    processingIndicator: 'chat-processing',
  },

  // Provider Setup
  provider: {
    container: 'provider-setup',
    selector: 'provider-selector',
    selectorToggle: 'provider-selector-toggle',
    webllmButton: 'provider-webllm',
    openaiButton: 'provider-openai',
    claudeButton: 'provider-claude',
    geminiButton: 'provider-gemini',
    saveButton: 'provider-save',
    skipButton: 'provider-skip',
    modelSelector: 'provider-model-selector',
    apiKeyInput: 'provider-api-key',
    successMessage: 'provider-success',
  },

  // Corpus Selector
  corpus: {
    container: 'corpus-container',
    selectorToggle: 'corpus-selector-toggle',
    dropdown: 'corpus-dropdown',
    selectAll: 'corpus-select-all',
    clearAll: 'corpus-clear-all',
    areaTab: 'corpus-tab-areas',
    documentTab: 'corpus-tab-documents',
    searchInput: 'corpus-search',
    areaButton: (area: string) => `corpus-area-${area}`,
    documentButton: (id: string) => `corpus-doc-${id}`,
    selectedCount: 'corpus-selected-count',
  },

  // Case Management
  cases: {
    container: 'case-manager',
    sidebar: 'case-sidebar',
    newCaseButton: 'new-case-button',
    searchInput: 'case-search',
    caseList: 'case-list',
    caseItem: (id: string) => `case-item-${id}`,
    caseTitle: 'case-title-input',
    caseDescription: 'case-description-input',
    caseClient: 'case-client-input',
    caseArea: 'case-area-select',
    createButton: 'case-create',
    cancelButton: 'case-cancel',
    deleteButton: 'case-delete',
    editButton: 'case-edit',
  },

  // Theme & Language
  theme: {
    toggle: 'theme-toggle',
    dropdownButton: 'theme-dropdown-button',
    lightOption: 'theme-light',
    darkOption: 'theme-dark',
    systemOption: 'theme-system',
  },

  language: {
    selector: 'language-selector',
    dropdownButton: 'language-dropdown-button',
    spanishOption: 'language-es',
    englishOption: 'language-en',
  },

  // Loading States
  loading: {
    skeleton: 'loading-skeleton',
    spinner: 'loading-spinner',
    overlay: 'loading-overlay',
  },

  // Error States
  error: {
    message: 'error-message',
    retry: 'error-retry',
    dismiss: 'error-dismiss',
  },

  // Modals
  modal: {
    container: 'modal-container',
    backdrop: 'modal-backdrop',
    close: 'modal-close',
    confirm: 'modal-confirm',
    cancel: 'modal-cancel',
  },
  
  // Document Components
  documents: {
    requestForm: 'document-request-form',
    requestList: 'document-request-list',
    viewer: 'document-viewer',
    viewerWrapper: 'document-viewer-wrapper',
    uploadButton: 'document-upload',
    downloadButton: 'document-download',
  },
  
  // Wiki Components
  wiki: {
    navigation: 'wiki-navigation',
    glossary: 'legal-glossary',
    legislativeProcess: 'legislative-process',
    governmentStructure: 'government-structure',
    searchInput: 'wiki-search',
    articleContent: 'wiki-article',
  },
  
  // Mobile Components
  mobile: {
    menu: 'mobile-menu',
    menuToggle: 'mobile-menu-toggle',
    menuClose: 'mobile-menu-close',
    overlay: 'mobile-menu-overlay',
  },
  
  // Notification Components
  notifications: {
    center: 'notification-center',
    badge: 'notification-badge',
    list: 'notification-list',
    item: (id: string) => `notification-${id}`,
    markRead: 'notification-mark-read',
    clearAll: 'notification-clear-all',
  },
  
  // Provider Recommendation
  recommendation: {
    container: 'provider-recommendation',
    acceptButton: 'recommendation-accept',
    dismissButton: 'recommendation-dismiss',
    learnMore: 'recommendation-learn-more',
  },
  
  // Moderation Panel
  moderation: {
    panel: 'moderation-panel',
    filterToggle: 'moderation-filter-toggle',
    reportButton: 'moderation-report',
    approveButton: 'moderation-approve',
    rejectButton: 'moderation-reject',
  },
  
  // WebLLM Specific
  webllm: {
    modelDownload: 'webllm-model-download',
    downloadProgress: 'webllm-download-progress',
    modelSelector: 'webllm-model-selector',
    confirmDownload: 'webllm-confirm-download',
    cancelDownload: 'webllm-cancel-download',
    status: 'webllm-status',
  },
  
  // Hydration States
  hydration: {
    boundary: (component: string) => `${component}-hydration-boundary`,
    loading: (component: string) => `${component}-loading`,
    ready: (component: string) => `${component}-ready`,
  },
} as const;

// Type-safe helper to get test ID
export function getTestId(path: string): string {
  const parts = path.split('.');
  let current: any = TEST_IDS;
  
  for (const part of parts) {
    current = current[part];
    if (!current) {
      console.warn(`Test ID not found: ${path}`);
      return path;
    }
  }
  
  return typeof current === 'function' ? current : current as string;
}