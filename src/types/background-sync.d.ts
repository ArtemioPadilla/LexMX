// Background Sync API type declarations
declare global {
  interface ServiceWorkerRegistration {
    sync: SyncManager;
  }

  interface SyncManager {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  }

  interface Window {
    ServiceWorkerRegistration: {
      prototype: ServiceWorkerRegistration;
    };
  }

  interface ServiceWorkerGlobalScope {
    addEventListener(
      type: 'sync',
      listener: (event: SyncEvent) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
  }

  interface SyncEvent extends ExtendableEvent {
    tag: string;
    lastChance: boolean;
  }
}

export {};