/**
 * localStorage helpers for case management test data seeding
 * Provides consistent methods for setting up test data in localStorage
 */

import { Page } from '@playwright/test';
import { TestCase, CASE_SETS, testDataHelpers } from '../fixtures/case-data';

export interface StorageHelpers {
  /**
   * Clear all case data from localStorage
   */
  clearCases: (page: Page) => Promise<void>;
  
  /**
   * Seed localStorage with test cases
   */
  seedCases: (page: Page, cases: TestCase[]) => Promise<void>;
  
  /**
   * Get cases from localStorage
   */
  getCases: (page: Page) => Promise<TestCase[]>;
  
  /**
   * Verify localStorage contains expected cases
   */
  verifyCases: (page: Page, expectedCases: TestCase[]) => Promise<boolean>;
  
  /**
   * Set up empty state (no cases)
   */
  setupEmptyState: (page: Page) => Promise<void>;
  
  /**
   * Set up predefined case set
   */
  setupCaseSet: (page: Page, setName: keyof typeof CASE_SETS) => Promise<void>;
}

/**
 * Main storage helpers implementation
 */
export const caseStorage: StorageHelpers = {
  /**
   * Clear all case data from localStorage
   */
  clearCases: async (page: Page): Promise<void> => {
    await page.evaluate(() => {
      localStorage.removeItem('lexmx_cases');
      localStorage.removeItem('lexmx_case_settings');
    });
  },

  /**
   * Seed localStorage with test cases
   */
  seedCases: async (page: Page, cases: TestCase[]): Promise<void> => {
    // Convert cases to the format expected by the application
    const formattedCases = testDataHelpers.toStorageFormat(cases);
    
    await page.evaluate((casesToSeed) => {
      localStorage.setItem('lexmx_cases', JSON.stringify(casesToSeed));
    }, formattedCases);
  },

  /**
   * Get cases from localStorage
   */
  getCases: async (page: Page): Promise<TestCase[]> => {
    const cases = await page.evaluate(() => {
      const stored = localStorage.getItem('lexmx_cases');
      return stored ? JSON.parse(stored) : [];
    });
    
    return cases || [];
  },

  /**
   * Verify localStorage contains expected cases
   */
  verifyCases: async (page: Page, expectedCases: TestCase[]): Promise<boolean> => {
    const actualCases = await caseStorage.getCases(page);
    
    if (actualCases.length !== expectedCases.length) {
      return false;
    }
    
    // Check each expected case exists
    return expectedCases.every(expected => 
      actualCases.some(actual => actual.id === expected.id && actual.title === expected.title)
    );
  },

  /**
   * Set up empty state (no cases)
   */
  setupEmptyState: async (page: Page): Promise<void> => {
    await page.evaluate(() => {
      localStorage.setItem('lexmx_cases', JSON.stringify([]));
    });
  },

  /**
   * Set up predefined case set
   */
  setupCaseSet: async (page: Page, setName: keyof typeof CASE_SETS): Promise<void> => {
    const cases = CASE_SETS[setName];
    await caseStorage.seedCases(page, cases);
  },
};

/**
 * Specialized storage helpers for common test scenarios
 */
export const storageScenarios = {
  /**
   * Set up for empty state tests
   */
  emptyState: async (page: Page): Promise<void> => {
    await caseStorage.setupEmptyState(page);
  },

  /**
   * Set up for single case tests
   */
  singleCase: async (page: Page): Promise<void> => {
    await caseStorage.setupCaseSet(page, 'SINGLE');
  },

  /**
   * Set up for multiple cases with different statuses
   */
  multipleStatuses: async (page: Page): Promise<void> => {
    await caseStorage.setupCaseSet(page, 'MULTIPLE_STATUS');
  },

  /**
   * Set up for search functionality tests
   */
  searchTest: async (page: Page): Promise<void> => {
    await caseStorage.setupCaseSet(page, 'SEARCH_TEST_SET');
  },

  /**
   * Set up for filter tests (same area)
   */
  filterTest: async (page: Page): Promise<void> => {
    await caseStorage.setupCaseSet(page, 'SAME_AREA');
  },
};

/**
 * Advanced storage operations
 */
