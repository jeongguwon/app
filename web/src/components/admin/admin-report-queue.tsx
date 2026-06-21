"use client";

import { useCallback, useEffect, useState } from "react";

interface ReportRecord {
  id: string;
  postId: string;
  reporterEmail: string;
  reason: string;
  createdAt: string;
  authorEmail: string | null;
  moderation: {
    status: "active" | "suspended";
    warningCount: number;
    warnedAt: string | null;
    suspendedAt: string | null;
  } | null;
}

interface PostSummary {
  id: string;
  title: string;
  status: string;
}

interface LifecycleResult {
  hiddenCount: number;
  deletedCount: number;
  purgedMessageCount: number;
  purgedNotificationCount: number;
}

interface ModerationLogRecord {
  id: string;
  action: "hide" | "delete" | "warn" | "suspend" | "unsuspend";
  postId: string;
  targetEmail: string;
  actorEmail: string;
  createdAt: string;
}

type ModerationFilter = "all" | "active" | "suspended";
type WarningFilter = "all" | "0" | "1+" | "3+";

const REASON_LABEL: Record<string, string> = {
  false_information: "허위 정보",
  inappropriate_photo: "부적절 사진",
  privacy_exposure: "개인정보 노출",
  abuse: "욕설",
  other: "기타",
};

const ACTION_LABEL: Record<string, string> = {
  hide: "숨김 처리",
  delete: "삭제 처리",
  warn: "경고 처리",
  suspend: "사용자 정지",
  unsuspend: "정지 해제",
};

