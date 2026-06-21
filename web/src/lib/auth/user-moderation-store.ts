export type UserModerationStatus = "active" | "suspended";

export interface UserModerationRecord {
  email: string;
  status: UserModerationStatus;
  warningCount: number;
  warnedAt: string | null;
  suspendedAt: string | null;
}

type NowFn = () => number;

class InMemoryUserModerationStore {
  private readonly records = new Map<string, UserModerationRecord>();
  private now: NowFn = Date.now;

  setNow(now: NowFn): void {
    this.now = now;
  }

  resetNow(): void {
    this.now = Date.now;
  }

  get(email: string): UserModerationRecord {
    return (
      this.records.get(email) ?? {
        email,
        status: "active",
        warningCount: 0,
        warnedAt: null,
        suspendedAt: null,
      }
    );
  }

  warn(email: string): UserModerationRecord {
    const current = this.get(email);
    const updated: UserModerationRecord = {
      ...current,
      warningCount: current.warningCount + 1,
      warnedAt: new Date(this.now()).toISOString(),
    };

    this.records.set(email, updated);
    return updated;
  }

  suspend(email: string): UserModerationRecord {
    const current = this.get(email);
    const updated: UserModerationRecord = {
      ...current,
      status: "suspended",
      suspendedAt: new Date(this.now()).toISOString(),
    };

    this.records.set(email, updated);
    return updated;
  }

  unsuspend(email: string): UserModerationRecord {
    const current = this.get(email);
    const updated: UserModerationRecord = {
      ...current,
      status: "active",
      suspendedAt: null,
    };

    this.records.set(email, updated);
    return updated;
  }

  isSuspended(email: string): boolean {
    return this.get(email).status === "suspended";
  }

  clear(): void {
    this.records.clear();
  }
}

const sharedUserModerationStore = new InMemoryUserModerationStore();

export function getSharedUserModerationStore(): InMemoryUserModerationStore {
  return sharedUserModerationStore;
}

export function __clearUserModerationStoreForTests(): void {
  sharedUserModerationStore.clear();
}

export function __setUserModerationStoreNowForTests(now: NowFn): void {
  sharedUserModerationStore.setNow(now);
}

export function __resetUserModerationStoreNowForTests(): void {
  sharedUserModerationStore.resetNow();
}