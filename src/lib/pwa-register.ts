import { registerSW } from 'virtual:pwa-register';
import { $swNeedsRefresh, $swOfflineReady, setSwActivator } from '@/stores/pwa';

/**
 * Registers the Workbox service worker built from `src/sw.ts` and wires its
 * lifecycle into Nano Stores. Called once from a module script in
 * BaseLayout.astro. Replaces the hand-written public/sw.js registration.
 */
export function initPwaRegister(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    onNeedRefresh() {
      $swNeedsRefresh.set(true);
    },
    onOfflineReady() {
      $swOfflineReady.set(true);
    },
    onRegisterError(error) {
      console.warn('SW registration failed:', error);
    },
  });
  setSwActivator(async () => {
    await updateSW(true);
  });
}
