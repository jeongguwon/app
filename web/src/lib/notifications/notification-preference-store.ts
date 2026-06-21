type PreferenceRecord = {
  enabled: boolean;
  updatedAt: string;
};

type NowFn = () => number;

class InMemoryNotificationPreferenceStore {
  private readonly preferences = new Map<string, PreferenceRecord>();
  private now: NowFn = Date.now;

  setNow(now: NowFn): void {
    this.now = now;
  }

  resetNow(): void {
    this.now = Date.now;
  }

  isEnabled(recipientEmail: string): boolean {
    return this.preferences.get(recipientEmail)?.enabled ?? true;
  }

  get(recipientEmail: string): PreferenceRecord {
    return this.preferences.get(recipientEmail) ?? {
      enabled: true,
      updatedAt: new Date(0).toISOString(),
    };
  }

  set(recipientEmail: string, enabled: boolean): PreferenceRecord {
    const preference: PreferenceRecord = {
      enabled,
      updatedAt: new Date(this.now()).toISOString(),
    };

    this.preferences.set(recipientEmail, preference);
    return preference;
  }

  clear(): void {
    this.preferences.clear();
  }
}

const sharedNotificationPreferenceStore = new InMemoryNotificationPreferenceStore();

export function getSharedNotificationPreferenceStore(): InMemoryNotificationPreferenceStore {
  return sharedNotificationPreferenceStore;
}

export function __clearNotificationPreferenceStoreForTests(): void {
  sharedNotificationPreferenceStore.clear();
}

export function __setNotificationPreferenceStoreNowForTests(now: NowFn): void {
  sharedNotificationPreferenceStore.setNow(now);
}

export function __resetNotificationPreferenceStoreNowForTests(): void {
  sharedNotificationPreferenceStore.resetNow();
}