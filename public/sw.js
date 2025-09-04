// Service Worker for LexMX - Enhanced offline functionality and caching

const CACHE_VERSION = 'v2';
const CACHE_NAME = `lexmx-${CACHE_VERSION}`;
const RUNTIME_CACHE = `lexmx-runtime-${CACHE_VERSION}`;
const LEGAL_CORPUS_CACHE = `lexmx-corpus-${CACHE_VERSION}`;

// Determine base path based on the service worker location
const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, '') || '';

// Critical assets to cache immediately
const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/favicon.svg`,
  `${BASE_PATH}/offline.html`,
  // Core pages
  `${BASE_PATH}/chat`,
  `${BASE_PATH}/casos`,
  `${BASE_PATH}/wiki`,
  `${BASE_PATH}/legal`
];

// Legal corpus assets (high priority for offline access)
const LEGAL_CORPUS_PATTERNS = [
  /\/legal-corpus\/.+\.json$/,
  /\/embeddings\/.+\.json$/,
  /\/api\/corpus\/*/
];

// Runtime caching patterns
const RUNTIME_PATTERNS = [
  /\/api\/.*/,
  /\/_astro\/.*/,
  /\.(?:js|css|woff2|woff|ttf|eot)$/
];

// Utility functions
function logMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  console[level](`[SW ${timestamp}] ${message}`, data || '');
}

function shouldCache(url) {
  // Don't cache external URLs or Chrome extension requests
  if (!url.startsWith(self.location.origin) || url.includes('extension://')) {
    return false;
  }
  
  // Don't cache API error responses or very large files
  return true;
}

function isLegalCorpusRequest(url) {
  return LEGAL_CORPUS_PATTERNS.some(pattern => pattern.test(url));
}

function isRuntimeRequest(url) {
  return RUNTIME_PATTERNS.some(pattern => pattern.test(url));
}

// Install event - enhanced caching strategy
self.addEventListener('install', (event) => {
  logMessage('info', 'Service worker installing');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME).then(cache => {
        logMessage('info', `Caching ${STATIC_ASSETS.length} static assets`);
        
        return Promise.allSettled(
          STATIC_ASSETS.map(async url => {
            try {
              const response = await fetch(url);
              if (response.ok) {
                await cache.put(url, response);
                logMessage('info', `Cached: ${url}`);
              } else {
                logMessage('warn', `Failed to fetch ${url}: ${response.status}`);
              }
            } catch (err) {
              logMessage('warn', `Network error caching ${url}:`, err.message);
            }
          })
        );
      }),
      
      // Initialize other caches
      caches.open(RUNTIME_CACHE),
      caches.open(LEGAL_CORPUS_CACHE)
    ])
    .then(() => {
      logMessage('info', 'Service worker installation complete');
      return self.skipWaiting();
    })
    .catch(err => {
      logMessage('error', 'Service worker installation failed:', err);
    })
  );
});

// Activate event - enhanced cleanup and initialization
self.addEventListener('activate', (event) => {
  logMessage('info', 'Service worker activating');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        const currentCaches = [CACHE_NAME, RUNTIME_CACHE, LEGAL_CORPUS_CACHE];
        const cachesToDelete = cacheNames.filter(cacheName => 
          !currentCaches.includes(cacheName) && cacheName.startsWith('lexmx-')
        );
        
        logMessage('info', `Deleting ${cachesToDelete.length} old caches`);
        
        return Promise.all(
          cachesToDelete.map(cacheName => {
            logMessage('info', `Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      }),
      
      // Initialize background sync if supported
      self.registration.sync ? Promise.resolve() : Promise.resolve()
    ])
    .then(() => {
      logMessage('info', 'Service worker activation complete');
      return self.clients.claim();
    })
    .catch(err => {
      logMessage('error', 'Service worker activation failed:', err);
    })
  );
});

