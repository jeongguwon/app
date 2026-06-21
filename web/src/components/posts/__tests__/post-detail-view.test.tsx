import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostDetailView } from "@/components/posts/post-detail-view";

describe("PostDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    window.history.replaceState({}, "", "/posts/post-1");
  });

  it("shows non-author action buttons and hides private fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        viewer: { isAuthor: false, canSendMessage: false },
        post: {
          id: "post-1",
          authorEmail: "writer@school.ac.kr",
          type: "found",
          title: "검정 텀블러 습득",
          category: "기타",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
          description: "하단에 작은 스크래치",
          photoPaths: ["posts/p1.jpg"],
          status: "active",
          storagePlace: "행정실",
          createdAt: "2026-06-13T12:00:00.000Z",
        },
      }),
    } as Response);

    render(<PostDetailView postId="post-1" />);

    expect(await screen.findByRole("heading", { name: "검정 텀블러 습득" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 물건 같아요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이거 제가 주웠어요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "신고" })).toBeInTheDocument();
    expect(screen.queryByText(/비공개 식별 질문:/)).not.toBeInTheDocument();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        claim: {
          id: "claim-1",
          postId: "post-1",
          claimantEmail: "owner@school.ac.kr",
          path: "owner",
          status: "approved",
          createdAt: "2026-06-13T12:10:00.000Z",
        },
        post: {
          id: "post-1",
          authorEmail: "writer@school.ac.kr",
          type: "found",
          title: "검정 텀블러 습득",
          category: "기타",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
          description: "하단에 작은 스크래치",
          photoPaths: ["posts/p1.jpg"],
          status: "claiming",
          storagePlace: "행정실",
          createdAt: "2026-06-13T12:00:00.000Z",
        },
      }),
    } as Response);

    fireEvent.click(screen.getByRole("button", { name: "내 물건 같아요" }));
    fireEvent.change(screen.getByLabelText("비공개 식별 답변 입력"), {
      target: { value: "A-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "검증 요청" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts/post-1/claims",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText("검증이 완료되어 확인 단계로 전환되었습니다.")).toBeInTheDocument();
  });

  it("shows author actions and can mark post returned", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: true, canSendMessage: false },
          post: {
            id: "post-2",
            authorEmail: "writer@school.ac.kr",
            type: "found",
            title: "에어팟 습득",
            category: "전자기기",
            location: "강당",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "active",
            storagePlace: "학생회실",
            secretQuestion: "케이스 각인은?",
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          claims: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          post: {
            id: "post-2",
            authorEmail: "writer@school.ac.kr",
            type: "found",
            title: "에어팟 습득",
            category: "전자기기",
            location: "강당",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "returned",
            storagePlace: "학생회실",
            secretQuestion: "케이스 각인은?",
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response);

    render(<PostDetailView postId="post-2" />);

    expect(await screen.findByRole("button", { name: "완료 처리" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/me");
    expect(screen.getByText("비공개 식별 질문: 케이스 각인은?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "완료 처리" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts/post-2",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    expect(await screen.findByText("반환 완료로 상태를 변경했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/me");
  });

  it("allows author to edit and save post", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: true, canSendMessage: false },
          post: {
            id: "post-3",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "지갑 분실",
            category: "지갑/카드",
            location: "도서관",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: "검정색 반지갑",
            photoPaths: [],
            status: "active",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          claims: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          post: {
            id: "post-3",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "지갑 분실(수정)",
            category: "지갑/카드",
            location: "도서관",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: "학생증 포함",
            photoPaths: [],
            status: "active",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response);

    render(<PostDetailView postId="post-3" />);

    expect(await screen.findByRole("button", { name: "수정" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "지갑 분실(수정)" } });
    fireEvent.change(screen.getByLabelText("설명"), { target: { value: "학생증 포함" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts/post-3",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    expect(await screen.findByText("게시글을 수정했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "지갑 분실(수정)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/me");
  });

  it("allows author to delete post and shows back-to-home button", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: true, canSendMessage: false },
          post: {
            id: "post-9",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "우산 분실",
            category: "기타",
            location: "정문",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "active",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, claims: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, messages: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          post: {
            id: "post-9",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "우산 분실",
            category: "기타",
            location: "정문",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "deleted",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response);

    render(<PostDetailView postId="post-9" />);

    expect(await screen.findByRole("button", { name: "삭제" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts/post-9",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    expect(await screen.findByText("게시글이 삭제 처리되었습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/me");
  });

  it("allows author to approve pending finder claim", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: true, canSendMessage: false },
          post: {
            id: "post-5",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "파우치 분실",
            category: "기타",
            location: "도서관",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "active",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          claims: [
            {
              id: "claim-5",
              postId: "post-5",
              claimantEmail: "finder@school.ac.kr",
              path: "finder",
              status: "pending",
              createdAt: "2026-06-13T12:30:00.000Z",
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          claim: {
            id: "claim-5",
            postId: "post-5",
            claimantEmail: "finder@school.ac.kr",
            path: "finder",
            status: "approved",
            createdAt: "2026-06-13T12:30:00.000Z",
          },
          post: {
            id: "post-5",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "파우치 분실",
            category: "기타",
            location: "도서관",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "claiming",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response);

    render(<PostDetailView postId="post-5" />);

    expect(await screen.findByText("대기 중 습득 확인 요청")).toBeInTheDocument();
    expect(screen.getByText("요청자: finder@school.ac.kr")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts/post-5/claims/claim-5",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    expect(await screen.findByText("요청을 승인했습니다.")).toBeInTheDocument();
  });

  it("submits report for non-author with selected reason", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: false, canSendMessage: false },
          post: {
            id: "post-4",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "분실 노트",
            category: "문구",
            location: "도서관",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "active",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          report: {
            id: "report-1",
            postId: "post-4",
            reporterEmail: "reporter@school.ac.kr",
            reason: "other",
            createdAt: "2026-06-13T13:00:00.000Z",
          },
        }),
      } as Response);

    render(<PostDetailView postId="post-4" />);

    expect(await screen.findByRole("button", { name: "신고" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "신고" }));
    fireEvent.change(screen.getByLabelText("신고 사유"), {
      target: { value: "privacy_exposure" },
    });
    fireEvent.click(screen.getByRole("button", { name: "신고 접수" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts/post-4/reports",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "privacy_exposure" }),
        })
      );
    });

    expect(await screen.findByText("신고가 접수되었습니다.")).toBeInTheDocument();
  });

  it("shows author message list", async () => {
    window.history.replaceState({}, "", "/posts/post-6?sender=finder@school.ac.kr&q=%ED%95%99%EC%83%9D%ED%9A%8C%EC%8B%A4");

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: true, canSendMessage: false },
          post: {
            id: "post-6",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "가방 분실",
            category: "기타",
            location: "강당",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "claiming",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, claims: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [
            {
              id: "msg-2",
              postId: "post-6",
              senderEmail: "owner@school.ac.kr",
              content: "먼저 보낸 메시지",
              createdAt: "2026-06-13T12:00:00.000Z",
            },
            {
              id: "msg-1",
              postId: "post-6",
              senderEmail: "finder@school.ac.kr",
              content: "학생회실에서 학생회실로 전달드릴게요.",
              createdAt: "2026-06-13T13:00:00.000Z",
            },
          ],
        }),
      } as Response);

    render(<PostDetailView postId="post-6" />);

    expect(await screen.findByText("클레이머 메시지")).toBeInTheDocument();
    expect(screen.getByLabelText("발신자 필터")).toHaveValue("finder@school.ac.kr");
    expect(screen.getByLabelText("메시지 검색")).toHaveValue("학생회실");
    expect(screen.getByText("보낸 사람: finder@school.ac.kr")).toBeInTheDocument();
    expect(screen.getAllByText(/전송 시각:/)).toHaveLength(1);
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "학생회실에서 학생회실로 전달드릴게요."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("먼저 보낸 메시지")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("발신자 필터"), {
      target: { value: "owner@school.ac.kr" },
    });

    expect(screen.queryByText("학생회실에서 학생회실로 전달드릴게요.")).not.toBeInTheDocument();
    expect(screen.queryByText("먼저 보낸 메시지")).not.toBeInTheDocument();
    expect(screen.getByText("조건에 맞는 메시지가 없습니다.")).toBeInTheDocument();
    expect(window.location.search).toContain("sender=owner%40school.ac.kr");
    expect(window.location.search).toContain("q=%ED%95%99%EC%83%9D%ED%9A%8C%EC%8B%A4");

    fireEvent.change(screen.getByLabelText("메시지 검색"), {
      target: { value: "" },
    });

    await waitFor(() => {
      expect(screen.getByText("먼저 보낸 메시지")).toBeInTheDocument();
      expect(window.location.search).toContain("sender=owner%40school.ac.kr");
      expect(window.location.search).not.toContain("q=");
    });

    window.history.replaceState({}, "", "/posts/post-6?sender=finder@school.ac.kr&q=%ED%95%99%EC%83%9D%ED%9A%8C%EC%8B%A4");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(screen.getByLabelText("발신자 필터")).toHaveValue("finder@school.ac.kr");
      expect(screen.getByLabelText("메시지 검색")).toHaveValue("학생회실");
      expect(
        screen.getByText(
          (_, element) => element?.textContent === "학생회실에서 학생회실로 전달드릴게요."
        )
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("발신자 필터"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("메시지 검색"), {
      target: { value: "학생회실" },
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          (_, element) => element?.textContent === "학생회실에서 학생회실로 전달드릴게요."
        )
      ).toBeInTheDocument();
      expect(screen.queryByText("먼저 보낸 메시지")).not.toBeInTheDocument();
      expect(screen.getAllByText("학생회실", { selector: "mark" })).toHaveLength(2);
    });
  });

  it("allows approved claimant to send one message", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: false, canSendMessage: true },
          post: {
            id: "post-7",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "지갑 분실",
            category: "지갑/카드",
            location: "운동장",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "claiming",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: { id: "msg-7" } }),
      } as Response);

    render(<PostDetailView postId="post-7" />);

    expect(await screen.findByText("작성자에게 메시지 1회를 보낼 수 있습니다.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("작성자에게 보낼 메시지"), {
      target: { value: "학생회실로 갈게요." },
    });
    fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts/post-7/messages",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText("메시지를 전송했습니다.")).toBeInTheDocument();
  });

  it("normalizes invalid message filter query params", async () => {
    window.history.replaceState({}, "", "/posts/post-8?sender=not-an-email&q=%20%20%20");

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          viewer: { isAuthor: true, canSendMessage: false },
          post: {
            id: "post-8",
            authorEmail: "writer@school.ac.kr",
            type: "lost",
            title: "필터 복원 테스트",
            category: "기타",
            location: "도서관",
            eventAt: "2026-06-13T12:00:00.000Z",
            description: null,
            photoPaths: [],
            status: "claiming",
            storagePlace: null,
            createdAt: "2026-06-13T12:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, claims: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [
            {
              id: "msg-8",
              postId: "post-8",
              senderEmail: "finder@school.ac.kr",
              content: "메시지 복원 확인",
              createdAt: "2026-06-13T13:00:00.000Z",
            },
          ],
        }),
      } as Response);

    render(<PostDetailView postId="post-8" />);

    expect(await screen.findByText("클레이머 메시지")).toBeInTheDocument();
    expect(screen.getByLabelText("발신자 필터")).toHaveValue("all");
    expect(screen.getByLabelText("메시지 검색")).toHaveValue("");

    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
  });
});
