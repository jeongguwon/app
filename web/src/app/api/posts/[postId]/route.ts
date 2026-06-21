import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { getSharedPostClaimStore } from "@/lib/posts/post-claim-store";
import { getSharedPostStore, PostRecord, PostStatus } from "@/lib/posts/post-store";
import { hashSecretAnswer } from "@/lib/security/secret-answer";

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

function invalidTransition(): Response {
  return Response.json(
    {
      success: false,
      reason: "invalid_transition",
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

type RouteContext = {
  params: Promise<{ postId: string }>;
};

type PublicPostDetail = Omit<PostRecord, "secretQuestion" | "secretAnswerHash"> & {
  secretQuestion?: string | null;
};

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

function isValidDateIso(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isPostStatus(value: unknown): value is PostStatus {
  return (
    value === "active" ||
    value === "claiming" ||
    value === "returned" ||
    value === "hidden" ||
    value === "deleted"
  );
}

function canAuthorTransitionStatus(currentStatus: PostStatus, nextStatus: PostStatus): boolean {
  return currentStatus === "active" && nextStatus === "returned";
}

function toPostDetail(post: PostRecord, isAuthor: boolean): PublicPostDetail {
  const {
    secretAnswerHash,
    secretQuestion,
    ...basePost
  } = post;

  void secretAnswerHash;

  if (isAuthor) {
    return {
      ...basePost,
      secretQuestion,
    };
  }

  return basePost;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requesterEmail = resolveAuthenticatedEmail(request);
  const { postId } = await context.params;
  const post = getSharedPostStore().findById(postId);

  if (!post) {
    return notFound();
  }

  const isAuthor = requesterEmail !== null && requesterEmail === post.authorEmail;
  const canSendMessage =
    requesterEmail !== null &&
    !isAuthor &&
    post.status === "claiming" &&
    getSharedPostClaimStore().hasApprovedClaim(postId, requesterEmail);

  if (!isAuthor && (post.status === "hidden" || post.status === "deleted")) {
    return notFound();
  }

  return Response.json({
    success: true,
    post: toPostDetail(post, isAuthor),
    viewer: {
      isAuthor,
      canSendMessage,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const email = resolveAuthenticatedEmail(request);

    if (!email) {
      return invalidRequest();
    }

    const { postId } = await context.params;
    const store = getSharedPostStore();
    const post = store.findById(postId);

    if (!post) {
      return notFound();
    }

    if (post.authorEmail !== email) {
      return forbidden();
    }

    if (post.status === "deleted") {
      return invalidTransition();
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return invalidRequest();
    }

    const updates: {
      title?: string;
      category?: string;
      location?: string;
      eventAt?: string;
      description?: string | null;
      storagePlace?: string | null;
      secretQuestion?: string | null;
      secretAnswerHash?: string | null;
      status?: PostStatus;
    } = {};

    if (body.title !== undefined) {
      if (!isNonEmptyText(body.title)) {
        return invalidRequest();
      }

      updates.title = body.title.trim();
    }

    if (body.category !== undefined) {
      if (!isNonEmptyText(body.category)) {
        return invalidRequest();
      }

      updates.category = body.category.trim();
    }

    if (body.location !== undefined) {
      if (!isNonEmptyText(body.location)) {
        return invalidRequest();
      }

      updates.location = body.location.trim();
    }

    if (body.eventAt !== undefined) {
      if (!isValidDateIso(body.eventAt)) {
        return invalidRequest();
      }

      updates.eventAt = body.eventAt;
    }

    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== "string") {
        return invalidRequest();
      }

      updates.description = body.description;
    }

    if (body.storagePlace !== undefined) {
      if (body.storagePlace !== null && !isNonEmptyText(body.storagePlace)) {
        return invalidRequest();
      }

      updates.storagePlace = body.storagePlace === null ? null : body.storagePlace.trim();
    }

    if (body.secretQuestion !== undefined) {
      if (body.secretQuestion !== null && !isNonEmptyText(body.secretQuestion)) {
        return invalidRequest();
      }

      updates.secretQuestion = body.secretQuestion === null ? null : body.secretQuestion.trim();
    }

    if (body.secretAnswer !== undefined) {
      if (!isNonEmptyText(body.secretAnswer)) {
        return invalidRequest();
      }

      updates.secretAnswerHash = await hashSecretAnswer(body.secretAnswer);
    }

    if (body.status !== undefined) {
      if (!isPostStatus(body.status)) {
        return invalidRequest();
      }

      if (!canAuthorTransitionStatus(post.status, body.status)) {
        return invalidTransition();
      }

      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return invalidRequest();
    }

    const updatedPost = store.update(postId, updates);

    if (!updatedPost) {
      return notFound();
    }

    return Response.json({
      success: true,
      post: updatedPost,
    });
  } catch {
    return invalidRequest();
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const email = resolveAuthenticatedEmail(request);

  if (!email) {
    return invalidRequest();
  }

  const { postId } = await context.params;
  const store = getSharedPostStore();
  const post = store.findById(postId);

  if (!post) {
    return notFound();
  }

  if (post.authorEmail !== email) {
    return forbidden();
  }

  if (post.status === "deleted") {
    return invalidTransition();
  }

  const deletedPost = store.markDeleted(postId);

  if (!deletedPost) {
    return notFound();
  }

  return Response.json({
    success: true,
    post: deletedPost,
  });
}
