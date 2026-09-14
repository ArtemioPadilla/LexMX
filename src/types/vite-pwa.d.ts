declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (sw: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }
  export function registerSW(opts?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module 'virtual:pwa-info' {
  export interface PwaInfo {
    webManifest: { href: string; useCredentials: boolean; linkTag: string };
    registerSW?: { inline: boolean; scope: string; inlinePath: string; registerPath: string; type: string; scriptTag?: string };
  }
  export const pwaInfo: PwaInfo | undefined;
}
