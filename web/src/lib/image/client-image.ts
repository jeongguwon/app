import imageCompression from "browser-image-compression";

export const MAX_IMAGE_COUNT = 4;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const IMAGE_PREPARE_ERROR = {
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  PROCESSING_FAILED: "PROCESSING_FAILED",
} as const;

type ImagePrepareError =
  (typeof IMAGE_PREPARE_ERROR)[keyof typeof IMAGE_PREPARE_ERROR];

export type ImageValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: ImagePrepareError;
    };

export type ImagePrepareResult =
  | {
      ok: true;
      file: File;
    }
  | {
      ok: false;
      reason: ImagePrepareError;
    };

export function validateImageFile(file: File): ImageValidationResult {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
    return {
      ok: false,
      reason: IMAGE_PREPARE_ERROR.UNSUPPORTED_TYPE,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      ok: false,
      reason: IMAGE_PREPARE_ERROR.FILE_TOO_LARGE,
    };
  }

  return { ok: true };
}

export async function prepareImageForUpload(file: File): Promise<ImagePrepareResult> {
  const validationResult = validateImageFile(file);

  if (!validationResult.ok) {
    return validationResult;
  }

  try {
    const processedFile = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 5,
      useWebWorker: true,
      preserveExif: false,
      fileType: file.type,
      initialQuality: 0.9,
    });

    return {
      ok: true,
      file: processedFile,
    };
  } catch {
    return {
      ok: false,
      reason: IMAGE_PREPARE_ERROR.PROCESSING_FAILED,
    };
  }
}

export function getImagePrepareErrorMessage(reason: ImagePrepareError): string {
  if (reason === IMAGE_PREPARE_ERROR.UNSUPPORTED_TYPE) {
    return "지원하지 않는 이미지 형식입니다.";
  }

  if (reason === IMAGE_PREPARE_ERROR.FILE_TOO_LARGE) {
    return "이미지 파일은 5MB 이하만 업로드할 수 있습니다.";
  }

  return "이미지 처리 중 오류가 발생했습니다. 다시 시도해 주세요.";
}
