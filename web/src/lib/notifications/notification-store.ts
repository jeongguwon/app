import { getSharedNotificationPreferenceStore } from "@/lib/notifications/notification-preference-store";

export type NotificationType =
  | "claim_received"
  | "claim_approved"
  | "claim_rejected"
  | "message_received"
  | "report_processed";

export interface NotificationRecord {
  id: string;
  recipientEmail: string;
  type: NotificationType;
  title: string;
  body: string;
  postId: string | null;
  createdAt: string;
}

type NowFn = () => number;

const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RECENT_NOTIFICATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

class InMemoryNotificationStore {
  private readonly notifications: NotificationRecord[] = [];
  private now: NowFn = Date.now;

  setNow(now: NowFn): void {
    this.now = now;
  }

  resetNow(): void {
    this.now = Date.now;
  }

  create(input: Omit<NotificationRecord, "id" | "createdAt">): NotificationRecord | null {
    if (!getSharedNotificationPreferenceStore().isEnabled(input.recipientEmail)) {
      return null;
    }

    const notification: NotificationRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date(this.now()).toISOString(),
      ...input,
    };

    this.notifications.push(notification);
    return notification;
  }

  listByRecipient(recipientEmail: string): NotificationRecord[] {
    return this.notifications
      .filter((notification) => notification.recipientEmail === recipientEmail)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  listRecentByRecipient(recipientEmail: string, now: number = this.now()): NotificationRecord[] {
    const cutoff = now - RECENT_NOTIFICATION_WINDOW_MS;

    return this.listByRecipient(recipientEmail).filter((notification) => {
      const createdAt = Date.parse(notification.createdAt);

      return !Number.isNaN(createdAt) && createdAt >= cutoff;
    });
  }

  purgeExpired(now: number = this.now()): number {
    const cutoff = now - NOTIFICATION_RETENTION_MS;
    const beforeCount = this.notifications.length;

    const keptNotifications = this.notifications.filter((notification) => {
      const createdAt = Date.parse(notification.createdAt);

      return Number.isNaN(createdAt) || createdAt >= cutoff;
    });

    this.notifications.length = 0;
    this.notifications.push(...keptNotifications);

    return beforeCount - keptNotifications.length;
  }

  clear(): void {
    this.notifications.length = 0;
  }
}

const sharedNotificationStore = new InMemoryNotificationStore();

export function getSharedNotificationStore(): InMemoryNotificationStore {
  return sharedNotificationStore;
}

export function __clearNotificationStoreForTests(): void {
  sharedNotificationStore.clear();
}

export function __setNotificationStoreNowForTests(now: NowFn): void {
  sharedNotificationStore.setNow(now);
}

export function __resetNotificationStoreNowForTests(): void {
  sharedNotificationStore.resetNow();
}