export function AdminReportQueue() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [postTitles, setPostTitles] = useState<Record<string, PostSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isRunningLifecycle, setIsRunningLifecycle] = useState(false);
  const [lifecycleResult, setLifecycleResult] = useState<LifecycleResult | null>(null);
  const [moderationLogs, setModerationLogs] = useState<ModerationLogRecord[]>([]);
  const [moderationFilter, setModerationFilter] = useState<ModerationFilter>("all");
  const [warningFilter, setWarningFilter] = useState<WarningFilter>("all");

  const loadReports = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reports");

      if (response.status === 403 || response.status === 401) {
        setErrorMessage("관리자 권한이 필요합니다.");
        return;
      }

      if (!response.ok) {
        setErrorMessage("신고 목록을 불러오지 못했습니다.");
        return;
      }

      const body = (await response.json()) as {
        success: boolean;
        reports: ReportRecord[];
      };

      setReports(body.reports);
    } catch {
      setErrorMessage("신고 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadModerationLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/moderation-logs");

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as {
        success: boolean;
        logs: ModerationLogRecord[];
      };

      if (body.success) {
        setModerationLogs(body.logs);
      }
    } catch {
      // ignore fetch failure for moderation logs
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadReports();
    void loadModerationLogs();
  }, [loadReports, loadModerationLogs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fetchPostTitle = useCallback(async (postId: string) => {
    if (postTitles[postId]) {
      return;
    }

    try {
      const response = await fetch(`/api/posts/${postId}`);

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as {
        success: boolean;
        post: PostSummary;
      };

      if (body.success) {
        setPostTitles((prev) => ({ ...prev, [postId]: body.post }));
      }
    } catch {
      // ignore fetch failure for post title
    }
  }, [postTitles]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const uniquePostIds = Array.from(new Set(reports.map((report) => report.postId)));

    for (const postId of uniquePostIds) {
      void fetchPostTitle(postId);
    }
  }, [reports, fetchPostTitle]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePostAction = async (
    postId: string,
    action: "hide" | "delete" | "warn" | "suspend" | "unsuspend"
  ) => {
    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const response = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        setErrorMessage("처리에 실패했습니다.");
        return;
      }

      const body = (await response.json()) as {
        success: boolean;
        moderation?: {
          status: "active" | "suspended";
          warningCount: number;
        };
      };

      const moderationSummary = body.moderation
        ? ` (경고 ${body.moderation.warningCount}회, 상태 ${body.moderation.status === "suspended" ? "정지" : "정상"})`
        : "";

      setInfoMessage(ACTION_LABEL[action] + "가 완료되었습니다." + moderationSummary);
      await loadReports();
    } catch {
      setErrorMessage("처리에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleLifecycleRun = async () => {
    setInfoMessage(null);
    setErrorMessage(null);
    setIsRunningLifecycle(true);

    try {
      const response = await fetch("/api/admin/posts/lifecycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.status === 403 || response.status === 401) {
        setErrorMessage("관리자 권한이 필요합니다.");
        return;
      }

      if (!response.ok) {
        setErrorMessage("정리 작업을 실행하지 못했습니다.");
        return;
      }

      const body = (await response.json()) as {
        success: boolean;
        result: LifecycleResult;
      };

      if (!body.success) {
        setErrorMessage("정리 작업을 실행하지 못했습니다.");
        return;
      }

      setLifecycleResult(body.result);
      setInfoMessage("정리 작업을 실행했습니다.");
      await loadReports();
    } catch {
      setErrorMessage("정리 작업을 실행하지 못했습니다.");
    } finally {
      setIsRunningLifecycle(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatTimelineDate = (iso: string | null) => (iso ? formatDate(iso) : "- 없음");

  const filteredReports = reports.filter((report) => {
    const moderationStatus = report.moderation?.status ?? "active";
    const warningCount = report.moderation?.warningCount ?? 0;

    const statusMatched = moderationFilter === "all" || moderationStatus === moderationFilter;
    const warningMatched =
      warningFilter === "all" ||
      (warningFilter === "0" && warningCount === 0) ||
      (warningFilter === "1+" && warningCount >= 1) ||
      (warningFilter === "3+" && warningCount >= 3);

    return statusMatched && warningMatched;
  });

  if (isLoading) {
    return <p className="text-sm text-zinc-600">신고 목록을 불러오는 중입니다...</p>;
  }

  if (errorMessage && reports.length === 0) {
    return <p className="text-sm text-red-600">{errorMessage}</p>;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">신고 큐</h1>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {infoMessage ? <p className="text-sm text-emerald-700">{infoMessage}</p> : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-900">자동 정리 실행</h2>
            <p className="text-xs text-zinc-500">
              반환 완료 30일 경과 글 숨김, 숨김 60일 경과 글 삭제, 메시지와 알림 90일 만료 정리를 수동 실행합니다.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
            disabled={isRunningLifecycle || isMutating}
            onClick={() => void handleLifecycleRun()}
          >
            {isRunningLifecycle ? "실행 중..." : "정리 작업 실행"}
          </button>
        </div>

        {lifecycleResult ? (
          <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-xs text-zinc-500">숨김 전환</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900">{lifecycleResult.hiddenCount}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-xs text-zinc-500">삭제 전환</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900">{lifecycleResult.deletedCount}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-xs text-zinc-500">삭제된 메시지</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900">{lifecycleResult.purgedMessageCount}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-xs text-zinc-500">삭제된 알림</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900">{lifecycleResult.purgedNotificationCount}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900">최근 제재 로그</h2>
          <p className="text-xs text-zinc-500">가장 최근 관리자 조치 5건을 보여줍니다.</p>
        </div>
        {moderationLogs.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">표시할 제재 로그가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {moderationLogs.slice(0, 5).map((log) => (
              <li key={log.id} className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                <span className="font-medium text-zinc-900">{ACTION_LABEL[log.action]}</span>
                <span> · 대상 {log.targetEmail}</span>
                <span> · 관리자 {log.actorEmail}</span>
                <span> · {formatDate(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-zinc-500">
            상태 필터
            <select
              value={moderationFilter}
              onChange={(event) => setModerationFilter(event.target.value as ModerationFilter)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="all">전체</option>
              <option value="active">정상</option>
              <option value="suspended">정지</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-zinc-500">
            경고 횟수 필터
            <select
              value={warningFilter}
              onChange={(event) => setWarningFilter(event.target.value as WarningFilter)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="all">전체</option>
              <option value="0">0회</option>
              <option value="1+">1회 이상</option>
              <option value="3+">3회 이상</option>
            </select>
          </label>
        </div>
      </section>

      {filteredReports.length === 0 ? (
        <p className="text-sm text-zinc-500">처리할 신고가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {filteredReports.map((report) => {
            const post = postTitles[report.postId];
            const isSuspended = report.moderation?.status === "suspended";

            return (
              <li
                key={report.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {post ? (
                        <a
                          href={`/posts/${report.postId}`}
                          className="underline hover:no-underline"
                        >
                          {post.title}
                        </a>
                      ) : (
                        <span className="text-zinc-500">게시글 #{report.postId.slice(0, 8)}</span>
                      )}
                      {post ? (
                        <span className="ml-2 text-xs text-zinc-500">({post.status})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-zinc-600">
                      신고 사유: {REASON_LABEL[report.reason] ?? report.reason}
                    </p>
                    <p className="text-xs text-zinc-500">
                      신고자: {report.reporterEmail}
                    </p>
                    <p className="text-xs text-zinc-500">
                      작성자: {report.authorEmail ?? "알 수 없음"}
                    </p>
                    {report.moderation ? (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500">
                          제재 이력: 경고 {report.moderation.warningCount}회 / 상태 {report.moderation.status === "suspended" ? "정지" : "정상"}
                        </p>
                        <p className="text-xs text-zinc-400">
                          마지막 경고 시각: {formatTimelineDate(report.moderation.warnedAt)}
                        </p>
                        <p className="text-xs text-zinc-400">
                          마지막 정지 시각: {formatTimelineDate(report.moderation.suspendedAt)}
                        </p>
                      </div>
                    ) : null}
                    <p className="text-xs text-zinc-400">{formatDate(report.createdAt)}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-60"
                      disabled={isMutating}
                      onClick={() => void handlePostAction(report.postId, "warn")}
                    >
                      경고
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-60"
                      disabled={isMutating}
                      onClick={() => void handlePostAction(report.postId, "hide")}
                    >
                      숨김
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-500 px-3 py-1.5 text-xs font-medium text-red-800 disabled:opacity-60"
                      disabled={isMutating}
                      onClick={() => void handlePostAction(report.postId, "suspend")}
                    >
                      정지
                    </button>
                    {isSuspended ? (
                      <button
                        type="button"
                        className="rounded-md border border-emerald-400 px-3 py-1.5 text-xs font-medium text-emerald-700 disabled:opacity-60"
                        disabled={isMutating}
                        onClick={() => void handlePostAction(report.postId, "unsuspend")}
                      >
                        해제
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60"
                      disabled={isMutating}
                      onClick={() => void handlePostAction(report.postId, "delete")}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
