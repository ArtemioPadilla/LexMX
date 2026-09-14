import * as React from 'react';
import { buildIssueUrl, buildErrorReportBody } from '@/lib/report-issue';
import { createDisposer } from '@/lib/disposer';

/**
 * Single-mount island that listens for window 'error' events and detects
 * React's known hydration-mismatch message signatures. When a mismatch is
 * detected, it stores a pre-filled GitHub issue URL in sessionStorage under
 * the key 'feedbackfab.pending-report'. The FeedbackFAB reads this key on
 * open and uses the stored URL in preference to the generic form.
 *
 * Why sessionStorage instead of a Nano Store? The FAB is an Astro component
 * (not a React island) and its click handler runs in a plain <script>. Using
 * sessionStorage keeps the coupling zero: no shared module, no imports. The
 * FAB script reads the key and clears it so the report is only offered once
 * per session.
 *
 * This component renders null — it has no visible output.
 *
 * Lifecycle discipline: all event listeners are registered via createDisposer()
 * and torn down in the useEffect cleanup, preventing memory leaks across
 * Astro page navigations (if View Transitions are ever added) and StrictMode
 * double-invocations in development.
 */
export default function HydrationCanary() {
  React.useEffect(() => {
    // createDisposer groups all side-effect teardowns into a single dispose()
    // call. This island is the exemplar for the "island lifecycle discipline"
    // pattern described in CLAUDE.md.
    const d = createDisposer();

    const onError = (event: ErrorEvent) => {
      const msg = String(event.message ?? '');
      // React 18/19 hydration mismatch messages:
      //   "Hydration failed because the initial UI does not match…"
      //   "Text content does not match server-rendered HTML"
      //   Minified production errors: #418 (hydration), #421, #422
      if (
        /Hydration failed/i.test(msg) ||
        /Text content does not match/i.test(msg) ||
        /Minified React error #418|#421|#422/.test(msg)
      ) {
        const url = buildIssueUrl({
          title: '[bug] React hydration mismatch',
          body: buildErrorReportBody({
            error: new Error(msg),
            hydrationMismatch: true,
          }),
          labels: ['bug'],
        });
        sessionStorage.setItem('feedbackfab.pending-report', url);
      }
    };

    d.on(window, 'error', onError);

    return d.dispose;
  }, []);

  // Renders nothing — purely a side-effect island.
  return null;
}
