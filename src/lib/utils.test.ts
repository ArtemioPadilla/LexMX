import { describe, it, expect } from 'vitest';

// Simple test to verify Vitest is working
describe('Utils', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle boolean values', () => {
    expect(true).toBe(true);
    expect(false).toBe(false);
  });
});