import type { 
  RequestNotification, 
  DocumentRequest, 
  RequestStatus 
} from '../../types/legal';

/**
 * Notification System for Document Requests
 * Handles creating, storing, and managing notifications for users
 */
export class NotificationSystem {
  private static readonly STORAGE_KEY = 'lexmx_notifications';
  private static readonly MAX_NOTIFICATIONS = 100;

  /**
   * Creates a notification for status changes
   */
  static async createStatusChangeNotification(
    requestId: string,
    recipientId: string,
    oldStatus: RequestStatus,
    newStatus: RequestStatus,
    requestTitle: string
  ): Promise<RequestNotification> {
    const notification: RequestNotification = {
      id: this.generateId(),
      requestId,
      recipientId,
      type: 'status_change',
      title: 'Estado de solicitud actualizado',
      message: `Tu solicitud "${requestTitle}" cambió de ${this.getStatusLabel(oldStatus)} a ${this.getStatusLabel(newStatus)}`,
      read: false,
      createdAt: new Date().toISOString()
    };

    await this.storeNotification(notification);
    return notification;
  }

  /**
   * Creates a notification for new comments
   */
  static async createCommentNotification(
    requestId: string,
    recipientId: string,
    requestTitle: string,
    commenterType: 'user' | 'moderator'
  ): Promise<RequestNotification> {
    const notification: RequestNotification = {
      id: this.generateId(),
      requestId,
      recipientId,
      type: 'new_comment',
      title: 'Nuevo comentario en tu solicitud',
      message: `${commenterType === 'moderator' ? 'Un moderador' : 'Un usuario'} comentó en tu solicitud "${requestTitle}"`,
      read: false,
      createdAt: new Date().toISOString()
    };

    await this.storeNotification(notification);
    return notification;
  }

  /**
   * Creates a notification for vote milestones
   */
  static async createVoteMilestoneNotification(
    requestId: string,
    recipientId: string,
    requestTitle: string,
    votes: number,
    milestone: number
  ): Promise<RequestNotification> {
    const notification: RequestNotification = {
      id: this.generateId(),
      requestId,
      recipientId,
      type: 'vote_milestone',
      title: `¡${votes} votos alcanzados!`,
      message: `Tu solicitud "${requestTitle}" ha alcanzado ${votes} votos y superó el umbral de ${milestone}`,
      read: false,
      createdAt: new Date().toISOString()
    };

    await this.storeNotification(notification);
    return notification;
  }

  /**
   * Creates a notification for request completion
   */
  static async createCompletionNotification(
    requestId: string,
    recipientId: string,
    requestTitle: string,
    documentUrl?: string
  ): Promise<RequestNotification> {
    const notification: RequestNotification = {
      id: this.generateId(),
      requestId,
      recipientId,
      type: 'completion',
      title: '¡Solicitud completada!',
      message: `Tu solicitud "${requestTitle}" ha sido procesada y el documento está ahora disponible en LexMX${documentUrl ? `. Ver documento: ${documentUrl}` : ''}`,
      read: false,
      createdAt: new Date().toISOString()
    };

    await this.storeNotification(notification);
    return notification;
  }

  /**
   * Retrieves all notifications for a user
   */
  static async getNotifications(userId: string): Promise<RequestNotification[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const allNotifications: RequestNotification[] = JSON.parse(stored);
      return allNotifications
        .filter(n => n.recipientId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error retrieving notifications:', error);
      return [];
    }
  }

