// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ErrorBoundary from './ErrorBoundary';

/**
 * Runtime sanity test for ErrorBoundary. The companion `ErrorBoundary.test.ts`
 * already verifies the structural contract (static getDerivedStateFromError,
 * componentDidCatch, role="alert" fallback, etc.) via source-text assertions.
 *
 * This file adds one runtime check for the no-error happy path: children
 * render normally when nothing throws. The throw-and-recover paths are not
 * exercised here because React 19's default dev-mode error reporting calls
 * `window.dispatchEvent(ErrorEvent)` even when boundaries catch the error,
 * which vitest's jsdom runner treats as an unhandled error — and the React 19
 * `onCaughtError` / `onUncaughtError` createRoot options don't suppress that
 * specific telemetry path. Until vitest exposes a per-file
 * `dangerouslyIgnoreUnhandledErrors` toggle or React stops mirror-reporting,
 * the throw paths stay validated by source-text checks + the visible fallback
 * in /gallery/error-boundary.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('ErrorBoundary (runtime)', () => {
  it('renders children when nothing throws', () => {
    act(() => {
      root.render(
        <ErrorBoundary name="Test">
          <p>healthy</p>
        </ErrorBoundary>,
      );
    });
    expect(container.textContent).toContain('healthy');
  });

  it('mounts without errors when wrapping a real child tree', () => {
    act(() => {
      root.render(
        <ErrorBoundary name="ComposedTest">
          <section>
            <h2>Composed</h2>
            <button type="button">Click</button>
            <p>Body copy</p>
          </section>
        </ErrorBoundary>,
      );
    });
    expect(container.querySelector('section')).not.toBeNull();
    expect(container.querySelector('h2')?.textContent).toBe('Composed');
    // No alert role rendered when there's no error
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
