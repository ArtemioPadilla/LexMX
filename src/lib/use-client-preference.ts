/**
 * useClientPreference — SSR-safe hook for browser-only preference values.
 *
 * WHY: Islands that read `localStorage`, `matchMedia`, or any other browser
 * API cannot do so during SSR (the server has no browser globals). If the
 * hook reads the browser value during the first render it will produce a
 * different result from what the server rendered, triggering a React
 * hydration mismatch warning.
 *
 * APPROACH: We use `useSyncExternalStore` with separate `getSnapshot` (client,
 * reads the real browser value) and `getServerSnapshot` (always returns the
 * provided `serverDefault`) functions. React uses `getServerSnapshot` during
 * SSR and for the first client render, guaranteeing HTML-parity. After
 * hydration React switches to `getSnapshot` and rerenders only if the value
 * has actually changed.
 *
 * USAGE:
 *   // Theme preference stored in localStorage
 *   const theme = useClientPreference(
 *     () => (localStorage.getItem('theme') ?? 'light') as Theme,
 *     'light',   // server default — must match the value an SSR user would see
 *     (onChange) => {
 *       window.addEventListener('storage', onChange);
 *       return () => window.removeEventListener('storage', onChange);
 *     },
 *   );
 *
 *   // prefers-reduced-motion media query
 *   const prefersReducedMotion = useClientPreference(
 *     () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
 *     false,
 *     (onChange) => {
 *       const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
 *       mq.addEventListener('change', onChange);
 *       return () => mq.removeEventListener('change', onChange);
 *     },
 *   );
 *
 * NOTES:
 * - `serverDefault` must be a stable value (not computed each render) to
 *   avoid tearing. Primitives (string, boolean, number) are always stable.
 * - `subscribe` receives a zero-arg `onChange` callback that React calls
 *   when the external store might have changed. It must return a cleanup fn.
 * - Never call `getClientSnapshot` during SSR — it is only invoked in the
 *   browser by `useSyncExternalStore`.
 */

import { useSyncExternalStore } from 'react';

type Subscribe = (onChange: () => void) => () => void;

/**
 * A no-op subscribe for preferences that can only change on page reload
 * (e.g. `navigator.language`). Allows using the hook without wiring up an
 * event listener when the value is effectively static after hydration.
 */
export function staticSubscribe(_onChange: () => void): () => void {
  return () => {};
}

/**
 * Read a browser-only preference safely across SSR and client hydration.
 *
 * @param getClientSnapshot  Called only in the browser. Must be a pure read of
 *                           browser state. Must NOT be defined inline (create
 *                           it outside the render function or use useCallback).
 * @param serverDefault      The value to use during SSR and the first client
 *                           render. Must match what the server would produce so
 *                           React can hydrate without a mismatch.
 * @param subscribe          Called once on mount. Register whatever event
 *                           listeners notify React of external changes and
 *                           return a cleanup function.
 */
export function useClientPreference<T>(
  getClientSnapshot: () => T,
  serverDefault: T,
  subscribe: Subscribe = staticSubscribe,
): T {
  // getServerSnapshot is stable — it always returns the same serverDefault,
  // which React will use during SSR and the initial client render.
  const getServerSnapshot = (): T => serverDefault;

  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