export const advancedStorage = {
  /**
   * Add a single case to existing cases
   */
  addCase: async (page: Page, newCase: TestCase): Promise<void> => {
    const existingCases = await caseStorage.getCases(page);
    existingCases.push(newCase);
    await caseStorage.seedCases(page, existingCases);
  },

  /**
   * Remove a case by ID
   */
  removeCase: async (page: Page, caseId: string): Promise<void> => {
    const existingCases = await caseStorage.getCases(page);
    const filteredCases = existingCases.filter(c => c.id !== caseId);
    await caseStorage.seedCases(page, filteredCases);
  },

  /**
   * Update a case by ID
   */
  updateCase: async (page: Page, caseId: string, updates: Partial<TestCase>): Promise<void> => {
    const existingCases = await caseStorage.getCases(page);
    const updatedCases = existingCases.map(c => 
      c.id === caseId ? { ...c, ...updates } : c
    );
    await caseStorage.seedCases(page, updatedCases);
  },

  /**
   * Set up custom scenario with specific case configurations
   */
  setupCustomScenario: async (page: Page, config: {
    activeCases?: number;
    pendingCases?: number; 
    resolvedCases?: number;
    archivedCases?: number;
  }): Promise<void> => {
    const cases: TestCase[] = [];
    let id = 1;

    // Add active cases
    if (config.activeCases) {
      for (let i = 0; i < config.activeCases; i++) {
        cases.push({
          id: `active-${id++}`,
          title: `Active Case ${i + 1}`,
          description: `Active case description ${i + 1}`,
          client: `Active Client ${i + 1}`,
          caseNumber: `ACT-${String(i + 1).padStart(3, '0')}`,
          legalArea: 'civil',
          status: 'active',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: [],
        });
      }
    }

    // Add pending cases
    if (config.pendingCases) {
      for (let i = 0; i < config.pendingCases; i++) {
        cases.push({
          id: `pending-${id++}`,
          title: `Pending Case ${i + 1}`,
          description: `Pending case description ${i + 1}`,
          client: `Pending Client ${i + 1}`,
          caseNumber: `PEN-${String(i + 1).padStart(3, '0')}`,
          legalArea: 'labor',
          status: 'pending',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: [],
        });
      }
    }

    // Add resolved cases  
    if (config.resolvedCases) {
      for (let i = 0; i < config.resolvedCases; i++) {
        cases.push({
          id: `resolved-${id++}`,
          title: `Resolved Case ${i + 1}`,
          description: `Resolved case description ${i + 1}`,
          client: `Resolved Client ${i + 1}`,
          caseNumber: `RES-${String(i + 1).padStart(3, '0')}`,
          legalArea: 'commercial',
          status: 'resolved',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: [],
        });
      }
    }

    // Add archived cases
    if (config.archivedCases) {
      for (let i = 0; i < config.archivedCases; i++) {
        cases.push({
          id: `archived-${id++}`,
          title: `Archived Case ${i + 1}`,
          description: `Archived case description ${i + 1}`,
          client: `Archived Client ${i + 1}`,
          caseNumber: `ARC-${String(i + 1).padStart(3, '0')}`,
          legalArea: 'tax',
          status: 'archived',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: [],
        });
      }
    }

    await caseStorage.seedCases(page, cases);
  },
};

/**
 * Test data validation helpers
 */
export const storageValidation = {
  /**
   * Ensure localStorage is properly cleared
   */
  ensureCleanState: async (page: Page): Promise<void> => {
    await page.evaluate(() => {
      // Clear all LexMX related localStorage items
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('lexmx_')) {
          localStorage.removeItem(key);
        }
      });
    });
  },

  /**
   * Wait for localStorage to be ready after seeding
   */
  waitForStorageReady: async (page: Page, timeout = 1000): Promise<void> => {
    await page.waitForFunction(
      () => localStorage.getItem('lexmx_cases') !== null,
      { timeout }
    );
  },

  /**
   * Verify no unexpected data exists
   */
  verifyCleanState: async (page: Page): Promise<boolean> => {
    const hasUnexpectedData = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.some(key => key.startsWith('lexmx_') && key !== 'lexmx_cases');
    });
    
    return !hasUnexpectedData;
  },
};