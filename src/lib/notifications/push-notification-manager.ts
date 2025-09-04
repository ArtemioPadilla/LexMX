/**
 * Push Notification Manager for LexMX
 * Handles push notification subscriptions and delivery for legal updates
 */

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: {
    url?: string;
    action?: string;
    queryId?: string;
    documentId?: string;
    caseId?: string;
    type: 'legal_update' | 'query_complete' | 'document_ready' | 'case_update' | 'system_alert';
    timestamp: string;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface SubscriptionInfo {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  subscriptionId: string;
  userId?: string;
  preferences: {
    legalUpdates: boolean;
    queryCompletions: boolean;
    documentUpdates: boolean;
    caseAlerts: boolean;
    systemAlerts: boolean;
  };
  createdAt: Date;
  lastActive: Date;
}

/**
 * Push Notification Manager
 * Handles subscription management and notification delivery
 */
export class PushNotificationManager {
  private static instance: PushNotificationManager;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string;
  
  // For demo purposes, using a placeholder VAPID key
  // In production, this should come from your server
  private readonly DEFAULT_VAPID_KEY = 'BMqSvZiRjxTFVKIVfRruxgSQ3yb1p2vYJCKE8NeIoLZm7OGwlYUdLV6LZ7IJhZZh5Rv5sEQXu5yLhQGPQOHOPCI';

  private constructor(vapidKey?: string) {
    this.vapidPublicKey = vapidKey || this.DEFAULT_VAPID_KEY;
    this.initialize();
  }

  static getInstance(vapidKey?: string): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager(vapidKey);
    }
    return PushNotificationManager.instance;
  }

  private async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PushNotifications] Push notifications not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      console.log('[PushNotifications] Service worker ready');
      
      // Check existing subscription
      this.subscription = await this.registration.pushManager.getSubscription();
      if (this.subscription) {
        console.log('[PushNotifications] Existing subscription found');
      }
    } catch (error) {
      console.error('[PushNotifications] Initialization failed:', error);
    }
  }

  /**
   * Check if push notifications are supported and permission granted
   */
  isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('[PushNotifications] Permission:', permission);
    
    if (permission === 'granted') {
      // Try to subscribe automatically after permission granted
      await this.subscribe();
    }
    
    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(preferences?: Partial<SubscriptionInfo['preferences']>): Promise<SubscriptionInfo | null> {
    if (!this.registration || this.getPermissionStatus() !== 'granted') {
      console.warn('[PushNotifications] Cannot subscribe - no registration or permission');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.subscription = subscription;
      
      const subscriptionInfo: SubscriptionInfo = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth'))
        },
        subscriptionId: this.generateSubscriptionId(),
        preferences: {
          legalUpdates: true,
          queryCompletions: true,
          documentUpdates: true,
          caseAlerts: true,
          systemAlerts: false,
          ...preferences
        },
        createdAt: new Date(),
        lastActive: new Date()
      };

      // Save subscription locally
      this.saveSubscriptionInfo(subscriptionInfo);
      
      // In a real app, send subscription to your server
      console.log('[PushNotifications] Subscribed:', subscriptionInfo);
      
      return subscriptionInfo;
    } catch (error) {
      console.error('[PushNotifications] Subscription failed:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      if (success) {
        this.subscription = null;
        this.clearSubscriptionInfo();
        console.log('[PushNotifications] Unsubscribed successfully');
      }
      return success;
    } catch (error) {
      console.error('[PushNotifications] Unsubscribe failed:', error);
      return false;
    }
  }

  /**
   * Get current subscription info
   */
  async getSubscriptionInfo(): Promise<SubscriptionInfo | null> {
    if (typeof window === 'undefined') return null;
    
    try {
      const saved = localStorage.getItem('lexmx_push_subscription');
      if (saved) {
        const info = JSON.parse(saved);
        // Convert date strings back to Date objects
        info.createdAt = new Date(info.createdAt);
        info.lastActive = new Date(info.lastActive);
        return info;
      }
    } catch (error) {
      console.warn('[PushNotifications] Failed to load subscription info:', error);
    }
    
    return null;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: Partial<SubscriptionInfo['preferences']>): Promise<boolean> {
    const currentInfo = await this.getSubscriptionInfo();
    if (!currentInfo) return false;

    const updatedInfo: SubscriptionInfo = {
      ...currentInfo,
      preferences: {
        ...currentInfo.preferences,
        ...preferences
      },
      lastActive: new Date()
    };

    this.saveSubscriptionInfo(updatedInfo);
    
    // In a real app, update preferences on your server
    console.log('[PushNotifications] Preferences updated:', updatedInfo.preferences);
    
    return true;
  }

  /**
   * Send a local notification (for testing/demo purposes)
   */
  async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    if (this.getPermissionStatus() !== 'granted') {
      console.warn('[PushNotifications] No permission for local notifications');
      return;
    }

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/favicon.svg',
      badge: payload.badge || '/favicon.svg',
      image: payload.image,
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions,
      requireInteraction: payload.data?.type === 'case_update', // Keep case updates visible
      silent: false,
      timestamp: Date.now()
    };

    // Use service worker to show notification for better control
    if (this.registration) {
      await this.registration.showNotification(payload.title, options);
    } else {
      // Fallback to regular notification
      new Notification(payload.title, options);
    }
  }

  /**
   * Create predefined legal update notifications
   */
  async notifyLegalUpdate(update: {
    documentTitle: string;
    updateType: 'new' | 'modified' | 'deleted';
    legalArea: string;
    url?: string;
  }): Promise<void> {
    const preferences = await this.getSubscriptionInfo();
    if (!preferences?.preferences.legalUpdates) return;

    const payload: NotificationPayload = {
      title: '⚖️ Actualización Legal',
      body: `${update.documentTitle} - ${update.legalArea}`,
      icon: '/icon-192.png',
      tag: `legal-update-${Date.now()}`,
      data: {
        type: 'legal_update',
        url: update.url || '/legal',
        documentId: update.documentTitle,
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'view',
          title: 'Ver documento',
          icon: '/icon-192.png'
        },
        {
          action: 'dismiss',
          title: 'Descartar'
        }
      ]
    };

    await this.sendLocalNotification(payload);
  }

  /**
   * Notify when offline query is completed
   */
  async notifyQueryCompleted(query: {
    id: string;
    query: string;
    hasResults: boolean;
  }): Promise<void> {
    const preferences = await this.getSubscriptionInfo();
    if (!preferences?.preferences.queryCompletions) return;

    const payload: NotificationPayload = {
      title: '💬 Consulta Legal Completada',
      body: query.hasResults 
        ? `Tu consulta "${query.query.substring(0, 50)}..." tiene respuesta`
        : `Tu consulta "${query.query.substring(0, 50)}..." se procesó`,
      icon: '/icon-192.png',
      tag: `query-${query.id}`,
      data: {
        type: 'query_complete',
        queryId: query.id,
        url: '/chat',
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'view',
          title: 'Ver respuesta',
          icon: '/icon-192.png'
        }
      ]
    };

    await this.sendLocalNotification(payload);
  }

  /**
   * Notify when document processing is complete
   */
  async notifyDocumentReady(document: {
    id: string;
    filename: string;
    caseId?: string;
  }): Promise<void> {
    const preferences = await this.getSubscriptionInfo();
    if (!preferences?.preferences.documentUpdates) return;

    const payload: NotificationPayload = {
      title: '📄 Documento Procesado',
      body: `${document.filename} está listo para análisis`,
      icon: '/icon-192.png',
      tag: `document-${document.id}`,
      data: {
        type: 'document_ready',
        documentId: document.id,
        caseId: document.caseId,
        url: document.caseId ? `/casos/${document.caseId}` : '/casos',
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'view',
          title: 'Ver documento',
          icon: '/icon-192.png'
        }
      ]
    };

    await this.sendLocalNotification(payload);
  }

  /**
   * Notify about case updates
   */
  async notifyCaseUpdate(caseUpdate: {
    caseId: string;
    caseTitle: string;
    updateType: 'deadline' | 'status' | 'document' | 'note';
    message: string;
  }): Promise<void> {
    const preferences = await this.getSubscriptionInfo();
    if (!preferences?.preferences.caseAlerts) return;

    const payload: NotificationPayload = {
      title: '📁 Actualización de Caso',
      body: `${caseUpdate.caseTitle}: ${caseUpdate.message}`,
      icon: '/icon-192.png',
      tag: `case-${caseUpdate.caseId}-${caseUpdate.updateType}`,
      data: {
        type: 'case_update',
        caseId: caseUpdate.caseId,
        url: `/casos/${caseUpdate.caseId}`,
        action: caseUpdate.updateType,
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'view',
          title: 'Ver caso',
          icon: '/icon-192.png'
        }
      ]
    };

    await this.sendLocalNotification(payload);
  }

  /**
   * Test notification functionality
   */
  async sendTestNotification(): Promise<void> {
    const payload: NotificationPayload = {
      title: '🧪 Prueba de Notificación',
      body: 'Las notificaciones de LexMX están funcionando correctamente',
      icon: '/icon-192.png',
      tag: 'test-notification',
      data: {
        type: 'system_alert',
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'ok',
          title: 'Entendido'
        }
      ]
    };

    await this.sendLocalNotification(payload);
  }

  // Utility methods

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveSubscriptionInfo(info: SubscriptionInfo): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('lexmx_push_subscription', JSON.stringify(info));
    } catch (error) {
      console.warn('[PushNotifications] Failed to save subscription info:', error);
    }
  }

  private clearSubscriptionInfo(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem('lexmx_push_subscription');
    } catch (error) {
      console.warn('[PushNotifications] Failed to clear subscription info:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationManager = PushNotificationManager.getInstance();