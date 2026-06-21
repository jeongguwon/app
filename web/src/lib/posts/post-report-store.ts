export type ReportReason =
  | "false_information"
  | "inappropriate_photo"
  | "privacy_exposure"
  | "abuse"
  | "other";

export interface PostReportRecord {
  id: string;
  postId: string;
  reporterEmail: string;
  reason: ReportReason;
  createdAt: string;
}

type NowFn = () => number;

class InMemoryPostReportStore {
  private readonly reports: PostReportRecord[] = [];
  private now: NowFn = Date.now;

  setNow(now: NowFn): void {
    this.now = now;
  }

  resetNow(): void {
    this.now = Date.now;
  }

  hasReported(postId: string, reporterEmail: string): boolean {
    return this.reports.some(
      (report) => report.postId === postId && report.reporterEmail === reporterEmail
    );
  }

  create(postId: string, reporterEmail: string, reason: ReportReason): PostReportRecord {
    const report: PostReportRecord = {
      id: crypto.randomUUID(),
      postId,
      reporterEmail,
      reason,
      createdAt: new Date(this.now()).toISOString(),
    };

    this.reports.push(report);
    return report;
  }

  listAll(): PostReportRecord[] {
    return [...this.reports].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  }

  listByPost(postId: string): PostReportRecord[] {
    return this.reports.filter((report) => report.postId === postId);
  }

  clear(): void {
    this.reports.length = 0;
  }
}

const sharedPostReportStore = new InMemoryPostReportStore();

export function getSharedPostReportStore(): InMemoryPostReportStore {
  return sharedPostReportStore;
}

export function __clearPostReportStoreForTests(): void {
  sharedPostReportStore.clear();
}
