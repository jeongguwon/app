import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminReportQueue } from "@/components/admin/admin-report-queue";

function createReportFixture(moderationStatus: "active" | "suspended") {
  return {
    id: "report-1",
    postId: "post-1",
    reporterEmail: "r1@school.ac.kr",
    reason: "abuse",
    createdAt: "2026-06-20T10:00:00.000Z",
    authorEmail: "author@school.ac.kr",
    moderation: {
      status: moderationStatus,
      warningCount: moderationStatus === "suspended" ? 2 : 0,
      warnedAt: moderationStatus === "suspended" ? "2026-06-19T09:00:00.000Z" : null,
      suspendedAt: moderationStatus === "suspended" ? "2026-06-19T10:00:00.000Z" : null,
    },
  };
}

function createReportFixtureWithWarningCount(
  id: string,
  postId: string,
  moderationStatus: "active" | "suspended",
  warningCount: number
) {
  return {
    id,
    postId,
    reporterEmail: `${id}@school.ac.kr`,
    reason: "abuse",
    createdAt: "2026-06-20T10:00:00.000Z",
    authorEmail: `${postId}@school.ac.kr`,
    moderation: {
      status: moderationStatus,
      warningCount,
      warnedAt: warningCount > 0 ? "2026-06-19T09:00:00.000Z" : null,
      suspendedAt: moderationStatus === "suspended" ? "2026-06-19T10:00:00.000Z" : null,
    },
  };
}

function mockQueueFetch(action: "warn" | "unsuspend") {
  let reportFetchCount = 0;

  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url === "/api/admin/reports") {
      reportFetchCount += 1;

      if (reportFetchCount === 1) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            reports: [createReportFixture("suspended")],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ success: true, reports: [] }),
      } as Response;
    }

    if (url === "/api/admin/moderation-logs") {
      return {
        ok: true,
        json: async () => ({ success: true, logs: [] }),
      } as Response;
    }

    if (url === "/api/posts/post-1") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          post: { id: "post-1", title: "제목", status: "active" },
        }),
      } as Response;
    }

    if (url === "/api/admin/posts/post-1") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          post: { id: "post-1", status: "active" },
          moderation: {
            email: "author@school.ac.kr",
            status: action === "warn" ? "active" : "active",
            warningCount: action === "warn" ? 1 : 2,
          },
          action,
        }),
      } as Response;
    }

    throw new Error(`Unhandled fetch call: ${url}`);
  });
}

describe("AdminReportQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("runs lifecycle maintenance and shows summary counts", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, reports: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, logs: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            hiddenCount: 2,
            deletedCount: 1,
            purgedMessageCount: 3,
            purgedNotificationCount: 4,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, reports: [] }),
      } as Response);

    render(<AdminReportQueue />);

    expect(await screen.findByText("신고 큐")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "정리 작업 실행" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/posts/lifecycle",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText("정리 작업을 실행했습니다.")).toBeInTheDocument();
    expect(screen.getByText("숨김 전환")).toBeInTheDocument();
    expect(screen.getByText("삭제된 알림")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("sends warn action from report item", async () => {
    mockQueueFetch("warn");

    render(<AdminReportQueue />);

    expect(await screen.findByText("신고 큐")).toBeInTheDocument();
    expect(screen.getByText("제재 이력: 경고 2회 / 상태 정지")).toBeInTheDocument();
    expect(screen.getByText(/마지막 경고 시각:/)).toBeInTheDocument();
    expect(screen.getByText(/마지막 정지 시각:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "경고" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/posts/post-1",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    expect(screen.queryByRole("button", { name: "해제" })).not.toBeInTheDocument();
    expect(await screen.findByText(/경고 처리가 완료되었습니다/)).toBeInTheDocument();
  });

  it("sends unsuspend action from report item", async () => {
    mockQueueFetch("unsuspend");

    render(<AdminReportQueue />);

    expect(await screen.findByText("신고 큐")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "해제" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/posts/post-1",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("hides unsuspend button for active moderation status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        reports: [createReportFixture("active")],
      }),
    } as Response);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, logs: [] }),
    } as Response);

    render(<AdminReportQueue />);

    expect(await screen.findByText("신고 큐")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "해제" })).not.toBeInTheDocument();
  });

  it("filters reports by moderation status and warning count", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/admin/reports") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            reports: [
              createReportFixtureWithWarningCount("report-a", "post-a", "active", 0),
              createReportFixtureWithWarningCount("report-b", "post-b", "active", 1),
              createReportFixtureWithWarningCount("report-c", "post-c", "suspended", 3),
            ],
          }),
        } as Response;
      }

      if (url === "/api/admin/moderation-logs") {
        return {
          ok: true,
          json: async () => ({ success: true, logs: [] }),
        } as Response;
      }

      if (url === "/api/posts/post-a") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            post: { id: "post-a", title: "A 제목", status: "active" },
          }),
        } as Response;
      }

      if (url === "/api/posts/post-b") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            post: { id: "post-b", title: "B 제목", status: "active" },
          }),
        } as Response;
      }

      if (url === "/api/posts/post-c") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            post: { id: "post-c", title: "C 제목", status: "active" },
          }),
        } as Response;
      }

      throw new Error(`Unhandled fetch call: ${url}`);
    });

    render(<AdminReportQueue />);

    expect(await screen.findByText("신고 큐")).toBeInTheDocument();
    expect(screen.getByText("신고자: report-a@school.ac.kr")).toBeInTheDocument();
    expect(screen.getByText("신고자: report-b@school.ac.kr")).toBeInTheDocument();
    expect(screen.getByText("신고자: report-c@school.ac.kr")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("상태 필터"), { target: { value: "suspended" } });

    await waitFor(() => {
      expect(screen.queryByText("신고자: report-a@school.ac.kr")).not.toBeInTheDocument();
      expect(screen.queryByText("신고자: report-b@school.ac.kr")).not.toBeInTheDocument();
      expect(screen.getByText("신고자: report-c@school.ac.kr")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("상태 필터"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("경고 횟수 필터"), { target: { value: "1+" } });

    await waitFor(() => {
      expect(screen.queryByText("신고자: report-a@school.ac.kr")).not.toBeInTheDocument();
      expect(screen.getByText("신고자: report-b@school.ac.kr")).toBeInTheDocument();
      expect(screen.getByText("신고자: report-c@school.ac.kr")).toBeInTheDocument();
    });
  });
});