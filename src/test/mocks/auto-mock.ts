/**
 * Automatic mocking utilities for comprehensive service mocking
 * Provides intelligent auto-mocking based on TypeScript interfaces and reflection
 */

import { vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Configuration for auto-mocking behavior
 */
export interface AutoMockConfig {
  /** Whether to include EventEmitter methods in mocking */
  includeEventEmitter?: boolean;
  /** Default return values for specific method name patterns */
  defaultReturns?: Record<string, any>;
  /** Methods to skip during auto-mocking */
  skipMethods?: string[];
  /** Whether to mock async methods with Promise.resolve */
  mockAsync?: boolean;
  /** Default delay for async operations (ms) */
  asyncDelay?: number;
  /** Default failure rate for testing error scenarios */
  failureRate?: number;
}

/**
 * Mock call tracking for validation and debugging
 */
export interface MockCallTracker {
  method: string;
  args: any[];
  timestamp: number;
  returned?: any;
  threw?: Error;
}

/**
 * Automatically mock all methods of a service class
 */
export function autoMockService<T extends object>(
  serviceClass: new (...args: any[]) => T,
  config: AutoMockConfig = {}
): T & {
  __mockCalls: MockCallTracker[];
  __resetMocks: () => void;
  __validateCalls: (expectations: Record<string, any>) => boolean;
} {
  const {
    includeEventEmitter = true,
    defaultReturns = {},
    skipMethods = [],
    mockAsync = true,
    asyncDelay = 0,
    failureRate = 0
  } = config;

  // Create a mock instance
  const mockInstance = includeEventEmitter ? new EventEmitter() : {};
  const mockCalls: MockCallTracker[] = [];

  // Get all methods from the service prototype
  const prototype = serviceClass.prototype;
  const propertyNames = getAllPropertyNames(prototype);
  
  // Standard service methods that are commonly async
  const asyncMethods = new Set([
    'initialize', 'destroy', 'load', 'save', 'fetch', 'create', 'update', 
    'delete', 'get', 'set', 'search', 'find', 'process', 'execute',
    'validate', 'generate', 'import', 'export', 'sync', 'upload',
    'download', 'connect', 'disconnect'
  ]);

  propertyNames.forEach(propName => {
    if (
      propName === 'constructor' ||
      propName.startsWith('_') ||
      skipMethods.includes(propName) ||
      (includeEventEmitter && EventEmitter.prototype[propName as keyof EventEmitter])
    ) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototype, propName);
    if (descriptor && typeof descriptor.value === 'function') {
      const isAsync = mockAsync && (
        asyncMethods.has(propName) ||
        propName.endsWith('Async') ||
        propName.startsWith('load') ||
        propName.startsWith('save') ||
        propName.startsWith('fetch') ||
        propName.startsWith('get') ||
        propName.startsWith('set')
      );

      // Create mock function with intelligent defaults
      const mockFn = vi.fn().mockImplementation((...args: any[]) => {
        const callRecord: MockCallTracker = {
          method: propName,
          args: [...args],
          timestamp: Date.now()
        };

        try {
          let result;

          // Check for specific default return
          if (defaultReturns[propName] !== undefined) {
            result = defaultReturns[propName];
          } else {
            // Infer return value based on method name
            result = inferReturnValue(propName, args);
          }

          // Handle async methods
          if (isAsync) {
            result = createAsyncResult(result, asyncDelay, failureRate);
          }

          callRecord.returned = result;
          return result;
        } catch (error) {
          callRecord.threw = error as Error;
          throw error;
        } finally {
          mockCalls.push(callRecord);
        }
      });

      Object.defineProperty(mockInstance, propName, {
        value: mockFn,
        writable: true,
        configurable: true
      });
    }
  });

  // Add utility methods for testing
  Object.defineProperty(mockInstance, '__mockCalls', {
    get: () => [...mockCalls],
    configurable: true
  });

  Object.defineProperty(mockInstance, '__resetMocks', {
    value: () => {
      mockCalls.length = 0;
      Object.keys(mockInstance).forEach(key => {
        const value = mockInstance[key as keyof typeof mockInstance];
        if (vi.isMockFunction(value)) {
          value.mockClear();
        }
      });
    },
    configurable: true
  });

  Object.defineProperty(mockInstance, '__validateCalls', {
    value: (expectations: Record<string, any>) => {
      for (const [method, expectation] of Object.entries(expectations)) {
        const calls = mockCalls.filter(call => call.method === method);
        
        if (typeof expectation === 'number') {
          if (calls.length !== expectation) {
            console.error(`Expected ${expectation} calls to ${method}, got ${calls.length}`);
            return false;
          }
        } else if (typeof expectation === 'object') {
          if (expectation.times !== undefined && calls.length !== expectation.times) {
            console.error(`Expected ${expectation.times} calls to ${method}, got ${calls.length}`);
            return false;
          }
          if (expectation.with !== undefined) {
            const matchingCalls = calls.filter(call => 
              JSON.stringify(call.args) === JSON.stringify(expectation.with)
            );
            if (matchingCalls.length === 0) {
              console.error(`Expected call to ${method} with args ${JSON.stringify(expectation.with)}, but not found`);
              return false;
            }
          }
        }
      }
      return true;
    },
    configurable: true
  });

  return mockInstance as T & {
    __mockCalls: MockCallTracker[];
    __resetMocks: () => void;
    __validateCalls: (expectations: Record<string, any>) => boolean;
  };
}

