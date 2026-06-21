import sharp from "sharp";

export const IMAGE_SERVER_ERROR = {
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
  PROCESSING_FAILED: "PROCESSING_FAILED",
} as const;

type ImageServerError = (typeof IMAGE_SERVER_ERROR)[keyof typeof IMAGE_SERVER_ERROR];

type SupportedServerImageType = "image/jpeg" | "image/png" | "image/webp";

interface SharpLike {
  rotate(): SharpLike;
  jpeg(options: { quality: number; mozjpeg: boolean }): SharpLike;
  png(options: { compressionLevel: number }): SharpLike;
  webp(options: { quality: number }): SharpLike;
  toBuffer(): Promise<Buffer>;
}

type SharpFactory = (input: Buffer) => SharpLike;

interface SanitizeServerImageOptions {
  sharpFactory?: SharpFactory;
}

export type ServerImageSanitizeResult =
  | {
      ok: true;
      buffer: Buffer;
      contentType: SupportedServerImageType;
    }
  | {
      ok: false;
      reason: ImageServerError;
    };

const SUPPORTED_SERVER_IMAGE_TYPES: SupportedServerImageType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const defaultSharpFactory: SharpFactory = (input) => sharp(input) as unknown as SharpLike;

function isSupportedServerType(contentType: string): contentType is SupportedServerImageType {
  return SUPPORTED_SERVER_IMAGE_TYPES.includes(contentType as SupportedServerImageType);
}

export async function sanitizeImageBufferOnServer(
  input: Buffer,
  contentType: string,
  options?: SanitizeServerImageOptions
): Promise<ServerImageSanitizeResult> {
  if (!isSupportedServerType(contentType)) {
    return {
      ok: false,
      reason: IMAGE_SERVER_ERROR.UNSUPPORTED_TYPE,
    };
  }

  const sharpFactory = options?.sharpFactory ?? defaultSharpFactory;

  try {
    const pipeline = sharpFactory(input).rotate();

    if (contentType === "image/jpeg") {
      const output = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      return {
        ok: true,
        buffer: output,
        contentType,
      };
    }

    if (contentType === "image/png") {
      const output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      return {
        ok: true,
        buffer: output,
        contentType,
      };
    }

    const output = await pipeline.webp({ quality: 90 }).toBuffer();
    return {
      ok: true,
      buffer: output,
      contentType,
    };
  } catch {
    return {
      ok: false,
      reason: IMAGE_SERVER_ERROR.PROCESSING_FAILED,
    };
  }
}
