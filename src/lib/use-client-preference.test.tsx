// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useClientPreference, staticSubscribe } from './use-client-preference';

// ── Helpers ─────────────────────────────────────────────────────────────────

function Fixture<T>({
  getClientSnapshot,
  serverDefault,
  subscribe,
  toStr = String,
}: {
  getClientSnapshot: () => T;
  serverDefault: T;
  subscribe?: (onChange: () => void) => () => void;
  toStr?: (v: T) => string;
}) {
  const value = useClientPreference(getClientSnapshot, serverDefault, subscribe);
  return <output data-testid="out">{toStr(value)}</output>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useClientPreference', () => {
  it('renders the client snapshot value in a browser environment', () => {
    const getClientSnapshot = () => 'dark';
    render(
      <Fixture
        getClientSnapshot={getClientSnapshot}
        serverDefault="light"
        subscribe={staticSubscribe}
      />,
    );
    // In jsdom the "client" snapshot is used immediately
    expect(screen.getByTestId('out').textContent).toBe('dark');
  });

  it('falls back to serverDefault when getClientSnapshot returns the same value (stable)', () => {
    // Verify that when client and server agree there is no flash
    const getClientSnapshot = () => 'light';
    render(
      <Fixture
        getClientSnapshot={getClientSnapshot}
        serverDefault="light"
        subscribe={staticSubscribe}
      />,
    );
    expect(screen.getByTestId('out').textContent).toBe('light');
  });

  it('rerenders when the subscribe callback triggers onChange', async () => {
    // Simulate an external store (e.g. localStorage 'storage' event) that
    // changes after the initial render.
    let externalOnChange: (() => void) | null = null;
    let currentValue = 'light';

    const subscribe = (onChange: () => void) => {
      externalOnChange = onChange;
      return () => { externalOnChange = null; };
    };
    const getClientSnapshot = () => currentValue;

    render(
      <Fixture
        getClientSnapshot={getClientSnapshot}
        serverDefault="light"
        subscribe={subscribe}
      />,
    );

    expect(screen.getByTestId('out').textContent).toBe('light');

    // Simulate external change
    await act(async () => {
      currentValue = 'dark';
      externalOnChange?.();
    });

    expect(screen.getByTestId('out').textContent).toBe('dark');
  });

  it('staticSubscribe returns a no-op cleanup function', () => {
    const cleanup = staticSubscribe(() => {});
    expect(typeof cleanup).toBe('function');
    // Should not throw
    expect(() => cleanup()).not.toThrow();
  });

  it('cleans up the subscription on unmount', () => {
    const cleanup = vi.fn();
    const subscribe = (_onChange: () => void) => cleanup;

    const { unmount } = render(
      <Fixture
        getClientSnapshot={() => false}
        serverDefault={false}
        subscribe={subscribe}
        toStr={(v) => String(v)}
      />,
    );

    unmount();
    expect(cleanup).toHaveBeenCalled();
  });

  it('works with boolean values (reduced-motion pattern)', () => {
    const getClientSnapshot = () => false;
    render(
      <Fixture
        getClientSnapshot={getClientSnapshot}
        serverDefault={false}
        subscribe={staticSubscribe}
        toStr={(v) => (v ? 'reduced' : 'normal')}
      />,
    );
    expect(screen.getByTestId('out').textContent).toBe('normal');
  });
});
