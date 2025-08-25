/**
 * Modal Interaction Helper
 * Provides robust patterns for modal interactions in case management
 */

import { Page, expect } from '@playwright/test';
import { MODAL_SELECTORS, CASE_DETAIL_SELECTORS } from '../constants/selectors';

export const modalHelpers = {
  /**
   * Open the edit case modal
   */
  async openEditModal(page: Page) {
    const editButton = page.locator(CASE_DETAIL_SELECTORS.EDIT_BUTTON);
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // Wait for modal to appear
    const modal = page.locator(MODAL_SELECTORS.EDIT_CASE_MODAL);
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for modal animation to complete
    await page.waitForTimeout(300);

    return modal;
  },

  /**
   * Fill and save the edit case form
   */
  async fillAndSaveEditForm(page: Page, formData: {
    title?: string;
    description?: string;
    client?: string;
    status?: string;
  }) {
    // Wait for form to be ready
    const form = page.locator(MODAL_SELECTORS.EDIT_FORM);
    await expect(form).toBeVisible();

    // Fill form fields if provided
    if (formData.title) {
      const titleInput = page.locator(MODAL_SELECTORS.EDIT_TITLE_INPUT);
      await expect(titleInput).toBeVisible();
      await titleInput.clear();
      await titleInput.fill(formData.title);
    }

    if (formData.description) {
      const descInput = page.locator(MODAL_SELECTORS.EDIT_DESCRIPTION_TEXTAREA);
      await expect(descInput).toBeVisible();
      await descInput.clear();
      await descInput.fill(formData.description);
    }

    if (formData.client) {
      const clientInput = page.locator(MODAL_SELECTORS.EDIT_CLIENT_INPUT);
      await expect(clientInput).toBeVisible();
      await clientInput.clear();
      await clientInput.fill(formData.client);
    }

    if (formData.status) {
      const statusSelect = page.locator(MODAL_SELECTORS.EDIT_STATUS_SELECT);
      await expect(statusSelect).toBeVisible();
      await statusSelect.selectOption(formData.status);
    }

    // Submit form
    const saveButton = page.locator(MODAL_SELECTORS.EDIT_SAVE_BUTTON);
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for modal to close
    await expect(page.locator(MODAL_SELECTORS.EDIT_CASE_MODAL)).not.toBeVisible({ timeout: 5000 });

    // Allow time for state updates
    await page.waitForTimeout(500);
  },

  /**
   * Cancel edit modal without saving
   */
  async cancelEditModal(page: Page) {
    const cancelButton = page.locator(MODAL_SELECTORS.EDIT_CANCEL_BUTTON);
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Wait for modal to close
    await expect(page.locator(MODAL_SELECTORS.EDIT_CASE_MODAL)).not.toBeVisible({ timeout: 5000 });
  },

  /**
   * Verify modal is open
   */
  async verifyModalOpen(page: Page) {
    const modal = page.locator(MODAL_SELECTORS.EDIT_CASE_MODAL);
    await expect(modal).toBeVisible();
    
    // Verify modal overlay is present
    const overlay = page.locator(MODAL_SELECTORS.MODAL_OVERLAY);
    await expect(overlay).toBeVisible();
  },

  /**
   * Verify modal is closed
   */
  async verifyModalClosed(page: Page) {
    const modal = page.locator(MODAL_SELECTORS.EDIT_CASE_MODAL);
    await expect(modal).not.toBeVisible();
  },

  /**
   * Get modal form values for verification
   */
  async getModalFormValues(page: Page) {
    const modal = page.locator(MODAL_SELECTORS.EDIT_CASE_MODAL);
    await expect(modal).toBeVisible();

    const title = await page.locator(MODAL_SELECTORS.EDIT_TITLE_INPUT).inputValue();
    const description = await page.locator(MODAL_SELECTORS.EDIT_DESCRIPTION_TEXTAREA).inputValue();
    const client = await page.locator(MODAL_SELECTORS.EDIT_CLIENT_INPUT).inputValue();
    const status = await page.locator(MODAL_SELECTORS.EDIT_STATUS_SELECT).inputValue();

    return { title, description, client, status };
  },
};