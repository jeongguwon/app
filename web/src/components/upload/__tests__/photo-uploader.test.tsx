import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMAGE_PREPARE_ERROR } from "@/lib/image/client-image";

import { PhotoUploader } from "@/components/upload/photo-uploader";

const prepareImageForUploadMock = vi.fn();

vi.mock("@/lib/image/client-image", async () => {
  const original = await vi.importActual("@/lib/image/client-image");

  return {
    ...original,
    prepareImageForUpload: (file: File) => prepareImageForUploadMock(file),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PhotoUploader", () => {
  it("processes files and returns prepared files", async () => {
    const onChange = vi.fn();
    const fileA = new File([new Uint8Array(100)], "a.jpg", { type: "image/jpeg" });
    const fileB = new File([new Uint8Array(100)], "b.png", { type: "image/png" });

    prepareImageForUploadMock
      .mockResolvedValueOnce({ ok: true, file: fileA })
      .mockResolvedValueOnce({ ok: true, file: fileB });

    render(<PhotoUploader onChange={onChange} />);

    const input = screen.getByLabelText("사진 업로드") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fileA, fileB] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([fileA, fileB]);
    });

    expect(screen.getByText("2/4장 선택됨")).toBeInTheDocument();
  });

  it("shows validation message when preparation fails", async () => {
    const onChange = vi.fn();
    const badFile = new File([new Uint8Array(100)], "bad.gif", { type: "image/gif" });

    prepareImageForUploadMock.mockResolvedValueOnce({
      ok: false,
      reason: IMAGE_PREPARE_ERROR.UNSUPPORTED_TYPE,
    });

    render(<PhotoUploader onChange={onChange} />);

    const input = screen.getByLabelText("사진 업로드") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByText("지원하지 않는 이미지 형식입니다."))
        .toBeInTheDocument();
    });

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("truncates to max 4 files", async () => {
    const onChange = vi.fn();
    const files = Array.from({ length: 5 }, (_, i) =>
      new File([new Uint8Array(100)], `${i}.jpg`, { type: "image/jpeg" })
    );

    for (let i = 0; i < 4; i += 1) {
      prepareImageForUploadMock.mockResolvedValueOnce({ ok: true, file: files[i] });
    }

    render(<PhotoUploader onChange={onChange} />);

    const input = screen.getByLabelText("사진 업로드") as HTMLInputElement;
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(files.slice(0, 4));
    });
    expect(prepareImageForUploadMock).toHaveBeenCalledTimes(4);
  });
});
