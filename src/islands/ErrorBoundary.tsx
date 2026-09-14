import * as React from 'react';
import { buildIssueUrl, buildErrorReportBody } from '@/lib/report-issue';

interface ErrorBoundaryProps {
  /** Optional name shown in the report's component path. */
  name?: string;
  /**
   * Render-prop fallback. Receives the caught error + pre-filled GitHub issue
   * URL so callers can customise the recovery UI.
   *
   * NOTE: `reportUrl` may be null on the very first render after a throw, because
   * `getDerivedStateFromError` (synchronous) sets `error` but `componentDidCatch`
   * (async-safe) sets `reportUrl` in a subsequent setState. The caller's fallback
   * is invoked once with `null` first, then again once the URL resolves. Handle
   * the null case: show a minimal fallback or loading state until it resolves.
   */
  fallback?: (error: Error, reportUrl: string | null) => React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  reportUrl: string | null;
}

/**
 * Class-based React error boundary that catches rendering errors inside its
 * subtree and surfaces a fallback UI with a pre-filled GitHub issue link.
 *
 * Must be a class component — React's error boundary API (getDerivedStateFromError
 * + componentDidCatch) is intentionally not available as a hook.
 *
 * Race-condition contract:
 *   - `getDerivedStateFromError` runs synchronously and sets `error`.
 *   - `componentDidCatch` runs async-safe and sets `reportUrl` via setState.
 *   - The fallback renders as soon as `error` is set (no crashing child re-render).
 *   - The "Report on GitHub" link appears once `reportUrl` resolves.
 *
 * Usage:
 *   <ErrorBoundary name="IssuesList">
 *     <IssuesListInner />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null, reportUrl: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI immediately.
    // reportUrl is NOT set here because it requires an async setState call
    // (componentDidCatch). We render the fallback with reportUrl=null first.
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Build a report URL eagerly so the fallback can offer it once ready.
    // We derive a "component path" from the boundary name and the first line of
    // the React component stack (which React 19 produces in development).
    const stackFirstLine = info.componentStack?.split('\n')[1]?.trim() ?? '';
    const componentPath = [this.props.name, stackFirstLine]
      .filter(Boolean)
      .join(' › ');

    const url = buildIssueUrl({
      title: `[bug] ${error.name}: ${error.message}`,
      body: buildErrorReportBody({ error, componentPath, hydrationMismatch: false }),
      labels: ['bug'],
    });
    // This second setState triggers a re-render, adding the GitHub link.
    this.setState({ reportUrl: url });
  }

  override render() {
    const { error, reportUrl } = this.state;

    // Render the fallback as soon as error is set — do NOT wait for reportUrl.
    // This prevents falling through to `children` and re-rendering the crashing
    // child during the async gap between getDerivedStateFromError and componentDidCatch.
    if (error !== null) {
      if (this.props.fallback) {
        // Pass reportUrl even if null; caller decides how to handle the gap.
        return this.props.fallback(error, reportUrl);
      }

      // Default fallback: accessible alert that upgrades to include the
      // "Report on GitHub" link once reportUrl resolves.
      return (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Something went wrong in this island.</p>
          <p className="mt-1 text-xs">
            <code>
              {error.name}: {error.message}
            </code>
          </p>
          {reportUrl && (
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center rounded-md border border-destructive/40 bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/30"
            >
              Report on GitHub &rarr;
            </a>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
