import { readAuthSessionToken, getSharedSessionStore } from "@/lib/auth/session";
import { ensureNotSuspended } from "@/lib/auth/moderation-guard";
import { SUPPORTED_IMAGE_TYPES } from "@/lib/image/client-image";
import {
  getSharedUploadUrlSigner,
  resetSharedUploadUrlSignerForTests,
  setSharedUploadUrlSignerForTests,
  UploadUrlSigner,
} from "@/lib/storage/upload-signer";

const UPLOAD_URL_EXPIRES_SECONDS = 600;

function buildInvalidRequestResponse(): Response {
  return Response.json(
    {
      success: false,
      reason: "invalid_request",
    },
    {
      status: 400,
    }
  );
}

function sanitizeFileName(fileName: string): string {
  const lastSegment = fileName.split(/[\\/]/).pop() ?? "image.jpg";
  const sanitized = lastSegment.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!sanitized) {
    return "image.jpg";
  }

  return sanitized;
}

function createObjectPath(email: string, fileName: string): string {
  return `posts/${email}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

export function __setUploadUrlSignerForTests(signer: UploadUrlSigner): void {
  setSharedUploadUrlSignerForTests(signer);
}

export function __resetUploadUrlSignerForTests(): void {
  resetSharedUploadUrlSignerForTests();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const token = readAuthSessionToken(request.headers.get("cookie"));

    if (!token) {
      return buildInvalidRequestResponse();
    }

    const email = getSharedSessionStore().getEmailByToken(token);

    if (!email) {
      return buildInvalidRequestResponse();
    }

    const suspended = ensureNotSuspended(email);

    if (suspended) {
      return suspended;
    }

    const body = await request.json();

    if (!body || typeof body.fileName !== "string" || typeof body.contentType !== "string") {
      return buildInvalidRequestResponse();
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(body.contentType)) {
      return buildInvalidRequestResponse();
    }

    const path = createObjectPath(email, body.fileName);
    const uploadUrl = await getSharedUploadUrlSigner().createUploadUrl({
      path,
      contentType: body.contentType,
      expiresInSeconds: UPLOAD_URL_EXPIRES_SECONDS,
    });

    return Response.json(
      {
        success: true,
        uploadUrl,
        path,
        expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
      },
      {
        status: 200,
      }
    );
  } catch {
    return buildInvalidRequestResponse();
  }
}
