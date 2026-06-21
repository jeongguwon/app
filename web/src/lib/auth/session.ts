interface SessionRecord {
  email: string;
  createdAtMs: number;
}

class InMemorySessionStore {
  private readonly records = new Map<string, SessionRecord>();

  createSession(email: string): string {
    const token = crypto.randomUUID();

    this.records.set(token, {
      email: email.trim().toLowerCase(),
      createdAtMs: Date.now(),
    });

    return token;
  }

  getEmailByToken(token: string): string | null {
    const record = this.records.get(token);

    if (!record) {
      return null;
    }

    return record.email;
  }

  deleteSession(token: string): void {
    this.records.delete(token);
  }

  clear(): void {
    this.records.clear();
  }
}

const sharedSessionStore = new InMemorySessionStore();

export function getSharedSessionStore(): InMemorySessionStore {
  return sharedSessionStore;
}

export function readAuthSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((item) => item.trim());
  const target = parts.find((item) => item.startsWith("auth_session="));

  if (!target) {
    return null;
  }

  const token = target.slice("auth_session=".length).trim();
  return token || null;
}

export function __clearSessionStoreForTests(): void {
  sharedSessionStore.clear();
}