/**
 * Create spies for all methods of an object
 */
export function spyOnAllMethods<T extends object>(
  target: T,
  config: { skipMethods?: string[]; mockImplementation?: boolean } = {}
): T & Record<string, MockedFunction<any>> {
  const { skipMethods = [], mockImplementation = false } = config;
  const spiedObject = { ...target } as any;

  Object.getOwnPropertyNames(target).forEach(propName => {
    if (
      propName === 'constructor' ||
      skipMethods.includes(propName) ||
      typeof target[propName as keyof T] !== 'function'
    ) {
      return;
    }

    const originalMethod = target[propName as keyof T] as any;
    spiedObject[propName] = mockImplementation 
      ? vi.fn().mockImplementation(originalMethod)
      : vi.fn(originalMethod);
  });

  return spiedObject;
}

/**
 * Reset all mocks in the current test context
 * Only clears call history, preserves mock implementations
 */
export function resetAllMocks(): void {
  // Only clear call history, not implementations
  vi.clearAllMocks();
}

/**
 * Validate mock calls against expectations
 */
export function validateMockCalls(
  mock: MockedFunction<any>,
  expectations: {
    times?: number;
    calledWith?: any[];
    returned?: any;
    threw?: Error;
    nthCall?: { n: number; args: any[] };
  }
): boolean {
  if (expectations.times !== undefined) {
    if (mock.mock.calls.length !== expectations.times) {
      console.error(`Expected ${expectations.times} calls, got ${mock.mock.calls.length}`);
      return false;
    }
  }

  if (expectations.calledWith !== undefined) {
    const found = mock.mock.calls.some(call => 
      JSON.stringify(call) === JSON.stringify(expectations.calledWith)
    );
    if (!found) {
      console.error(`Expected call with args ${JSON.stringify(expectations.calledWith)}, but not found`);
      return false;
    }
  }

  if (expectations.returned !== undefined) {
    const found = mock.mock.results.some(result => 
      result.type === 'return' && result.value === expectations.returned
    );
    if (!found) {
      console.error(`Expected return value ${expectations.returned}, but not found`);
      return false;
    }
  }

  if (expectations.threw !== undefined) {
    const found = mock.mock.results.some(result => 
      result.type === 'throw' && result.value === expectations.threw
    );
    if (!found) {
      console.error(`Expected thrown error ${expectations.threw}, but not found`);
      return false;
    }
  }

  if (expectations.nthCall !== undefined) {
    const { n, args } = expectations.nthCall;
    const call = mock.mock.calls[n - 1]; // nth call is 1-indexed
    if (!call || JSON.stringify(call) !== JSON.stringify(args)) {
      console.error(`Expected ${n}th call with args ${JSON.stringify(args)}, got ${JSON.stringify(call)}`);
      return false;
    }
  }

  return true;
}

/**
 * Create a mock that tracks method call sequences
 */
export function createSequenceMock<T>(
  methods: (keyof T)[],
  expectedSequence: (keyof T)[]
): T & { __validateSequence: () => boolean; __getCallSequence: () => (keyof T)[] } {
  const callSequence: (keyof T)[] = [];
  const mockObj = {} as any;

  methods.forEach(method => {
    mockObj[method] = vi.fn().mockImplementation((...args: any[]) => {
      callSequence.push(method);
      return Promise.resolve(undefined);
    });
  });

  mockObj.__validateSequence = () => {
    if (callSequence.length !== expectedSequence.length) {
      console.error(`Expected sequence length ${expectedSequence.length}, got ${callSequence.length}`);
      return false;
    }

    for (let i = 0; i < expectedSequence.length; i++) {
      if (callSequence[i] !== expectedSequence[i]) {
        console.error(`Expected ${String(expectedSequence[i])} at position ${i}, got ${String(callSequence[i])}`);
        return false;
      }
    }

    return true;
  };

  mockObj.__getCallSequence = () => [...callSequence];

  return mockObj;
}

/**
 * Create a mock with conditional behavior
 */
