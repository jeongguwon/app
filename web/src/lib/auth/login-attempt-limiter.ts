interface LoginAttemptRecord {
  failures: number;
  lockUntilMs: number;
}

interface LoginAttemptLimiterOptions {
  maxFailures: number;
  lockSeconds: number;
  now: () => number;
}

const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_LOCK_SECONDS = 15 * 60;

export class LoginAttemptLimiter {
  private readonly maxFailures: number;
  private readonly lockSeconds: number;
  private readonly now: () => number;
  private readonly records = new Map<string, LoginAttemptRecord>();

  constructor(options?: Partial<LoginAttemptLimiterOptions>) {
    this.maxFailures = options?.maxFailures ?? DEFAULT_MAX_FAILURES;
    this.lockSeconds = options?.lockSeconds ?? DEFAULT_LOCK_SECONDS;
    this.now = options?.now ?? Date.now;
  }

  isLocked(rawEmail: string): boolean {
    const email = normalizeEmail(rawEmail);
    const record = this.records.get(email);

    if (!record) {
      return false;
    }

    if (record.lockUntilMs === 0) {
      return false;
    }

    if (record.lockUntilMs <= this.now()) {
      this.records.delete(email);
      return false;
    }

    return true;
  }

  recordFailure(rawEmail: string): void {
    const email = normalizeEmail(rawEmail);
    const current = this.records.get(email) ?? { failures: 0, lockUntilMs: 0 };

    if (current.lockUntilMs > this.now()) {
      return;
    }

    const nextFailures = current.failures + 1;

    if (nextFailures >= this.maxFailures) {
      this.records.set(email, {
        failures: 0,
        lockUntilMs: this.now() + this.lockSeconds * 1_000,
      });
      return;
    }

    this.records.set(email, {
      failures: nextFailures,
      lockUntilMs: 0,
    });
  }

  reset(rawEmail: string): void {
    const email = normalizeEmail(rawEmail);
    this.records.delete(email);
  }

  clear(): void {
    this.records.clear();
  }
}

function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

const sharedLoginAttemptLimiter = new LoginAttemptLimiter();

export function getSharedLoginAttemptLimiter(): LoginAttemptLimiter {
  return sharedLoginAttemptLimiter;
}

export function __clearLoginAttemptStoreForTests(): void {
  sharedLoginAttemptLimiter.clear();
}
