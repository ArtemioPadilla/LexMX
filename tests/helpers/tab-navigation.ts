/**
 * Tab Navigation Helper
 * Provides robust patterns for case detail tab interactions
 */

import { Page, expect } from '@playwright/test';
import { TAB_SELECTORS } from '../constants/selectors';

export const tabHelpers = {
  /**
   * Switch to a specific tab and wait for content to load
   */
  async switchToTab(page: Page, tabName: 'overview' | 'documents' | 'notes' | 'chat' | 'timeline') {
    // Map tab names to selectors
    const tabSelectors = {
      overview: TAB_SELECTORS.OVERVIEW_TAB,
      documents: TAB_SELECTORS.DOCUMENTS_TAB,
      notes: TAB_SELECTORS.NOTES_TAB,
      chat: TAB_SELECTORS.CHAT_TAB,
      timeline: TAB_SELECTORS.TIMELINE_TAB,
    };

    const contentSelectors = {
      overview: TAB_SELECTORS.OVERVIEW_CONTENT,
      documents: TAB_SELECTORS.DOCUMENTS_CONTENT,
      notes: TAB_SELECTORS.NOTES_CONTENT,
      chat: '[data-tab-content="chat"]',
      timeline: '[data-tab-content="timeline"]',
    };

    // Click the tab button
    const tabButton = page.locator(tabSelectors[tabName]);
    await expect(tabButton).toBeVisible({ timeout: 5000 });
    await tabButton.click();

    // Wait for tab content to load (if content selector exists)
    if (contentSelectors[tabName]) {
      const tabContent = page.locator(contentSelectors[tabName]);
      await expect(tabContent).toBeVisible({ timeout: 5000 });
    }

    // Allow time for any animations/transitions
    await page.waitForTimeout(300);

    return {
      tabButton,
      content: contentSelectors[tabName] ? page.locator(contentSelectors[tabName]) : null,
    };
  },

  /**
   * Verify a specific tab is active
   */
  async verifyActiveTab(page: Page, tabName: 'overview' | 'documents' | 'notes' | 'chat' | 'timeline') {
    const tabSelectors = {
      overview: TAB_SELECTORS.OVERVIEW_TAB,
      documents: TAB_SELECTORS.DOCUMENTS_TAB, 
      notes: TAB_SELECTORS.NOTES_TAB,
      chat: TAB_SELECTORS.CHAT_TAB,
      timeline: TAB_SELECTORS.TIMELINE_TAB,
    };

    const activeTab = page.locator(tabSelectors[tabName]);
    await expect(activeTab).toHaveClass(/border-legal-500|text-legal-600/);
  },

  /**
   * Get all available tabs
   */
  async getAllTabs(page: Page) {
    const tabs = page.locator('button[data-tab]');
    return tabs;
  },
};