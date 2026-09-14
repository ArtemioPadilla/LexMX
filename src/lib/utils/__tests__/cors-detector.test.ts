// Unit tests for CorsDetector (pre-flight CORS analysis, no network side-effects
// beyond the proxy health check). `global.fetch` is mocked per test; the module
// under test is never mocked (see src/test/setupTests.ts for the default fetch
// stub this file overrides).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CorsDetector, analyzeCors, needsImmediateGuidance } from '../cors-detector';

const originalLocation = window.location;

/** Swap `window.location` for a single test; restored in `afterEach`. */
function stubLocation(overrides: { href: string; hostname: string; origin: string }): void {
  Object.defineProperty(window, 'location', {
    value: overrides,
    writable: true,
    configurable: true,
  });
}

describe('CorsDetector', () => {
  beforeEach(() => {
    // The proxy-availability cache is static/module-level; reset it so tests
    // don't leak state into each other.
    CorsDetector.clearProxyCache();
    vi.mocked(global.fetch).mockReset();
    // Default: no CORS proxy reachable. Individual tests override this.
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe('official-domain detection', () => {
    it('flags known Mexican government domains as isMexicanGovt', async () => {
      const result = await CorsDetector.analyzeCorsRequirements(
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/1.pdf'
      );

      expect(result.isMexicanGovt).toBe(true);
    });

    it('does not flag unrelated domains as isMexicanGovt', async () => {
      const result = await analyzeCors('https://example.com/document.pdf');

      expect(result.isMexicanGovt).toBe(false);
    });

    it('needsImmediateGuidance is true only for cross-origin Mexican government URLs', () => {
      expect(needsImmediateGuidance('https://www.scjn.gob.mx/tesis/1')).toBe(true);
      expect(needsImmediateGuidance('https://example.com/doc')).toBe(false);
    });
  });

  describe('CORS-blocked detection', () => {
    it('marks a cross-origin request as CORS-blocked when no healthy proxy is available', async () => {
      const result = await CorsDetector.analyzeCorsRequirements('https://www.dof.gob.mx/nota.php');

      expect(result.isCrossOrigin).toBe(true);
      expect(result.willBeCorsBlocked).toBe(true);
      expect(result.canAttemptFetch).toBe(false);
    });

    it('does not mark a same-origin request as CORS-blocked', async () => {
      const result = await CorsDetector.analyzeCorsRequirements(`${window.location.origin}/local-doc`);

      expect(result.isCrossOrigin).toBe(false);
      expect(result.willBeCorsBlocked).toBe(false);
      expect(result.canAttemptFetch).toBe(true);
    });
  });

  describe('guidance ordering (fallback strategy order)', () => {
    it('orders GitHub Pages guidance steps: official doc, environment, download, upload, automation', async () => {
      stubLocation({
        href: 'https://artemiopadilla.github.io/LexMX/',
        hostname: 'artemiopadilla.github.io',
        origin: 'https://artemiopadilla.github.io',
      });

      const result = await CorsDetector.analyzeCorsRequirements(
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/1.pdf'
      );

      expect(result.environment).toBe('github-pages');
      expect(result.actionSteps[0]).toMatch(/^🏛️/);
      expect(result.actionSteps[1]).toMatch(/^🌐/);
      expect(result.actionSteps[2]).toMatch(/^📥/);
      expect(result.actionSteps[3]).toMatch(/^📤/);
      expect(result.actionSteps[4]).toMatch(/^⚡/);
      expect(result.actionSteps[5]).toMatch(/^📄/); // .pdf URL triggers this extra step
      expect(result.actionSteps.at(-1)).toMatch(/^💡/);
    });
  });

  describe('timeout handling', () => {
    it('treats a hanging proxy health check as unavailable once the internal timeout fires', async () => {
      vi.useFakeTimers();
      vi.mocked(global.fetch).mockImplementation((_input, init) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      });

      const resultPromise = CorsDetector.checkCorsProxyAvailability();
      await vi.advanceTimersByTimeAsync(1100); // internal timeout is 1000ms
      const result = await resultPromise;

      expect(result.available).toBe(false);
      expect(result.healthy).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('HTTP error vs CORS-blocked distinction', () => {
    it('treats a resolved non-OK health response as "unavailable" without logging a connection warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await CorsDetector.checkCorsProxyAvailability();

      expect(result.available).toBe(false);
      expect(result.healthy).toBe(false);
      // The response arrived normally (no thrown/CORS error), so the catch-block
      // warning path must not fire.
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('only logs a warning when the health check throws (network/CORS failure)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(global.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await CorsDetector.checkCorsProxyAvailability();

      expect(result.available).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