export function createConditionalMock<T extends (...args: any[]) => any>(
  conditions: Array<{
    when: (...args: Parameters<T>) => boolean;
    then: ReturnType<T> | ((...args: Parameters<T>) => ReturnType<T>);
  }>,
  defaultReturn?: ReturnType<T>
): MockedFunction<T> {
  return vi.fn().mockImplementation((...args: Parameters<T>) => {
    for (const condition of conditions) {
      if (condition.when(...args)) {
        return typeof condition.then === 'function' 
          ? (condition.then as any)(...args)
          : condition.then;
      }
    }
    return defaultReturn;
  }) as MockedFunction<T>;
}

/**
 * Create a mock factory for generating multiple related mocks
 */
export function createMockFactory<T>(
  template: Partial<T>,
  generator: (index: number) => Partial<T> = () => ({})
) {
  return (count: number): T[] => {
    return Array.from({ length: count }, (_, index) => ({
      ...template,
      ...generator(index),
      id: `mock-${index}`
    })) as T[];
  };
}

/**
 * Utility functions
 */

function getAllPropertyNames(obj: any): string[] {
  const props = new Set<string>();
  let current = obj;
  
  while (current && current !== Object.prototype) {
    Object.getOwnPropertyNames(current).forEach(name => props.add(name));
    current = Object.getPrototypeOf(current);
  }
  
  return Array.from(props);
}

function inferReturnValue(methodName: string, args: any[]): any {
  // Boolean methods
  if (methodName.startsWith('is') || methodName.startsWith('has') || methodName.startsWith('can')) {
    return true;
  }
  
  // Get methods
  if (methodName.startsWith('get')) {
    if (methodName.includes('All') || methodName.includes('List')) {
      return [];
    }
    if (methodName.includes('Count') || methodName.includes('Size')) {
      return Math.floor(Math.random() * 100);
    }
    return null;
  }
  
  // Find methods
  if (methodName.startsWith('find')) {
    return null;
  }
  
  // Search methods
  if (methodName.includes('search') || methodName.includes('query')) {
    return [];
  }
  
  // Void methods
  if (
    methodName.startsWith('set') ||
    methodName.startsWith('update') ||
    methodName.startsWith('delete') ||
    methodName.startsWith('clear') ||
    methodName.startsWith('reset') ||
    methodName === 'initialize' ||
    methodName === 'destroy'
  ) {
    return undefined;
  }
  
  // Creation methods
  if (methodName.startsWith('create') || methodName.startsWith('generate')) {
    return { id: `mock-${Date.now()}` };
  }
  
  // Validation methods
  if (methodName.includes('validate')) {
    return { valid: true, errors: [] };
  }
  
  // Default return
  return undefined;
}

function createAsyncResult(result: any, delay: number, failureRate: number): Promise<any> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failureRate) {
        reject(new Error(`Mock operation failed (${Math.random() < 0.5 ? 'timeout' : 'server_error'})`));
      } else {
        resolve(result);
      }
    }, delay);
  });
}

/**
 * Mock data generators for common scenarios
 */
export const mockGenerators = {
  /** Generate a mock ID */
  id: () => `mock-${Math.random().toString(36).substr(2, 9)}`,
  
  /** Generate a mock timestamp */
  timestamp: () => Date.now() - Math.floor(Math.random() * 86400000),
  
  /** Generate a mock email */
  email: () => `user${Math.floor(Math.random() * 1000)}@example.com`,
  
  /** Generate a mock URL */
  url: () => `https://example.com/resource/${mockGenerators.id()}`,
  
  /** Generate mock legal content */
  legalContent: () => ({
    id: mockGenerators.id(),
    title: `Artículo ${Math.floor(Math.random() * 200) + 1}`,
    content: 'Contenido legal simulado para pruebas...',
    type: 'article',
    hierarchy: Math.floor(Math.random() * 7) + 1
  }),
  
  /** Generate mock query metrics */
  queryMetrics: () => ({
    id: mockGenerators.id(),
    query: '¿Pregunta legal de prueba?',
    timestamp: mockGenerators.timestamp(),
    latency: Math.floor(Math.random() * 500) + 50,
    success: Math.random() > 0.1,
    relevanceScore: Math.random() * 0.5 + 0.5
  }),
  
  /** Generate mock error */
  error: (message = 'Mock error') => new Error(message)
};

/**
 * Test helpers for common testing patterns
 */
export const testHelpers = {
  /** Wait for all promises to resolve */
  flushPromises: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  /** Wait for a specific condition to be true */
  waitFor: async (
    condition: () => boolean,
    timeout = 1000,
    interval = 10
  ): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Condition not met within timeout');
  },
  
  /** Simulate user interaction delay */
  userDelay: (min = 100, max = 500) => 
    new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min)),
  
  /** Create a mock file */
  createMockFile: (content: string, name = 'test.txt', type = 'text/plain') => 
    new File([content], name, { type }),
  
  /** Create a mock blob */
  createMockBlob: (content: string, type = 'text/plain') => 
    new Blob([content], { type })
};