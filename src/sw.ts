/// <reference lib="webworker" />
/**
 * LexMX service worker (Workbox, injectManifest). Built by @vite-pwa/astro
 * from this file; replaces public/sw.js (Fase 5).
 *
 * - precaches the Astro build (self.__WB_MANIFEST) and serves navigations
 *   from it, with the precached /offline/ page as the last resort;
 * - caches corpus and embedding shards (same-origin JSON under
 *   legal-corpus/ and embeddings/) cache-first: they are versioned by the
 *   CorpusInstaller, so a stale shard is never served for a new version;
 * - caches the Transformers.js model files from the Hugging Face CDN so the
 *   embedding model loads offline after the first visit;
 * - deletes the caches of the previous hand-written worker (`lexmx-*`);
 * - keeps the push, notification-click, background-sync and message
 *   contracts the app already uses (SKIP_WAITING, SEND_NOTIFICATION,
 *   GET_CACHE_INFO, sync tags legal-query-sync / document-upload-sync).
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

const BASE = new URL(self.registration.scope).pathname; // "/LexMX/" on Pages, "/" locally
// The Astro page src/pages/offline.astro is precached as `offline/index.html`.
const OFFLINE_URL = `${BASE}offline/`;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigations: app shell from the precache, offline page when nothing matches.
const shellHandler = createHandlerBoundToURL(`${BASE}index.html`);
registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        const precached = await caches.match(params.request, { ignoreSearch: true });
        if (precached) return precached;
        return await fetch(params.request);
      } catch {
        return (await caches.match(OFFLINE_URL)) ?? (await shellHandler(params));
      }
    },
    { denylist: [/\/api\//] },
  ),
);

// Corpus documents and embedding shards: cache-first, versioned by content.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\/(legal-corpus|embeddings)\/.+\.json$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'corpus-shards',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 90, purgeOnQuotaError: true })],
  }),
);

// Embedding model (Transformers.js) from the Hugging Face CDN.
registerRoute(
  ({ url }) => /(^|\.)huggingface\.co$/.test(url.hostname) || /hf\.co$/.test(url.hostname),
  new CacheFirst({
    cacheName: 'hf-models',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 180, purgeOnQuotaError: true })],
  }),
);

// Everything else same-origin that is not precached (fonts, images added later).
registerRoute(
  ({ request, url }) => url.origin === self.location.origin && ['image', 'font', 'style'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'assets', plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })] }),
);

// Drop the caches of the previous hand-written worker.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('lexmx-')).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// Background sync: the page owns the queue (OfflineQueueManager); we only wake it.
self.addEventListener('sync', (event: Event) => {
  const tag = (event as Event & { tag?: string }).tag;
  if (tag === 'legal-query-sync' || tag === 'document-upload-sync') {
    (event as Event & { waitUntil: (p: Promise<unknown>) => void }).waitUntil(broadcast('SYNC_REQUESTED', { tag }));
  }
});

async function broadcast(type: string, data: unknown): Promise<void> {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) client.postMessage({ type, data });
}

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  if (event.data) {
    try {
      payload = event.data.json() as PushPayload;
    } catch {
      payload = { body: event.data.text() };
    }
  }
  const options: NotificationOptions & { actions?: PushPayload['actions'] } = {
    body: payload.body ?? 'Nueva notificación de LexMX',
    icon: payload.icon ?? `${BASE}icon-192.png`,
    badge: payload.badge ?? `${BASE}favicon.svg`,
    data: { ...(payload.data ?? {}), url: payload.url ?? payload.data?.url },
    tag: payload.tag ?? 'lexmx-notification',
    actions: payload.actions ?? [{ action: 'view', title: 'Ver' }, { action: 'dismiss', title: 'Cerrar' }],
  };
  event.waitUntil(self.registration.showNotification(payload.title ?? 'LexMX', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const data = (event.notification.data ?? {}) as Record<string, string | undefined>;
  const target = data.url
    ? new URL(data.url, self.location.origin).href
    : data.caseId
      ? `${self.location.origin}${BASE}casos?case=${data.caseId}`
      : data.queryId
        ? `${self.location.origin}${BASE}chat?query=${data.queryId}`
        : `${self.location.origin}${BASE}`;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((w) => w.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        await existing.navigate(target);
      } else {
        await self.clients.openWindow(target);
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  const { type, data } = (event.data ?? {}) as { type?: string; data?: PushPayload & { title?: string } };
  switch (type) {
    case 'SKIP_WAITING':
      void self.skipWaiting();
      break;
    case 'SEND_NOTIFICATION':
      if (data) {
        void self.registration.showNotification(data.title ?? 'LexMX', {
          body: data.body ?? '',
          icon: data.icon ?? `${BASE}icon-192.png`,
          badge: data.badge ?? `${BASE}favicon.svg`,
          data: data.data ?? {},
          tag: data.tag ?? 'manual-notification',
        });
      }
      break;
    case 'GET_CACHE_INFO':
      void (async () => {
        const info: Record<string, { name: string; size: number }> = {};
        for (const name of await caches.keys()) {
          const keys = await (await caches.open(name)).keys();
          info[name] = { name, size: keys.length };
        }
        event.source?.postMessage({ type: 'CACHE_INFO', data: info });
      })();
      break;
    default:
      break;
  }
});
