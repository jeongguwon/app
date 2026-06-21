interface PostCreateLimiterOptions {
  maxCreatesPerHour?: number;
  now?: () => number;
}

class PostCreateLimiter {
  private readonly timestampsByEmail = new Map<string, number[]>();
  private readonly maxCreatesPerHour: number;
  private readonly now: () => number;

  constructor(options?: PostCreateLimiterOptions) {
    this.maxCreatesPerHour = options?.maxCreatesPerHour ?? 5;
    this.now = options?.now ?? Date.now;
  }

  canCreate(email: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const oneHourAgo = this.now() - 60 * 60 * 1000;
    const previous = this.timestampsByEmail.get(normalizedEmail) ?? [];
    const recent = previous.filter((value) => value >= oneHourAgo);

    this.timestampsByEmail.set(normalizedEmail, recent);

    return recent.length < this.maxCreatesPerHour;
  }

  recordCreate(email: string): void {
    const normalizedEmail = email.trim().toLowerCase();
    const oneHourAgo = this.now() - 60 * 60 * 1000;
    const previous = this.timestampsByEmail.get(normalizedEmail) ?? [];
    const recent = previous.filter((value) => value >= oneHourAgo);

    recent.push(this.now());
    this.timestampsByEmail.set(normalizedEmail, recent);
  }

  clear(): void {
    this.timestampsByEmail.clear();
  }
}

let routeNow: () => number = Date.now;
const sharedPostCreateLimiter = new PostCreateLimiter({ now: () => routeNow() });

export function getSharedPostCreateLimiter(): PostCreateLimiter {
  return sharedPostCreateLimiter;
}

export function __setPostCreateLimiterNowForTests(now: () => number): void {
  routeNow = now;
}

export function __resetPostCreateLimiterNowForTests(): void {
  routeNow = Date.now;
}

export function __clearPostCreateLimiterForTests(): void {
  sharedPostCreateLimiter.clear();
}
