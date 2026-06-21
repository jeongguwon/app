import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { ensureNotSuspended } from "@/lib/auth/moderation-guard";
import { getSharedNotificationStore } from "@/lib/notifications/notification-store";
import { getSharedPostClaimStore } from "@/lib/posts/post-claim-store";
import { getSharedPostMessageStore } from "@/lib/posts/post-message-store";
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

function forbidden(): Response {
  return Response.json(
    {
      success: false,
      reason: "forbidden",
    },
    {
      status: 403,
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

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function maskSensitiveContent(content: string): string {
  const phoneMasked = content.replace(
    /\b(?:01[016789]-?\d{3,4}-?\d{4}|0\d{1,2}-?\d{3,4}-?\d{4})\b/g,
    "[전화번호]"
  );

  return phoneMasked.replace(/(https?:\/\/\S+|www\.\S+)/gi, "[링크]");
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

  if (post.authorEmail === email) {
    return forbidden();
  }

  if (post.status !== "claiming") {
    return conflict("invalid_transition");
  }

  if (!getSharedPostClaimStore().hasApprovedClaim(postId, email)) {
    return forbidden();
  }

  const body = await request.json();

  if (!body || !isNonEmptyText(body.content)) {
    return invalidRequest();
  }

  const trimmed = body.content.trim();

  if (trimmed.length < 1 || trimmed.length > 500) {
    return invalidRequest();
  }

  const messageStore = getSharedPostMessageStore();

  if (messageStore.hasMessageFromSender(postId, email)) {
    return conflict("already_sent");
  }

  const message = messageStore.create(postId, email, maskSensitiveContent(trimmed));

  getSharedNotificationStore().create({
    recipientEmail: post.authorEmail,
    type: "message_received",
    title: "새 메시지가 도착했습니다",
    body: `${post.title} 게시글에 새 메시지가 도착했습니다.`,
    postId,
  });

  return Response.json({
    success: true,
    message,
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const email = resolveAuthenticatedEmail(request);

  if (!email) {
    return invalidRequest();
  }

  const { postId } = await context.params;
  const post = getSharedPostStore().findById(postId);

  if (!post) {
    return notFound();
  }

  if (post.authorEmail !== email) {
    return forbidden();
  }

  const messages = getSharedPostMessageStore().listByPost(postId);

  return Response.json({
    success: true,
    messages,
  });
}
