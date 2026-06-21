import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyPage } from "@/components/me/my-page";

describe("MyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders my posts and match sections", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          posts: [
            {
              id: "post-1",
              type: "lost",
              title: "내 지갑",
              category: "지갑/카드",
              location: "도서관",
              status: "active",
              createdAt: "2026-06-20T10:00:00.000Z",
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          attemptedClaims: [
            {
              id: "claim-1",
              path: "finder",
              status: "pending",
              claimantEmail: "me@school.ac.kr",
              createdAt: "2026-06-20T11:00:00.000Z",
              post: {
                id: "post-2",
                title: "남의 분실물",
                status: "active",
                type: "lost",
              },
            },
          ],
          receivedClaims: [
            {
              id: "claim-2",
              path: "finder",
              status: "approved",
              claimantEmail: "finder@school.ac.kr",
              createdAt: "2026-06-20T12:00:00.000Z",
              post: {
                id: "post-1",
                title: "내 지갑",
                status: "claiming",
                type: "lost",
              },
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            notifications: [
              {
                id: "notification-1",
                type: "message_received",
                title: "새 메시지가 도착했습니다",
                body: "클레이머 메시지를 확인해 주세요.",
                postId: "post-1",
                createdAt: "2026-06-20T13:00:00.000Z",
              },
            ],
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          setting: {
            enabled: true,
            updatedAt: "2026-06-20T13:00:00.000Z",
          },
        }),
      } as Response);

    render(<MyPage />);

    expect(await screen.findByText("내 게시글")).toBeInTheDocument();
    expect(screen.getAllByText("내 지갑")).toHaveLength(2);
    expect(screen.getByText("진행 중 매칭")).toBeInTheDocument();
    expect(screen.getByText("내가 시도한 클레임")).toBeInTheDocument();
    expect(screen.getByText("남의 분실물")).toBeInTheDocument();
    expect(screen.getByText("내가 받은 요청")).toBeInTheDocument();
    expect(screen.getByText("요청자: finder@school.ac.kr")).toBeInTheDocument();
    expect(screen.getByText("알림함")).toBeInTheDocument();
    expect(screen.getByText("현재 상태: 켜짐")).toBeInTheDocument();
    expect(screen.getByText("새 메시지가 도착했습니다")).toBeInTheDocument();
  });

  it("filters my posts by tab while keeping match sections visible", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          posts: [
            {
              id: "post-1",
              type: "lost",
              title: "등록된 글",
              category: "기타",
              location: "도서관",
              status: "active",
              createdAt: "2026-06-20T10:00:00.000Z",
            },
            {
              id: "post-2",
              type: "found",
              title: "반환된 글",
              category: "전자기기",
              location: "강당",
              status: "returned",
              createdAt: "2026-06-20T10:00:00.000Z",
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, attemptedClaims: [], receivedClaims: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, notifications: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          setting: {
            enabled: true,
            updatedAt: "2026-06-20T10:00:00.000Z",
          },
        }),
      } as Response);

    render(<MyPage />);

    expect(await screen.findByText("등록된 글")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "반환 완료" }));

    expect(screen.getByText("반환된 글")).toBeInTheDocument();
    expect(screen.queryByText("등록된 글")).not.toBeInTheDocument();
    expect(screen.getByText("진행 중 매칭")).toBeInTheDocument();
  });

  it("toggles notification settings", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, posts: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, attemptedClaims: [], receivedClaims: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, notifications: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          setting: {
            enabled: true,
            updatedAt: "2026-06-20T10:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          setting: {
            enabled: false,
            updatedAt: "2026-06-20T11:00:00.000Z",
          },
        }),
      } as Response);

    render(<MyPage />);

    expect(await screen.findByText("현재 상태: 켜짐")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "알림 끄기" }));

    expect(await screen.findByText("현재 상태: 꺼짐")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/me/notification-settings",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("shows login button when unauthenticated", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, reason: "unauthenticated" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, reason: "unauthenticated" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, reason: "unauthenticated" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, reason: "unauthenticated" }),
      } as Response);

    render(<MyPage />);

    expect(await screen.findByText("로그인이 필요합니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하러 가기" })).toHaveAttribute("href", "/login");
  });
});
