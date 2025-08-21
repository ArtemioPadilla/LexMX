/**
 * Test utilities for React component testing
 * Provides custom render function with providers and common test helpers
 */

import React, { ReactElement, Suspense } from 'react';
import { render, RenderOptions, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { act } from 'react';

// Mock i18n system for tests
const mockI18n = {
  language: 'en',
  changeLanguage: vi.fn(),
  t: (key: string, params?: Record<string, unknown>) => {
    // Return the key for testing, optionally with params
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
  getSection: (_section: string) => ({}),
  getAvailableLanguages: () => [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' }
  ]
};

// Mock translation provider component
const MockTranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Mock useTranslation hook
export const mockUseTranslation = () => mockI18n;

// Error boundary for testing
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Test Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">
          <h2>Something went wrong in test.</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Astro Island Wrapper to simulate hydration
const AstroIslandWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div data-astro-island="true" data-hydrated="true">
      {children}
    </div>
  );
};

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withProviders?: boolean;
  initialLanguage?: 'es' | 'en';
  withErrorBoundary?: boolean;
  withSuspense?: boolean;
  withAstroIsland?: boolean;
}

export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { 
    withProviders = true, 
    initialLanguage = 'en', 
    withErrorBoundary = true,
    withSuspense = true,
    withAstroIsland = true,
    ...renderOptions 
  } = options;
  
  // Always create a proper container for React 18
  if (!renderOptions.container) {
    let container = document.getElementById('test-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'test-root';
      document.body.appendChild(container);
    }
    renderOptions.container = container;
  }

  // Update mock language if specified
  if (initialLanguage) {
    mockI18n.language = initialLanguage;
  }

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    let wrappedChildren = children;

    // Wrap with Astro Island simulation
    if (withAstroIsland) {
      wrappedChildren = (
        <AstroIslandWrapper>
          {wrappedChildren}
        </AstroIslandWrapper>
      );
    }

    // Wrap with Suspense for async components
    if (withSuspense) {
      wrappedChildren = (
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          {wrappedChildren}
        </Suspense>
      );
    }

    // Wrap with Error Boundary
    if (withErrorBoundary) {
      wrappedChildren = (
        <TestErrorBoundary>
          {wrappedChildren}
        </TestErrorBoundary>
      );
    }

    // Wrap with Translation Provider
    if (withProviders) {
      wrappedChildren = (
        <MockTranslationProvider>
          {wrappedChildren}
        </MockTranslationProvider>
      );
    }

    return <>{wrappedChildren}</>;
  };

  const user = userEvent.setup();

  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';

// Override the default render with our custom render
export { customRender as render };

// Async rendering helper for React 18 and components with async effects
export const renderAsync = async (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  let result;
  await act(async () => {
    result = customRender(ui, options);
  });
  
  // Wait a tick for effects to run
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  
  return result!;
};

// Wait for async operations to complete
export const waitForAsyncOperations = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

// Common test helpers
export const testHelpers = {
  // Wait for element to appear
  waitForElement: async (text: string | RegExp, timeout = 5000) => {
    return await screen.findByText(text, {}, { timeout });
  },

  // Wait for component to finish loading
  waitForLoading: async () => {
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Additional wait for React concurrent features
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  },

  // Check if error boundary was triggered
  hasErrorBoundary: () => {
    return screen.queryByTestId('error-boundary') !== null;
  },

  // Get element by test ID
  getByTestId: (testId: string) => {
    return screen.getByTestId(testId);
  },

  // Query element by test ID
  queryByTestId: (testId: string) => {
    return screen.queryByTestId(testId);
  },

  // Wait for element by test ID
  findByTestId: async (testId: string) => {
    return await screen.findByTestId(testId);
  },

  // Mock event handlers
  mockHandlers: {
    onClick: vi.fn(),
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onError: vi.fn(),
    onSuccess: vi.fn()
  },

  // Reset all mock handlers
  resetMockHandlers: () => {
    Object.values(testHelpers.mockHandlers).forEach(mock => mock.mockClear());
  },

  // Create mock file for upload tests
  createMockFile: (name = 'test.txt', _size = 1024, type = 'text/plain') => {
    return new File(['test content'], name, { type });
  },

  // Create mock blob
  createMockBlob: (content = 'test content', type = 'text/plain') => {
    return new Blob([content], { type });
  }
};

// Mock fetch for API tests
export const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock responses helpers
export const mockResponses = {
  success: (data: unknown = {}) => ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data))
  }),

  error: (status = 500, message = 'Server Error') => ({
    ok: false,
    status,
    statusText: message,
    json: vi.fn().mockRejectedValue(new Error(message)),
    text: vi.fn().mockResolvedValue(message)
  }),

  networkError: () => Promise.reject(new Error('Network Error'))
};

// Accessibility testing helpers
export const axeHelpers = {
  // Check for accessibility violations
  checkA11y: async (container: HTMLElement) => {
    // This would integrate with axe-core in a real implementation
    // For now, just basic checks
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      if (!button.getAttribute('aria-label') && !button.textContent?.trim()) {
        console.warn('Button without accessible name found');
      }
    });

    const inputs = container.querySelectorAll('input');
    inputs.forEach(input => {
      if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
        const label = container.querySelector(`label[for="${input.id}"]`);
        if (!label) {
          console.warn('Input without accessible name found');
        }
      }
    });
  }
};

// Export mock i18n for use in component tests
export { mockI18n };

// Custom matchers (if needed)
export const customMatchers = {
  toHaveTranslation: (received: string, expected: string) => {
    const pass = received === expected;
    return {
      message: () => `expected ${received} to ${pass ? 'not ' : ''}equal translation ${expected}`,
      pass
    };
  }
};