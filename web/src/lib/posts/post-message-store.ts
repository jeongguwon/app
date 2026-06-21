export interface PostMessageRecord {
  id: string;
  postId: string;
  senderEmail: string;
  content: string;
  createdAt: string;
}

type NowFn = () => number;

const MESSAGE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

class InMemoryPostMessageStore {
  private readonly messages: PostMessageRecord[] = [];
  private now: NowFn = Date.now;

  setNow(now: NowFn): void {
    this.now = now;
  }

  resetNow(): void {
    this.now = Date.now;
  }

  listByPost(postId: string): PostMessageRecord[] {
    return this.messages.filter((message) => message.postId === postId);
  }

  hasMessageFromSender(postId: string, senderEmail: string): boolean {
    return this.messages.some(
      (message) => message.postId === postId && message.senderEmail === senderEmail
    );
  }

  create(postId: string, senderEmail: string, content: string): PostMessageRecord {
    const message: PostMessageRecord = {
      id: crypto.randomUUID(),
      postId,
      senderEmail,
      content,
      createdAt: new Date(this.now()).toISOString(),
    };

    this.messages.push(message);
    return message;
  }

  purgeExpired(now: number = this.now()): number {
    const cutoff = now - MESSAGE_RETENTION_MS;
    const beforeCount = this.messages.length;

    const keptMessages = this.messages.filter((message) => {
      const createdAt = Date.parse(message.createdAt);

      return Number.isNaN(createdAt) || createdAt >= cutoff;
    });

    this.messages.length = 0;
    this.messages.push(...keptMessages);

    return beforeCount - keptMessages.length;
  }

  clear(): void {
    this.messages.length = 0;
  }
}

const sharedPostMessageStore = new InMemoryPostMessageStore();

export function getSharedPostMessageStore(): InMemoryPostMessageStore {
  return sharedPostMessageStore;
}

export function __clearPostMessageStoreForTests(): void {
  sharedPostMessageStore.clear();
}

export function __setPostMessageStoreNowForTests(now: NowFn): void {
  sharedPostMessageStore.setNow(now);
}

export function __resetPostMessageStoreNowForTests(): void {
  sharedPostMessageStore.resetNow();
}
