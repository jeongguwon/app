import { beforeEach, describe, expect, it, vi } from "vitest";

import imageCompression from "browser-image-compression";

import {
  IMAGE_PREPARE_ERROR,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  prepareImageForUpload,
  validateImageFile,
} from "@/lib/image/client-image";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateImageFile", () => {
  it("accepts supported file types under 5MB", () => {
    const file = new File([new Uint8Array(1024)], "photo.jpg", {
      type: "image/jpeg",
    });

    expect(validateImageFile(file)).toEqual({ ok: true });
  });

  it("rejects unsupported file type", () => {
    const file = new File([new Uint8Array(1024)], "file.gif", {
      type: "image/gif",
    });

    expect(validateImageFile(file)).toEqual({
      ok: false,
      reason: IMAGE_PREPARE_ERROR.UNSUPPORTED_TYPE,
    });
  });

  it("rejects files larger than 5MB", () => {
    const file = new File([new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)], "big.jpg", {
      type: "image/jpeg",
    });

    expect(validateImageFile(file)).toEqual({
      ok: false,
      reason: IMAGE_PREPARE_ERROR.FILE_TOO_LARGE,
    });
  });
});

describe("prepareImageForUpload", () => {
  it("resizes/compresses image with EXIF stripping options", async () => {
    const input = new File([new Uint8Array(1024)], "photo.jpg", {
      type: "image/jpeg",
    });
    const output = new File([new Uint8Array(512)], "photo.jpg", {
      type: "image/jpeg",
    });

    vi.mocked(imageCompression).mockResolvedValueOnce(output);

    const result = await prepareImageForUpload(input);

    expect(result).toEqual({ ok: true, file: output });
    expect(imageCompression).toHaveBeenCalledWith(input, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 5,
      useWebWorker: true,
      preserveExif: false,
      fileType: "image/jpeg",
      initialQuality: 0.9,
    });
  });

  it("returns validation error for unsupported files without compression", async () => {
    const input = new File([new Uint8Array(1024)], "photo.gif", {
      type: "image/gif",
    });

    const result = await prepareImageForUpload(input);

    expect(result).toEqual({
      ok: false,
      reason: IMAGE_PREPARE_ERROR.UNSUPPORTED_TYPE,
    });
    expect(imageCompression).not.toHaveBeenCalled();
  });
});

describe("constants", () => {
  it("keeps upload constraints aligned with PRD", () => {
    expect(MAX_IMAGE_COUNT).toBe(4);
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(SUPPORTED_IMAGE_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });
});
