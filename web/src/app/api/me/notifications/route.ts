import { NextResponse } from "next/server";

import { getSharedNotificationStore } from "@/lib/notifications/notification-store";
import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";

export async function GET(request: Request): Promise<Response> {
  const token = readAuthSessionToken(request.headers.get("cookie"));
  const email = token ? getSharedSessionStore().getEmailByToken(token) : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  const notifications = getSharedNotificationStore().listRecentByRecipient(email);

  return NextResponse.json({
    success: true,
    notifications,
  });
}
