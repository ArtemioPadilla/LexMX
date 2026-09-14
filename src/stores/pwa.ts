/**
 * Service-worker lifecycle shared across islands (Fase 5, @vite-pwa/astro).
 * `$swNeedsRefresh` flips when a new worker is waiting; `applySwUpdate()`
 * activates it and reloads.
 */
import { atom } from 'nanostores';

export const $swNeedsRefresh = atom(false);
export const $swOfflineReady = atom(false);

let activator: (() => Promise<void>) | null = null;

export function setSwActivator(fn: () => Promise<void>): void {
  activator = fn;
}

export async function applySwUpdate(): Promise<void> {
  if (activator) await activator();
}
