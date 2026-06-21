import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { ensureNotSuspended } from "@/lib/auth/moderation-guard";
import { getSharedNotificationStore } from "@/lib/notifications/notification-store";
import { getSharedPostClaimStore } from "@/lib/posts/post-claim-store";
import { getSharedPostStore } from "@/lib/posts/post-store";

type RouteContext = {
  params: Promise<{ postId: string; claimId: string }>;
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

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const email = resolveAuthenticatedEmail(request);

  if (!email) {
    return invalidRequest();
  }

  const suspended = ensureNotSuspended(email);

  if (suspended) {
    return suspended;
  }

  const { postId, claimId } = await context.params;
  const postStore = getSharedPostStore();
  const post = postStore.findById(postId);

  if (!post) {
    return notFound();
  }

  if (post.authorEmail !== email) {
    return forbidden();
  }

  const claimStore = getSharedPostClaimStore();
  const claim = claimStore.findById(claimId);

  if (!claim || claim.postId !== postId || claim.path !== "finder") {
    return notFound();
  }

  if (claim.status !== "pending") {
    return conflict("already_processed");
  }

  const body = await request.json();

  if (!body || typeof body !== "object") {
    return invalidRequest();
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return invalidRequest();
  }

  if (body.action === "approve") {
    if (post.status !== "active") {
      return conflict("invalid_transition");
    }

    const updatedClaim = claimStore.updateStatus(claimId, "approved");
    const updatedPost = postStore.update(postId, { status: "claiming" });

    getSharedNotificationStore().create({
      recipientEmail: claim.claimantEmail,
      type: "claim_approved",
      title: "클레임이 승인되었습니다",
      body: `${post.title} 게시글에서 요청이 승인되었습니다.`,
      postId,
    });

    return Response.json({
      success: true,
      claim: updatedClaim,
      post: updatedPost,
    });
  }

  const updatedClaim = claimStore.updateStatus(claimId, "rejected");

  getSharedNotificationStore().create({
    recipientEmail: claim.claimantEmail,
    type: "claim_rejected",
    title: "클레임이 거절되었습니다",
    body: `${post.title} 게시글에서 요청이 거절되었습니다.`,
    postId,
  });

  return Response.json({
    success: true,
    claim: updatedClaim,
  });
}
