/**
 * PWA Installation and Management
 * Handles PWA installation prompts, updates, and lifecycle management
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWAInstallationState {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  lastPromptDismissed: Date | null;
  installCount: number;
}

/**
 * PWA Manager for handling installation and updates
 */
export class PWAManager {
  private static instance: PWAManager;
  private state: PWAInstallationState = {
    canInstall: false,
    isInstalled: false,
    isStandalone: false,
    installPrompt: null,
    lastPromptDismissed: null,
    installCount: 0
  };
  
  private listeners: Set<(state: PWAInstallationState) => void> = new Set();
  private readonly STORAGE_KEY = 'lexmx_pwa_state';

  private constructor() {
    this.initialize();
  }

  static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager();
    }
    return PWAManager.instance;
  }

  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Load saved state
    this.loadState();

    // Check if running in standalone mode
    this.state.isStandalone = this.checkStandaloneMode();

    // Check if already installed via navigator.standalone (iOS)
    this.state.isInstalled = this.checkInstallationStatus();

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt.bind(this));

    // Listen for app installed event
    window.addEventListener('appinstalled', this.handleAppInstalled.bind(this));

    // Listen for PWA update available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
    }

    // Check for updates periodically
    this.setupUpdateCheck();

    this.notifyListeners();
  }

  private handleBeforeInstallPrompt(event: BeforeInstallPromptEvent): void {
    // Prevent the mini-infobar from appearing
    event.preventDefault();

    // Save the event for later use
    this.state.installPrompt = event;
    this.state.canInstall = true;

    console.log('[PWA] Install prompt ready');
    this.notifyListeners();
  }

  private handleAppInstalled(): void {
    console.log('[PWA] App was installed');
    
    this.state.isInstalled = true;
    this.state.canInstall = false;
    this.state.installPrompt = null;
    this.state.installCount++;

    this.saveState();
    this.notifyListeners();

    // Track installation event
    this.trackEvent('pwa_installed');
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    if (event.data?.type === 'UPDATE_AVAILABLE') {
      console.log('[PWA] Update available');
      
      // Notify listeners about available update
      window.dispatchEvent(new CustomEvent('pwa-update-available', {
        detail: event.data
      }));
    }
  }

  /**
   * Prompt user to install PWA
   */
  async promptInstall(): Promise<{ outcome: string; platform: string } | null> {
    if (!this.state.installPrompt) {
      console.warn('[PWA] No install prompt available');
      return null;
    }

    try {
      // Show the install prompt
      await this.state.installPrompt.prompt();

      // Wait for user choice
      const choiceResult = await this.state.installPrompt.userChoice;

      console.log('[PWA] User choice:', choiceResult.outcome);

      if (choiceResult.outcome === 'dismissed') {
        this.state.lastPromptDismissed = new Date();
        this.saveState();
      }

      // Clear the prompt
      this.state.installPrompt = null;
      this.state.canInstall = false;
      this.notifyListeners();

      // Track user choice
      this.trackEvent('pwa_install_prompt', {
        outcome: choiceResult.outcome,
        platform: choiceResult.platform
      });

      return choiceResult;
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error);
      return null;
    }
  }

  /**
   * Check if should show install prompt
   */
  shouldShowInstallPrompt(): boolean {
    // Don't show if already installed or can't install
    if (this.state.isInstalled || !this.state.canInstall) {
      return false;
    }

    // Don't show if dismissed recently (within 7 days)
    if (this.state.lastPromptDismissed) {
      const daysSinceDismissed = (Date.now() - this.state.lastPromptDismissed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return false;
      }
    }

    // Don't show too frequently
    if (this.state.installCount > 3) {
      return false;
    }

    return true;
  }

  /**
   * Check if running in standalone mode
   */
  private checkStandaloneMode(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS standalone mode
      (window.navigator as any).standalone === true ||
      // Android standalone mode
      document.referrer.startsWith('android-app://')
    );
  }

  /**
   * Check installation status
   */
  private checkInstallationStatus(): boolean {
    // iOS Safari standalone
    if ((window.navigator as any).standalone === true) {
      return true;
    }

    // Chrome/Edge - check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // Check if installed via related applications API (experimental)
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((apps: any[]) => {
        if (apps.length > 0) {
          this.state.isInstalled = true;
          this.notifyListeners();
        }
      }).catch(() => {
        // Ignore errors
      });
    }

    return false;
  }

  /**
   * Setup periodic update checks
   */
  private setupUpdateCheck(): void {
    if (!('serviceWorker' in navigator)) return;

    // Check for updates every 30 minutes
    setInterval(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      } catch (error) {
        console.warn('[PWA] Update check failed:', error);
      }
    }, 30 * 60 * 1000);

    // Also check for updates when page gains focus
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update();
          }
        } catch (error) {
          console.warn('[PWA] Update check failed:', error);
        }
      }
    });
  }

  /**
   * Force reload to apply updates
   */
  async applyUpdate(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        // Tell the waiting SW to activate
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Reload the page to use the new service worker
        window.location.reload();
      }
    } catch (error) {
      console.error('[PWA] Failed to apply update:', error);
    }
  }

  /**
   * Get installation instructions based on device/browser
   */
  getInstallInstructions(): {
    platform: string;
    browser: string;
    instructions: string[];
  } {
    const userAgent = navigator.userAgent.toLowerCase();
    let platform = 'desktop';
    let browser = 'chrome';
    let instructions: string[] = [];

    // Detect platform
    if (/android/.test(userAgent)) {
      platform = 'android';
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      platform = 'ios';
    }

    // Detect browser
    if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
      browser = 'safari';
    } else if (/firefox/.test(userAgent)) {
      browser = 'firefox';
    } else if (/edge/.test(userAgent)) {
      browser = 'edge';
    }

    // Platform-specific instructions
    switch (platform) {
      case 'ios':
        if (browser === 'safari') {
          instructions = [
            'Toca el botón de compartir (cuadrado con flecha hacia arriba)',
            'Desplázate hacia abajo y toca "Añadir a la pantalla de inicio"',
            'Toca "Añadir" para confirmar'
          ];
        } else {
          instructions = [
            'Para instalar LexMX, necesitas usar Safari',
            'Abre esta página en Safari',
            'Sigue las instrucciones de instalación'
          ];
        }
        break;

      case 'android':
        instructions = [
          'Toca el menú del navegador (⋮)',
          'Selecciona "Instalar aplicación" o "Añadir a la pantalla de inicio"',
          'Toca "Instalar" para confirmar'
        ];
        break;

      default:
        instructions = [
          'Busca el ícono de instalación en la barra de direcciones',
          'Haz clic en "Instalar LexMX"',
          'Confirma la instalación'
        ];
    }

    return { platform, browser, instructions };
  }

  /**
   * Get PWA capabilities info
   */
  getCapabilities(): {
    offline: boolean;
    notifications: boolean;
    backgroundSync: boolean;
    shareTarget: boolean;
    shortcuts: boolean;
  } {
    return {
      offline: 'serviceWorker' in navigator,
      notifications: 'Notification' in window,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      shareTarget: 'share' in navigator || 'shareTarget' in (window as any),
      shortcuts: 'getInstalledRelatedApps' in navigator
    };
  }

  /**
   * Subscribe to state changes
   */
  onChange(listener: (state: PWAInstallationState) => void): () => void {
    this.listeners.add(listener);
    
    // Send initial state
    listener(this.getState());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current PWA state
   */
  getState(): PWAInstallationState {
    return { ...this.state };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('[PWA] Listener error:', error);
      }
    });
  }

  private saveState(): void {
    if (typeof window === 'undefined') return;

    try {
      const stateToSave = {
        lastPromptDismissed: this.state.lastPromptDismissed,
        installCount: this.state.installCount
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('[PWA] Failed to save state:', error);
    }
  }

  private loadState(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        this.state.lastPromptDismissed = state.lastPromptDismissed ? new Date(state.lastPromptDismissed) : null;
        this.state.installCount = state.installCount || 0;
      }
    } catch (error) {
      console.warn('[PWA] Failed to load state:', error);
    }
  }

  private trackEvent(event: string, data?: any): void {
    // Track PWA events for analytics
    console.log(`[PWA] Event: ${event}`, data);
    
    // Custom event for analytics integration
    window.dispatchEvent(new CustomEvent('pwa-event', {
      detail: { event, data, timestamp: new Date().toISOString() }
    }));
  }
}

// Export singleton instance
export const pwaManager = PWAManager.getInstance();