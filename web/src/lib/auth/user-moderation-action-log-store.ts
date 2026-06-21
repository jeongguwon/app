export type UserModerationAction = "hide" | "delete" | "warn" | "suspend" | "unsuspend";

export interface UserModerationActionLogRecord {
  id: string;
  action: UserModerationAction;
  postId: string;
  targetEmail: string;
  actorEmail: string;
  createdAt: string;
}

type NowFn = () => number;

class InMemoryUserModerationActionLogStore {
  private readonly logs: UserModerationActionLogRecord[] = [];
  private now: NowFn = Date.now;

  setNow(now: NowFn): void {
    this.now = now;
  }

  resetNow(): void {
    this.now = Date.now;
  }

  create(input: Omit<UserModerationActionLogRecord, "id" | "createdAt">): UserModerationActionLogRecord {
    const log: UserModerationActionLogRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date(this.now()).toISOString(),
      ...input,
    };

    this.logs.push(log);
    return log;
  }

  list(limit: number = 50): UserModerationActionLogRecord[] {
    return [...this.logs]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, Math.max(1, limit));
  }

  clear(): void {
    this.logs.length = 0;
  }
}

const sharedUserModerationActionLogStore = new InMemoryUserModerationActionLogStore();

export function getSharedUserModerationActionLogStore(): InMemoryUserModerationActionLogStore {
  return sharedUserModerationActionLogStore;
}

export function __clearUserModerationActionLogStoreForTests(): void {
  sharedUserModerationActionLogStore.clear();
}

export function __setUserModerationActionLogStoreNowForTests(now: NowFn): void {
  sharedUserModerationActionLogStore.setNow(now);
}

export function __resetUserModerationActionLogStoreNowForTests(): void {
  sharedUserModerationActionLogStore.resetNow();
}