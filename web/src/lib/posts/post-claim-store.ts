export type ClaimPath = "owner" | "finder";
export type ClaimStatus = "approved" | "pending" | "rejected";

export interface PostClaimRecord {
  id: string;
  postId: string;
  claimantEmail: string;
  path: ClaimPath;
  status: ClaimStatus;
  createdAt: string;
}

type NowFn = () => number;

class InMemoryPostClaimStore {
  private readonly claims: PostClaimRecord[] = [];
  private readonly failedAttempts = new Map<string, number[]>();
  private now: NowFn = Date.now;

  setNow(now: NowFn): void {
    this.now = now;
  }

  resetNow(): void {
    this.now = Date.now;
  }

  create(postId: string, claimantEmail: string, path: ClaimPath, status: ClaimStatus): PostClaimRecord {
    const claim: PostClaimRecord = {
      id: crypto.randomUUID(),
      postId,
      claimantEmail,
      path,
      status,
      createdAt: new Date(this.now()).toISOString(),
    };

    this.claims.push(claim);
    return claim;
  }

  listByPost(postId: string): PostClaimRecord[] {
    return this.claims.filter((claim) => claim.postId === postId);
  }

  listByClaimant(claimantEmail: string): PostClaimRecord[] {
    return this.claims.filter((claim) => claim.claimantEmail === claimantEmail);
  }

  listByPosts(postIds: string[]): PostClaimRecord[] {
    const postIdSet = new Set(postIds);
    return this.claims.filter((claim) => postIdSet.has(claim.postId));
  }

  hasApprovedClaim(postId: string, claimantEmail: string): boolean {
    return this.claims.some(
      (claim) =>
        claim.postId === postId &&
        claim.claimantEmail === claimantEmail &&
        claim.status === "approved"
    );
  }

  findById(claimId: string): PostClaimRecord | null {
    return this.claims.find((claim) => claim.id === claimId) ?? null;
  }

  updateStatus(claimId: string, status: ClaimStatus): PostClaimRecord | null {
    const claim = this.findById(claimId);

    if (!claim) {
      return null;
    }

    claim.status = status;
    return claim;
  }

  isLocked(postId: string, claimantEmail: string): boolean {
    const key = `${postId}::${claimantEmail}`;
    const attempts = this.pruneRecentFailures(this.failedAttempts.get(key) ?? []);
    return attempts.length >= 3;
  }

  recordFailure(postId: string, claimantEmail: string): number {
    const key = `${postId}::${claimantEmail}`;
    const attempts = this.pruneRecentFailures(this.failedAttempts.get(key) ?? []);
    attempts.push(this.now());
    this.failedAttempts.set(key, attempts);
    return attempts.length;
  }

  resetFailures(postId: string, claimantEmail: string): void {
    const key = `${postId}::${claimantEmail}`;
    this.failedAttempts.delete(key);
  }

  clear(): void {
    this.claims.length = 0;
    this.failedAttempts.clear();
  }

  private pruneRecentFailures(timestamps: number[]): number[] {
    const windowMs = 24 * 60 * 60 * 1000;
    const cutoff = this.now() - windowMs;
    return timestamps.filter((time) => time >= cutoff);
  }
}

const sharedPostClaimStore = new InMemoryPostClaimStore();

export function getSharedPostClaimStore(): InMemoryPostClaimStore {
  return sharedPostClaimStore;
}

export function __clearPostClaimStoreForTests(): void {
  sharedPostClaimStore.clear();
}

export function __setPostClaimStoreNowForTests(now: NowFn): void {
  sharedPostClaimStore.setNow(now);
}

export function __resetPostClaimStoreNowForTests(): void {
  sharedPostClaimStore.resetNow();
}