  /**
   * Marks a notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const notifications: RequestNotification[] = JSON.parse(stored);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (notification) {
        notification.read = true;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Marks all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const notifications: RequestNotification[] = JSON.parse(stored);
      notifications.forEach(notification => {
        if (notification.recipientId === userId) {
          notification.read = true;
        }
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  /**
   * Deletes a notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const notifications: RequestNotification[] = JSON.parse(stored);
      const filtered = notifications.filter(n => n.id !== notificationId);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  /**
   * Gets unread notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getNotifications(userId);
    return notifications.filter(n => !n.read).length;
  }

  /**
   * Cleans up old notifications (keeps only last 100)
   */
  static async cleanupOldNotifications(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const notifications: RequestNotification[] = JSON.parse(stored);
      
      if (notifications.length > this.MAX_NOTIFICATIONS) {
        // Sort by date and keep only the most recent
        const sorted = notifications.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        const kept = sorted.slice(0, this.MAX_NOTIFICATIONS);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(kept));
      }
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  }

  /**
   * Batch creates notifications for vote milestones
   */
  static async handleVoteMilestones(
    request: DocumentRequest,
    previousVotes: number,
    currentVotes: number
  ): Promise<void> {
    const milestones = [5, 10, 15, 25, 50, 100];
    
    for (const milestone of milestones) {
      if (previousVotes < milestone && currentVotes >= milestone) {
        await this.createVoteMilestoneNotification(
          request.id,
          request.requestedBy,
          request.title,
          currentVotes,
          milestone
        );
      }
    }
  }

  /**
   * Creates notifications for all watchers of a request
   */
  static async notifyWatchers(
    request: DocumentRequest,
    watchers: string[],
    type: 'status_change' | 'new_comment' | 'completion',
    message: string
  ): Promise<void> {
    const notifications = watchers.map(watcherId => ({
      id: this.generateId(),
      requestId: request.id,
      recipientId: watcherId,
      type,
      title: this.getTitleForType(type),
      message: `En "${request.title}": ${message}`,
      read: false,
      createdAt: new Date().toISOString()
    }));

    await this.storeMultipleNotifications(notifications);
  }

  /**
   * In-browser notification (if permission granted)
   */
  static async showBrowserNotification(
    title: string,
    message: string,
    requestId?: string
  ): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/icon-192.png',
        badge: '/favicon.svg',
        tag: requestId || 'lexmx-notification',
        requireInteraction: false
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Handle clicks
      notification.onclick = () => {
        window.focus();
        if (requestId) {
          // Navigate to the request
          window.location.href = `/requests/${requestId}`;
        }
        notification.close();
      };
    }
  }

  /**
   * Requests browser notification permission
   */
  static async requestNotificationPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Private helper methods
   */
  private static generateId(): string {
    return 'notif_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private static async storeNotification(notification: RequestNotification): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const notifications: RequestNotification[] = stored ? JSON.parse(stored) : [];
      
      notifications.unshift(notification); // Add to beginning
      
      // Keep only latest notifications
      if (notifications.length > this.MAX_NOTIFICATIONS) {
        notifications.splice(this.MAX_NOTIFICATIONS);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  private static async storeMultipleNotifications(notifications: RequestNotification[]): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const existingNotifications: RequestNotification[] = stored ? JSON.parse(stored) : [];
      
      existingNotifications.unshift(...notifications);
      
      // Keep only latest notifications
      if (existingNotifications.length > this.MAX_NOTIFICATIONS) {
        existingNotifications.splice(this.MAX_NOTIFICATIONS);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingNotifications));
    } catch (error) {
      console.error('Error storing multiple notifications:', error);
    }
  }

  private static getStatusLabel(status: RequestStatus): string {
    const labels = {
      pending: 'Pendiente',
      under_review: 'En Revisión',
      in_progress: 'En Proceso',
      completed: 'Completado',
      rejected: 'Rechazado',
      duplicate: 'Duplicado'
    };
    return labels[status] || status;
  }

  private static getTitleForType(type: RequestNotification['type']): string {
    const titles = {
      status_change: 'Estado actualizado',
      new_comment: 'Nuevo comentario',
      vote_milestone: 'Nuevo hito de votos',
      completion: 'Solicitud completada'
    };
    return titles[type] || 'Notificación';
  }
}

/**
 * React Hook for notifications
 */
export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<RequestNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const [userNotifications, count] = await Promise.all([
          NotificationSystem.getNotifications(userId),
          NotificationSystem.getUnreadCount(userId)
        ]);
        
        setNotifications(userNotifications);
        setUnreadCount(count);
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(loadNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    await NotificationSystem.markAsRead(notificationId);
    
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    
    await NotificationSystem.markAllAsRead(userId);
    
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (notificationId: string) => {
    await NotificationSystem.deleteNotification(notificationId);
    
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      const filtered = prev.filter(n => n.id !== notificationId);
      
      if (notification && !notification.read) {
        setUnreadCount(prevCount => Math.max(0, prevCount - 1));
      }
      
      return filtered;
    });
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: () => userId && NotificationSystem.getNotifications(userId).then(setNotifications)
  };
}

// Import for useState
import { useState, useEffect } from 'react';