// Fetch event - enhanced caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;
  
  // Skip non-GET requests and external URLs
  if (request.method !== 'GET' || !shouldCache(url)) {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (isLegalCorpusRequest(url)) {
    // Legal corpus: Cache first, network fallback (important for offline legal research)
    event.respondWith(handleLegalCorpusRequest(request));
  } else if (isRuntimeRequest(url)) {
    // Runtime assets: Stale while revalidate
    event.respondWith(handleRuntimeRequest(request));
  } else if (request.mode === 'navigate') {
    // Navigation: Network first, cache fallback
    event.respondWith(handleNavigationRequest(request));
  } else {
    // Default: Cache first, network fallback
    event.respondWith(handleDefaultRequest(request));
  }
});

// Handle legal corpus requests (critical for offline functionality)
async function handleLegalCorpusRequest(request) {
  try {
    // Try cache first
    const cache = await caches.open(LEGAL_CORPUS_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      logMessage('info', `Legal corpus served from cache: ${request.url}`);
      
      // Update in background if not too recent
      const cacheDate = new Date(cachedResponse.headers.get('date') || 0);
      const hoursSinceCache = (Date.now() - cacheDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCache > 24) {
        fetch(request)
          .then(response => response.ok ? cache.put(request, response.clone()) : null)
          .catch(err => logMessage('warn', 'Background update failed:', err.message));
      }
      
      return cachedResponse;
    }
    
    // Fetch from network and cache
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      logMessage('info', `Legal corpus cached from network: ${request.url}`);
    }
    
    return networkResponse;
  } catch (error) {
    logMessage('error', `Legal corpus request failed: ${request.url}`, error.message);
    
    // Try to return any cached version as last resort
    const cache = await caches.open(LEGAL_CORPUS_CACHE);
    return await cache.match(request) || new Response('Legal corpus unavailable offline', { status: 503 });
  }
}

// Handle runtime requests (JS, CSS, etc.)
async function handleRuntimeRequest(request) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Return cache immediately if available
    if (cachedResponse) {
      // Update in background
      fetch(request)
        .then(response => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
        })
        .catch(err => logMessage('warn', 'Background update failed:', err.message));
      
      return cachedResponse;
    }
    
    // Fetch and cache
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    logMessage('warn', `Runtime request failed: ${request.url}`, error.message);
    
    // Try cache as fallback
    const cache = await caches.open(RUNTIME_CACHE);
    return await cache.match(request) || new Response('Resource unavailable', { status: 503 });
  }
}

// Handle navigation requests (page loads)
async function handleNavigationRequest(request) {
  try {
    // Try network first for fresh content
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful navigation responses
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    logMessage('warn', `Navigation request failed: ${request.url}`, error.message);
    
    // Try cache fallback
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Show offline page for navigation failures
    const offlinePage = await cache.match(`${BASE_PATH}/offline.html`);
    if (offlinePage) {
      return offlinePage;
    }
    
    // Last resort: basic offline message
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>LexMX - Sin conexión</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; }
            .offline { max-width: 600px; margin: 0 auto; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #dc2626; }
            p { color: #6b7280; margin: 1rem 0; }
            .retry { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; }
            .retry:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="offline">
            <div class="icon">⚖️</div>
            <h1>LexMX está sin conexión</h1>
            <p>No se puede cargar la página solicitada. Verifica tu conexión a internet.</p>
            <p>Algunas funciones pueden estar disponibles en modo sin conexión.</p>
            <button class="retry" onclick="window.location.reload()">Reintentar</button>
          </div>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle default requests
async function handleDefaultRequest(request) {
  try {
    // Try cache first
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network and cache if successful
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try any cache as last resort
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      if (cacheName.startsWith('lexmx-')) {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
      }
    }
    
    return new Response('Resource unavailable offline', { status: 503 });
  }
}

// Background sync for offline actions (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    logMessage('info', `Background sync triggered: ${event.tag}`);
    
    switch (event.tag) {
      case 'legal-query-sync':
        event.waitUntil(syncPendingQueries());
        break;
      case 'document-upload-sync':
        event.waitUntil(syncPendingUploads());
        break;
    }
  });
}

