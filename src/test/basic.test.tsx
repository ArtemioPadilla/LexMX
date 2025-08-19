/**
 * Basic test to verify React testing infrastructure is working
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';

// Simple test component
function TestComponent({ message = 'Hello, World!' }: { message?: string }) {
  return <div data-testid="test-component">{message}</div>;
}

describe('Basic React Testing Infrastructure', () => {
  it('should render a simple component', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('should render with custom props', () => {
    const customMessage = 'Custom Test Message';
    render(<TestComponent message={customMessage} />);
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('should handle basic expectations', () => {
    expect(true).toBe(true);
    expect('hello').toBe('hello');
    expect([1, 2, 3]).toHaveLength(3);
  });
});