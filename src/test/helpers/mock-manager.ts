import { vi, type MockedFunction } from 'vitest';

/**
 * MockManager - Utility for managing mock state and preserving implementations
 * Helps prevent mock implementations from being lost during test execution
 */
export class MockManager {
  private static instance: MockManager;
  private implementations: Map<string, any> = new Map();
  private mockHistory: Map<string, any[]> = new Map();

  private constructor() {}

  static getInstance(): MockManager {
    if (!MockManager.instance) {
      MockManager.instance = new MockManager();
    }
    return MockManager.instance;
  }

  /**
   * Preserve a mock implementation for later restoration
   */
  preserveMock(name: string, implementation: any): void {
    this.implementations.set(name, implementation);
  }

  /**
   * Restore a preserved mock implementation
   */
  restoreMock(name: string): any {
    return this.implementations.get(name);
  }

  /**
   * Restore all preserved mock implementations
   */
  restoreAllMocks(): void {
    this.implementations.forEach((impl, name) => {
      // Re-apply the implementation if the mock exists
      const mockPath = name.split('.');
      let target: any = global;
      
      for (let i = 0; i < mockPath.length - 1; i++) {
        target = target[mockPath[i]];
        if (!target) return;
      }
      
      const methodName = mockPath[mockPath.length - 1];
      if (target[methodName] && typeof target[methodName].mockImplementation === 'function') {
        target[methodName].mockImplementation(impl);
      }
    });
  }

  /**
   * Clear only mock call history, preserving implementations
   */
  clearCallHistory(): void {
    vi.clearAllMocks();
    // Restore implementations after clearing
    this.restoreAllMocks();
  }

  /**
   * Save current mock state for comparison
   */
  saveMockState(name: string, mock: MockedFunction<any>): void {
    if (!this.mockHistory.has(name)) {
      this.mockHistory.set(name, []);
    }
    
    const history = this.mockHistory.get(name)!;
    history.push({
      calls: [...mock.mock.calls],
      results: [...mock.mock.results],
      timestamp: Date.now()
    });
  }

  /**
   * Get mock call history
   */
  getMockHistory(name: string): any[] {
    return this.mockHistory.get(name) || [];
  }

  /**
   * Clear all preserved implementations and history
   */
  reset(): void {
    this.implementations.clear();
    this.mockHistory.clear();
  }

  /**
   * Create a preserved mock with automatic restoration
   */
  createPreservedMock<T extends (...args: any[]) => any>(
    name: string,
    implementation: T
  ): MockedFunction<T> {
    const mock = vi.fn(implementation);
    this.preserveMock(name, implementation);
    return mock;
  }

  /**
   * Wrap existing mocks to preserve their implementations
   */
  wrapMock<T extends (...args: any[]) => any>(
    name: string,
    mock: MockedFunction<T>
  ): MockedFunction<T> {
    const currentImpl = mock.getMockImplementation();
    if (currentImpl) {
      this.preserveMock(name, currentImpl);
    }
    return mock;
  }
}

// Export singleton instance
export const mockManager = MockManager.getInstance();

/**
 * Helper function to preserve all mocks in a module
 */
export function preserveModuleMocks(moduleName: string, moduleExports: any): void {
  const manager = MockManager.getInstance();
  
  Object.keys(moduleExports).forEach(key => {
    const value = moduleExports[key];
    if (typeof value === 'function' && value._isMockFunction) {
      manager.wrapMock(`${moduleName}.${key}`, value);
    }
  });
}

/**
 * Helper to create a mock that auto-preserves its implementation
 */
export function createAutoPreservedMock<T extends (...args: any[]) => any>(
  name: string,
  implementation: T
): MockedFunction<T> {
  return mockManager.createPreservedMock(name, implementation);
}

/**
 * Clear all mock call histories while preserving implementations
 */
export function clearMockCallsOnly(): void {
  mockManager.clearCallHistory();
}

/**
 * Reset mock manager state (use in afterAll or when needed)
 */
export function resetMockManager(): void {
  mockManager.reset();
}