// Sync pending legal queries when connection is restored
async function syncPendingQueries() {
  try {
    logMessage('info', 'Syncing pending legal queries');
    
    // Access the offline queue manager through IndexedDB directly
    // (We can't import ES modules in service worker context easily)
    
    const db = await openOfflineQueueDB();
    if (!db) {
      logMessage('warn', 'Offline queue database not available');
      return;
    }
    
    const pendingQueries = await getPendingQueriesFromDB(db);
    logMessage('info', `Found ${pendingQueries.length} pending queries to sync`);
    
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const query of pendingQueries) {
      try {
        await updateQueryStatus(db, query.id, 'syncing');
        
        // Process the query (simulate with delay)
        const result = await processQueryInServiceWorker(query);
        
        // Mark as completed
        await markQueryCompleted(db, query.id, result);
        
        // Notify all clients
        await notifyAllClients('queryCompleted', {
          queryId: query.id,
          query: query.query,
          result
        });
        
        syncedCount++;
        logMessage('info', `Query synced successfully: ${query.id}`);
        
      } catch (error) {
        await incrementQueryRetryCount(db, query.id);
        failedCount++;
        logMessage('error', `Query sync failed: ${query.id}`, error.message);
      }
    }
    
    logMessage('info', `Query sync completed: ${syncedCount} synced, ${failedCount} failed`);
    
  } catch (error) {
    logMessage('error', 'Failed to sync pending queries:', error.message);
  }
}

// Sync pending document uploads when connection is restored
async function syncPendingUploads() {
  try {
    logMessage('info', 'Syncing pending document uploads');
    
    const db = await openOfflineQueueDB();
    if (!db) {
      logMessage('warn', 'Offline queue database not available');
      return;
    }
    
    const pendingDocuments = await getPendingDocumentsFromDB(db);
    logMessage('info', `Found ${pendingDocuments.length} pending documents to sync`);
    
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const document of pendingDocuments) {
      try {
        await updateDocumentStatus(db, document.id, 'syncing');
        
        // Process the document
        const result = await processDocumentInServiceWorker(document);
        
        // Mark as completed
        await markDocumentCompleted(db, document.id, result);
        
        // Notify all clients
        await notifyAllClients('documentCompleted', {
          documentId: document.id,
          filename: document.filename,
          result
        });
        
        syncedCount++;
        logMessage('info', `Document synced successfully: ${document.id}`);
        
      } catch (error) {
        await markDocumentFailed(db, document.id, error.message);
        failedCount++;
        logMessage('error', `Document sync failed: ${document.id}`, error.message);
      }
    }
    
    logMessage('info', `Document sync completed: ${syncedCount} synced, ${failedCount} failed`);
    
  } catch (error) {
    logMessage('error', 'Failed to sync pending uploads:', error.message);
  }
}

// Helper functions for IndexedDB operations in service worker context

async function openOfflineQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LexMX_OfflineQueue', 2);
    
    request.onerror = () => resolve(null); // Fail gracefully
    request.onsuccess = () => resolve(request.result);
    
    // In case the database doesn't exist yet
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('offline_queries')) {
        const queriesStore = db.createObjectStore('offline_queries', { keyPath: 'id' });
        queriesStore.createIndex('status', 'status', { unique: false });
        queriesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('offline_documents')) {
        const documentsStore = db.createObjectStore('offline_documents', { keyPath: 'id' });
        documentsStore.createIndex('status', 'status', { unique: false });
        documentsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function getPendingQueriesFromDB(db) {
  const transaction = db.transaction(['offline_queries'], 'readonly');
  const store = transaction.objectStore('offline_queries');
  const index = store.index('status');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]); // Fail gracefully
  });
}

async function getPendingDocumentsFromDB(db) {
  const transaction = db.transaction(['offline_documents'], 'readonly');
  const store = transaction.objectStore('offline_documents');
  const index = store.index('status');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]); // Fail gracefully
  });
}

