import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { ensureNotSuspended } from "@/lib/auth/moderation-guard";
import { ReportReason, getSharedPostReportStore } from "@/lib/posts/post-report-store";
import { getSharedPostStore } from "@/lib/posts/post-store";

type RouteContext = {
  params: Promise<{ postId: string }>;
};

function invalidRequest(): Response {
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

function notFound(): Response {
  return Response.json(
    {
      success: false,
      reason: "not_found",
    },
    {
      status: 404,
    }
  );
}

function conflict(reason: string): Response {
  return Response.json(
    {
      success: false,
      reason,
    },
    {
      status: 409,
    }
  );
}

function resolveAuthenticatedEmail(request: Request): string | null {
  const token = readAuthSessionToken(request.headers.get("cookie"));

  if (!token) {
    return null;
  }

  return getSharedSessionStore().getEmailByToken(token);
}

function isReportReason(value: unknown): value is ReportReason {
  return (
    value === "false_information" ||
    value === "inappropriate_photo" ||
    value === "privacy_exposure" ||
    value === "abuse" ||
    value === "other"
  );
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const email = resolveAuthenticatedEmail(request);

  if (!email) {
    return invalidRequest();
  }

  const suspended = ensureNotSuspended(email);

  if (suspended) {
    return suspended;
  }

  const { postId } = await context.params;
  const post = getSharedPostStore().findById(postId);

  if (!post) {
    return notFound();
  }

  const body = await request.json();

  if (!body || !isReportReason(body.reason)) {
    return invalidRequest();
  }

  const reportStore = getSharedPostReportStore();

  if (reportStore.hasReported(postId, email)) {
    return conflict("already_reported");
  }

  const report = reportStore.create(postId, email, body.reason);

  return Response.json({
    success: true,
    report,
  });
}
