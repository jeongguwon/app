import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostCreateForm } from "@/components/posts/post-create-form";

const photoUploaderMock = vi.fn();

vi.mock("@/components/upload/photo-uploader", () => ({
  PhotoUploader: ({ onChange }: { onChange: (files: File[]) => void }) => (
    <button
      type="button"
      onClick={() => {
        const files = [new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" })];
        photoUploaderMock(files);
        onChange(files);
      }}
    >
      사진 선택
    </button>
  ),
}));

describe("PostCreateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("moves from step 1 to step 2", () => {
    render(<PostCreateForm />);

    expect(screen.getByText("등록 단계 1/2")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("습득물"));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText("등록 단계 2/2")).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toBeInTheDocument();
  });

  it("submits found post with required fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, post: { id: "post-1" } }),
    } as Response);

    render(<PostCreateForm />);

    fireEvent.click(screen.getByLabelText("습득물"));
    fireEvent.click(screen.getByRole("button", { name: "사진 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "교실에서 찾은 에어팟" } });
    fireEvent.change(screen.getByLabelText("카테고리"), { target: { value: "전자기기" } });
    fireEvent.change(screen.getByLabelText("장소"), { target: { value: "1-2 교실" } });
    fireEvent.change(screen.getByLabelText("일시"), { target: { value: "2026-06-13T12:00" } });
    fireEvent.change(screen.getByLabelText("보관 장소"), { target: { value: "행정실" } });
    fireEvent.change(screen.getByLabelText("비공개 식별 질문"), {
      target: { value: "케이스 각인 글자는?" },
    });
    fireEvent.change(screen.getByLabelText("비공개 식별 답변"), {
      target: { value: "Minsu" },
    });

    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/posts",
        expect.objectContaining({ method: "POST" })
      );
    });

    const payload = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(payload.type).toBe("found");
    expect(payload.storagePlace).toBe("행정실");
    expect(payload.secretQuestion).toBe("케이스 각인 글자는?");
    expect(payload.secretAnswer).toBe("Minsu");
    expect(payload.photoPaths).toEqual(["local://a.jpg"]);

    expect(screen.getByText("등록이 완료되었습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/me");
  });

  it("shows rate limit error message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, reason: "rate_limited" }),
    } as Response);

    render(<PostCreateForm />);

    fireEvent.click(screen.getByLabelText("분실물"));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "지갑 분실" } });
    fireEvent.change(screen.getByLabelText("카테고리"), { target: { value: "지갑/카드" } });
    fireEvent.change(screen.getByLabelText("장소"), { target: { value: "운동장" } });
    fireEvent.change(screen.getByLabelText("일시"), { target: { value: "2026-06-13T12:00" } });

    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(screen.getByText("등록 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요."))
        .toBeInTheDocument();
    });
  });

  it("shows forbidden item warning modal before submit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, post: { id: "post-2" } }),
    } as Response);

    render(<PostCreateForm />);

    fireEvent.click(screen.getByLabelText("습득물"));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "학생증 발견" } });
    fireEvent.change(screen.getByLabelText("카테고리"), { target: { value: "신분증" } });
    fireEvent.change(screen.getByLabelText("장소"), { target: { value: "도서관" } });
    fireEvent.change(screen.getByLabelText("일시"), { target: { value: "2026-06-13T12:00" } });
    fireEvent.change(screen.getByLabelText("보관 장소"), { target: { value: "행정실" } });
    fireEvent.change(screen.getByLabelText("비공개 식별 질문"), {
      target: { value: "이름은?" },
    });
    fireEvent.change(screen.getByLabelText("비공개 식별 답변"), {
      target: { value: "학생증 이름" },
    });

    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(screen.getByText("금지 물품은 행정실로 전달해 주세요.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "확인하고 등록" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
