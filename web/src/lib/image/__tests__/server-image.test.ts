import { describe, expect, it, vi } from "vitest";

import {
  IMAGE_SERVER_ERROR,
  sanitizeImageBufferOnServer,
} from "@/lib/image/server-image";

describe("sanitizeImageBufferOnServer", () => {
  it("uses jpeg pipeline and strips metadata by re-encoding", async () => {
    const output = Buffer.from("jpeg-output");
    const rotate = vi.fn();
    const jpeg = vi.fn();
    const png = vi.fn();
    const webp = vi.fn();
    const toBuffer = vi.fn().mockResolvedValue(output);

    const chain = {
      rotate,
      jpeg,
      png,
      webp,
      toBuffer,
    };

    rotate.mockReturnValue(chain);
    jpeg.mockReturnValue(chain);
    png.mockReturnValue(chain);
    webp.mockReturnValue(chain);

    const sharpFactory = vi.fn().mockReturnValue(chain);

    const input = Buffer.from("raw");
    const result = await sanitizeImageBufferOnServer(input, "image/jpeg", {
      sharpFactory,
    });

    expect(sharpFactory).toHaveBeenCalledWith(input);
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(jpeg).toHaveBeenCalledWith({ quality: 90, mozjpeg: true });
    expect(png).not.toHaveBeenCalled();
    expect(webp).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      buffer: output,
      contentType: "image/jpeg",
    });
  });

  it("uses png pipeline when content type is image/png", async () => {
    const output = Buffer.from("png-output");
    const rotate = vi.fn();
    const jpeg = vi.fn();
    const png = vi.fn();
    const webp = vi.fn();
    const toBuffer = vi.fn().mockResolvedValue(output);

    const chain = {
      rotate,
      jpeg,
      png,
      webp,
      toBuffer,
    };

    rotate.mockReturnValue(chain);
    jpeg.mockReturnValue(chain);
    png.mockReturnValue(chain);
    webp.mockReturnValue(chain);

    const sharpFactory = vi.fn().mockReturnValue(chain);

    const input = Buffer.from("raw");
    const result = await sanitizeImageBufferOnServer(input, "image/png", {
      sharpFactory,
    });

    expect(png).toHaveBeenCalledWith({ compressionLevel: 9 });
    expect(result).toEqual({
      ok: true,
      buffer: output,
      contentType: "image/png",
    });
  });

  it("rejects unsupported content type", async () => {
    const result = await sanitizeImageBufferOnServer(Buffer.from("raw"), "image/gif");

    expect(result).toEqual({
      ok: false,
      reason: IMAGE_SERVER_ERROR.UNSUPPORTED_TYPE,
    });
  });

  it("returns processing failed when sharp throws", async () => {
    const sharpFactory = vi.fn(() => {
      throw new Error("boom");
    });

    const result = await sanitizeImageBufferOnServer(Buffer.from("raw"), "image/jpeg", {
      sharpFactory,
    });

    expect(result).toEqual({
      ok: false,
      reason: IMAGE_SERVER_ERROR.PROCESSING_FAILED,
    });
  });
});
