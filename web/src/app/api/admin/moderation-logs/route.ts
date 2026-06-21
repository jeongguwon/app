import { type NextRequest, NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/auth/is-admin";
import { readAuthSessionToken, getSharedSessionStore } from "@/lib/auth/session";
import { getSharedUserModerationActionLogStore } from "@/lib/auth/user-moderation-action-log-store";

export async function GET(request: NextRequest) {
  const token = readAuthSessionToken(request.headers.get("cookie"));
  const email = token ? getSharedSessionStore().getEmailByToken(token) : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  if (!isAdminEmail(email)) {
    return NextResponse.json({ success: false, reason: "forbidden" }, { status: 403 });
  }

  const logs = getSharedUserModerationActionLogStore().list(50);

  return NextResponse.json({
    success: true,
    logs,
  });
}