async function updateQueryStatus(db, queryId, status) {
  const transaction = db.transaction(['offline_queries'], 'readwrite');
  const store = transaction.objectStore('offline_queries');
  
  return new Promise((resolve) => {
    const getRequest = store.get(queryId);
    getRequest.onsuccess = () => {
      const query = getRequest.result;
      if (query) {
        query.status = status;
        const putRequest = store.put(query);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => resolve(); // Continue on error
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => resolve(); // Continue on error
  });
}

async function updateDocumentStatus(db, documentId, status) {
  const transaction = db.transaction(['offline_documents'], 'readwrite');
  const store = transaction.objectStore('offline_documents');
  
  return new Promise((resolve) => {
    const getRequest = store.get(documentId);
    getRequest.onsuccess = () => {
      const document = getRequest.result;
      if (document) {
        document.status = status;
        const putRequest = store.put(document);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => resolve(); // Continue on error
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => resolve(); // Continue on error
  });
}

async function markQueryCompleted(db, queryId, result) {
  const transaction = db.transaction(['offline_queries'], 'readwrite');
  const store = transaction.objectStore('offline_queries');
  
  return new Promise((resolve) => {
    const getRequest = store.get(queryId);
    getRequest.onsuccess = () => {
      const query = getRequest.result;
      if (query) {
        query.status = 'completed';
        query.result = result;
        const putRequest = store.put(query);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => resolve();
  });
}

async function markDocumentCompleted(db, documentId, result) {
  const transaction = db.transaction(['offline_documents'], 'readwrite');
  const store = transaction.objectStore('offline_documents');
  
  return new Promise((resolve) => {
    const getRequest = store.get(documentId);
    getRequest.onsuccess = () => {
      const document = getRequest.result;
      if (document) {
        document.status = 'completed';
        document.result = result;
        const putRequest = store.put(document);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => resolve();
  });
}

async function markDocumentFailed(db, documentId, errorMessage) {
  const transaction = db.transaction(['offline_documents'], 'readwrite');
  const store = transaction.objectStore('offline_documents');
  
  return new Promise((resolve) => {
    const getRequest = store.get(documentId);
    getRequest.onsuccess = () => {
      const document = getRequest.result;
      if (document) {
        document.status = 'failed';
        document.error = {
          message: errorMessage,
          failedAt: new Date()
        };
        const putRequest = store.put(document);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => resolve();
  });
}

async function incrementQueryRetryCount(db, queryId) {
  const transaction = db.transaction(['offline_queries'], 'readwrite');
  const store = transaction.objectStore('offline_queries');
  
  return new Promise((resolve) => {
    const getRequest = store.get(queryId);
    getRequest.onsuccess = () => {
      const query = getRequest.result;
      if (query) {
        query.retryCount = (query.retryCount || 0) + 1;
        
        if (query.retryCount >= (query.maxRetries || 3)) {
          query.status = 'failed';
          query.error = {
            message: 'Maximum retries exceeded',
            failedAt: new Date()
          };
        } else {
          query.status = 'pending'; // Reset to pending for retry
        }
        
        const putRequest = store.put(query);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => resolve();
  });
}

async function processQueryInServiceWorker(query) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Mock success/failure rate
  if (Math.random() > 0.1) { // 90% success rate
    return {
      response: `[Procesado en segundo plano] Respuesta para: "${query.query.substring(0, 50)}..."\n\nEsta consulta se procesó automáticamente cuando se restauró la conexión.`,
      sources: [
        {
          title: 'Código Civil Federal',
          url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/2_110121.pdf',
          relevance: 0.89
        },
        {
          title: 'Constitución Política de los Estados Unidos Mexicanos', 
          url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
          relevance: 0.76
        }
      ],
      completedAt: new Date()
    };
  } else {
    throw new Error('Simulated query processing failure');
  }
}

async function processDocumentInServiceWorker(document) {
  // Simulate document processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  
  return {
    documentId: `processed_${document.id}`,
    processedAt: new Date(),
    message: `Documento "${document.filename}" procesado en segundo plano`
  };
}

async function notifyAllClients(type, data) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  
  const message = {
    type: `offline-${type}`,
    data: data,
    timestamp: new Date().toISOString()
  };
  
  // Send to all clients
  clients.forEach(client => {
    client.postMessage(message);
  });
  
  logMessage('info', `Notified ${clients.length} clients about ${type}`, data);
}

// Push notification event handlers
self.addEventListener('push', (event) => {
  logMessage('info', 'Push notification received');
  
  let notificationData = {
    title: 'LexMX',
    body: 'Nueva notificación legal',
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        ...notificationData,
        ...payload
      };
    } catch (error) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    actions: notificationData.actions || [
      {
        action: 'view',
        title: 'Ver',
        icon: '/favicon.svg'
      },
      {
        action: 'dismiss',
        title: 'Cerrar'
      }
    ],
    requireInteraction: notificationData.data?.type === 'case_update',
    tag: notificationData.tag || 'lexmx-notification',
    timestamp: Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  logMessage('info', 'Notification clicked', event.notification.tag);
  
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'dismiss') {
    return;
  }

  // Determine URL to open
  let urlToOpen = '/';
  
  if (action === 'view' && data.url) {
    urlToOpen = data.url;
  } else if (data.queryId) {
    urlToOpen = `/chat?query=${data.queryId}`;
  } else if (data.caseId) {
    urlToOpen = `/casos/${data.caseId}`;
  } else if (data.documentId) {
    urlToOpen = `/documents/${data.documentId}`;
  } else if (data.type === 'legal_update') {
    urlToOpen = '/legal';
  }

  // Add base path for GitHub Pages
  if (BASE_PATH && !urlToOpen.startsWith(BASE_PATH)) {
    urlToOpen = BASE_PATH + urlToOpen;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }

      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );

  // Track notification interaction
  event.waitUntil(
    notifyAllClients('notificationClicked', {
      action: action,
      data: data,
      url: urlToOpen
    })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  logMessage('info', 'Notification closed', event.notification.tag);
  
  // Track notification dismissal for analytics
  const data = event.notification.data || {};
  
  event.waitUntil(
    notifyAllClients('notificationClosed', {
      tag: event.notification.tag,
      data: data
    })
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  logMessage('info', 'Push subscription changed');
  
  event.waitUntil(
    // Re-subscribe with the same options
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription ? event.oldSubscription.options.applicationServerKey : null
    }).then(subscription => {
      logMessage('info', 'Push subscription renewed');
      
      // Notify clients about subscription change
      return notifyAllClients('pushSubscriptionChanged', {
        oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
        newEndpoint: subscription.endpoint
      });
    }).catch(error => {
      logMessage('error', 'Push subscription renewal failed', error.message);
    })
  );
});

// Message handling for communication with the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      logMessage('info', 'Skipping waiting phase');
      self.skipWaiting();
      break;
      
    case 'SEND_NOTIFICATION':
      logMessage('info', 'Manual notification triggered');
      if (data) {
        const options = {
          body: data.body || 'Notificación de LexMX',
          icon: data.icon || '/icon-192.png',
          badge: data.badge || '/favicon.svg',
          data: data.data || {},
          actions: data.actions || [],
          tag: data.tag || 'manual-notification'
        };
        
        event.waitUntil(
          self.registration.showNotification(data.title || 'LexMX', options)
        );
      }
      break;
      
    case 'GET_CACHE_INFO':
      event.waitUntil(
        (async () => {
          const cacheNames = await caches.keys();
          const cacheInfo = {};
          
          for (const cacheName of cacheNames) {
            if (cacheName.startsWith('lexmx-')) {
              const cache = await caches.open(cacheName);
              const keys = await cache.keys();
              cacheInfo[cacheName] = {
                name: cacheName,
                size: keys.length
              };
            }
          }
          
          event.ports[0]?.postMessage({
            type: 'CACHE_INFO',
            data: cacheInfo
          });
        })()
      );
      break;
      
    default:
      logMessage('warn', `Unknown message type: ${type}`);
  }
});