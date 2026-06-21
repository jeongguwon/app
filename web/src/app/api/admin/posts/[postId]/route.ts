import { type NextRequest, NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/auth/is-admin";
import { getSharedUserModerationActionLogStore } from "@/lib/auth/user-moderation-action-log-store";
import { getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { getSharedNotificationStore } from "@/lib/notifications/notification-store";
import { readAuthSessionToken, getSharedSessionStore } from "@/lib/auth/session";
import { getSharedPostReportStore } from "@/lib/posts/post-report-store";
import { getSharedPostStore } from "@/lib/posts/post-store";

const ALLOWED_ADMIN_ACTIONS = ["hide", "delete", "warn", "suspend", "unsuspend"] as const;
type AdminPostAction = (typeof ALLOWED_ADMIN_ACTIONS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const token = readAuthSessionToken(request.headers.get("cookie"));
  const email = token ? getSharedSessionStore().getEmailByToken(token) : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  if (!isAdminEmail(email)) {
    return NextResponse.json({ success: false, reason: "forbidden" }, { status: 403 });
  }

  const { postId } = await params;
  const post = getSharedPostStore().findById(postId);

  if (!post) {
    return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ success: false, reason: "invalid_body" }, { status: 400 });
  }

  const { action: rawAction } = body as Record<string, unknown>;

  if (typeof rawAction !== "string" || !ALLOWED_ADMIN_ACTIONS.includes(rawAction as AdminPostAction)) {
    return NextResponse.json({ success: false, reason: "invalid_action" }, { status: 400 });
  }

  const action: AdminPostAction = rawAction as AdminPostAction;

  const postStore = getSharedPostStore();
  const moderationStore = getSharedUserModerationStore();
  const reportStore = getSharedPostReportStore();

  let updatedPost: typeof post | null = post;

  if (action === "hide") {
    const result = postStore.update(postId, { status: "hidden" });
    if (result) updatedPost = result;
  }

  if (action === "delete") {
    const result = postStore.update(postId, { status: "deleted" });
    if (result) updatedPost = result;
  }

  let moderation = moderationStore.get(post.authorEmail);

  if (action === "warn") {
    moderation = moderationStore.warn(post.authorEmail);
  }

  if (action === "suspend") {
    moderation = moderationStore.suspend(post.authorEmail);
  }

  if (action === "unsuspend") {
    moderation = moderationStore.unsuspend(post.authorEmail);
  }

  const recipients = new Set<string>([
    post.authorEmail,
    ...reportStore.listByPost(postId).map((report) => report.reporterEmail),
  ]);

  const authorMessageByAction: Record<AdminPostAction, { title: string; body: string }> = {
    hide: {
      title: "게시글이 숨김 처리되었습니다",
      body: `${post.title} 게시글이 숨김 처리되었습니다.`,
    },
    delete: {
      title: "게시글이 삭제 처리되었습니다",
      body: `${post.title} 게시글이 삭제 처리되었습니다.`,
    },
    warn: {
      title: "경고 조치가 적용되었습니다",
      body: `${post.title} 게시글 관련 경고가 누적되었습니다.`,
    },
    suspend: {
      title: "계정이 정지되었습니다",
      body: "계정이 정지되었습니다. 관리자에게 문의해 주세요.",
    },
    unsuspend: {
      title: "계정 정지가 해제되었습니다",
      body: "계정 정지가 해제되었습니다.",
    },
  };

  const reporterMessageByAction: Record<AdminPostAction, { title: string; body: string }> = {
    hide: {
      title: "신고 건이 처리되었습니다",
      body: `${post.title} 게시글이 숨김 처리되었습니다.`,
    },
    delete: {
      title: "신고 건이 처리되었습니다",
      body: `${post.title} 게시글이 삭제 처리되었습니다.`,
    },
    warn: {
      title: "신고 건이 처리되었습니다",
      body: `${post.title} 게시글 작성자에게 경고 조치가 적용되었습니다.`,
    },
    suspend: {
      title: "신고 건이 처리되었습니다",
      body: `${post.title} 게시글 작성자가 정지 처리되었습니다.`,
    },
    unsuspend: {
      title: "신고 건 상태가 변경되었습니다",
      body: `${post.title} 게시글 작성자 정지가 해제되었습니다.`,
    },
  };

  for (const recipientEmail of recipients) {
    const isAuthor = recipientEmail === post.authorEmail;
    const message = isAuthor ? authorMessageByAction[action] : reporterMessageByAction[action];

    getSharedNotificationStore().create({
      recipientEmail,
      type: "report_processed",
      title: message.title,
      body: message.body,
      postId,
    });
  }

  getSharedUserModerationActionLogStore().create({
    action,
    postId,
    actorEmail: email,
    targetEmail: post.authorEmail,
  });

  return NextResponse.json({
    success: true,
    post: updatedPost,
    moderation,
    action,
  });
}
