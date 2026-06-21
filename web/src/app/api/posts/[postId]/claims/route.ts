import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { ensureNotSuspended } from "@/lib/auth/moderation-guard";
import { getSharedNotificationStore } from "@/lib/notifications/notification-store";
import { getSharedPostClaimStore } from "@/lib/posts/post-claim-store";
import { getSharedPostStore } from "@/lib/posts/post-store";
import { verifySecretAnswer } from "@/lib/security/secret-answer";

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
  const postStore = getSharedPostStore();
  const post = postStore.findById(postId);

  if (!post) {
    return notFound();
  }

  if (post.authorEmail === email) {
    return forbidden();
  }

  if (post.status !== "active") {
    return conflict("invalid_transition");
  }

  const body = await request.json();

  if (!body || typeof body !== "object") {
    return invalidRequest();
  }

  const path = body.path;

  if (path !== "owner" && path !== "finder") {
    return invalidRequest();
  }

  if (path === "owner" && post.type !== "found") {
    return invalidRequest();
  }

  if (path === "finder" && post.type !== "lost") {
    return invalidRequest();
  }

  const claimStore = getSharedPostClaimStore();

  if (path === "owner") {
    if (claimStore.isLocked(postId, email)) {
      return conflict("claim_locked");
    }

    if (!isNonEmptyText(body.secretAnswer) || !post.secretAnswerHash) {
      return invalidRequest();
    }

    const ok = await verifySecretAnswer(body.secretAnswer, post.secretAnswerHash);

    if (!ok) {
      claimStore.recordFailure(postId, email);

      if (claimStore.isLocked(postId, email)) {
        return conflict("claim_locked");
      }

      return conflict("invalid_secret_answer");
    }

    claimStore.resetFailures(postId, email);

    const claim = claimStore.create(postId, email, "owner", "approved");
    const updatedPost = postStore.update(postId, { status: "claiming" });

    getSharedNotificationStore().create({
      recipientEmail: post.authorEmail,
      type: "claim_approved",
      title: "소유권 검증이 통과되었습니다",
      body: `${post.title} 게시글에서 검증 통과 요청이 있습니다.`,
      postId,
    });

    return Response.json({
      success: true,
      claim,
      post: updatedPost,
    });
  }

  const claim = claimStore.create(postId, email, "finder", "pending");

  getSharedNotificationStore().create({
    recipientEmail: post.authorEmail,
    type: "claim_received",
    title: "새 클레임 요청이 도착했습니다",
    body: `${post.title} 게시글에 새로운 습득 확인 요청이 있습니다.`,
    postId,
  });

  return Response.json({
    success: true,
    claim,
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

  const claims = getSharedPostClaimStore()
    .listByPost(postId)
    .filter((claim) => claim.path === "finder");

  return Response.json({
    success: true,
    claims,
  });
}
