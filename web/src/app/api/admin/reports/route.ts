import { type NextRequest, NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/auth/is-admin";
import { readAuthSessionToken, getSharedSessionStore } from "@/lib/auth/session";
import { getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { getSharedPostReportStore } from "@/lib/posts/post-report-store";
import { getSharedPostStore } from "@/lib/posts/post-store";

export async function GET(request: NextRequest) {
  const token = readAuthSessionToken(request.headers.get("cookie"));
  const email = token ? getSharedSessionStore().getEmailByToken(token) : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  if (!isAdminEmail(email)) {
    return NextResponse.json({ success: false, reason: "forbidden" }, { status: 403 });
  }

  const postStore = getSharedPostStore();
  const moderationStore = getSharedUserModerationStore();
  const reports = getSharedPostReportStore().listAll().map((report) => {
    const post = postStore.findById(report.postId);
    const authorEmail = post?.authorEmail ?? null;

    return {
      ...report,
      authorEmail,
      moderation: authorEmail ? moderationStore.get(authorEmail) : null,
    };
  });

  return NextResponse.json({ success: true, reports });
}
