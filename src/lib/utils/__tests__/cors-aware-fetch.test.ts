// Unit tests for corsAwareFetch (the actual fetch wrapper with fallback
// strategies). `global.fetch` is mocked per test; the module under test is
// never mocked (see src/test/setupTests.ts for the default fetch stub this
// file overrides).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { corsAwareFetch, isLikelyCorsBlocked, checkLocalProxyStatus } from '../cors-aware-fetch';

const PROXY_HEALTH_URL = 'http://localhost:3001/health';
const PROXY_BASE = 'http://localhost:3001';

function isProxyRequest(url: string): boolean {
  return url.startsWith(`${PROXY_BASE}/?url=`);
}

describe('corsAwareFetch', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
  });

  describe('official-domain detection', () => {
    it('recognizes a Mexican government domain and surfaces official guidance once direct + proxy attempts fail', async () => {
      vi.mocked(global.fetch).mockImplementation((input) => {
        const url = String(input);
        if (url === PROXY_HEALTH_URL) {
          // No local dev proxy running.
          return Promise.resolve({ ok: false, status: 503 } as Response);
        }
        // Direct fetch to the government site is blocked by the browser.
        return Promise.reject(new TypeError('Failed to fetch'));
      });

      const result = await corsAwareFetch('https://www.diputados.gob.mx/LeyesBiblio/pdf/1.pdf');

      expect(result.success).toBe(false);
      expect(result.corsBlocked).toBe(true);
      expect(result.suggestions?.some((s) => s.includes('official Mexican government document'))).toBe(true);
    });

    it('does not apply the Mexican-government guidance path for unrelated domains', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await corsAwareFetch('https://example.com/document.pdf');

      expect(result.suggestions?.some((s) => s.includes('official Mexican government document'))).toBe(false);
    });
  });

  describe('CORS-blocked detection', () => {
    it('flags a browser CORS rejection as corsBlocked based on the error message', async () => {
      vi.mocked(global.fetch).mockRejectedValue(
        new TypeError('NetworkError when attempting to fetch resource: blocked by CORS policy')
      );

      const result = await corsAwareFetch('https://example.com/doc');

      expect(result.success).toBe(false);
      expect(result.corsBlocked).toBe(true);
    });

    it('does not flag a same-origin, non-CORS network failure as corsBlocked', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await corsAwareFetch(`${window.location.origin}/local-doc`);

      expect(result.corsBlocked).toBe(false);
    });
  });

  describe('fallback strategy order', () => {
    it('tries the direct URL first, then falls back to the proxy strategy, in that order', async () => {
      const calls: string[] = [];
      vi.mocked(global.fetch).mockImplementation((input) => {
        const url = String(input);
        calls.push(url);
        if (isProxyRequest(url)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
          } as Response);
        }
        // A message the module's CORS-keyword heuristic actually recognizes.
        return Promise.reject(new TypeError('NetworkError: blocked by CORS policy'));
      });

      const result = await corsAwareFetch('https://example.com/doc.pdf', {
        fallbackStrategies: ['proxy'],
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('proxy');
      expect(calls[0]).toBe('https://example.com/doc.pdf');
      expect(calls[1]).toMatch(/^http:\/\/localhost:3001\/\?url=/);
    });
  });

  describe('timeout handling', () => {
    it('surfaces a timeout as a distinct, non-CORS failure', async () => {
      vi.useFakeTimers();
      vi.mocked(global.fetch).mockImplementation((_input, init) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
          );
        });
      });

      // Same-origin so the top-level `corsBlocked` isn't forced true purely by
      // the cross-origin heuristic; this isolates the timeout-handling path.
      const resultPromise = corsAwareFetch(`${window.location.origin}/slow-endpoint`, { timeout: 50 });
      await vi.advanceTimersByTimeAsync(60);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.corsBlocked).toBe(false);
      expect(result.error).toMatch(/aborted/i);
      vi.useRealTimers();
    });
  });

  describe('HTTP error vs CORS-blocked distinction', () => {
    it('surfaces a plain HTTP 404 as an HTTP error, not as CORS-blocked, once the response arrives', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      // Same-origin so the outer `corsBlocked` flag isn't forced true just
      // because the request crosses origins.
      const result = await corsAwareFetch(`${window.location.origin}/missing-document`);

      expect(result.success).toBe(false);
      expect(result.corsBlocked).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
    });
  });

  describe('isLikelyCorsBlocked / checkLocalProxyStatus', () => {
    it('flags cross-origin URLs and clears same-origin ones', () => {
      expect(isLikelyCorsBlocked('https://example.com/doc')).toBe(true);
      expect(isLikelyCorsBlocked(`${window.location.origin}/doc`)).toBe(false);
    });

    it('reports the local proxy as running when its health endpoint responds OK', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ status: 'healthy' }),
      } as unknown as Response);

      const status = await checkLocalProxyStatus();

      expect(status.running).toBe(true);
      expect(status.url).toBe('http://localhost:3001');
    });
  });
});
