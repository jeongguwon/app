import { NextResponse } from "next/server";

import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { getSharedNotificationPreferenceStore } from "@/lib/notifications/notification-preference-store";

function resolveEmail(request: Request): string | null {
  const token = readAuthSessionToken(request.headers.get("cookie"));
  return token ? getSharedSessionStore().getEmailByToken(token) : null;
}

export async function GET(request: Request): Promise<Response> {
  const email = resolveEmail(request);

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  const setting = getSharedNotificationPreferenceStore().get(email);

  return NextResponse.json({
    success: true,
    setting: {
      enabled: setting.enabled,
      updatedAt: setting.updatedAt,
    },
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const email = resolveEmail(request);

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_request" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || typeof (body as { enabled?: unknown }).enabled !== "boolean") {
    return NextResponse.json({ success: false, reason: "invalid_request" }, { status: 400 });
  }

  const setting = getSharedNotificationPreferenceStore().set(email, (body as { enabled: boolean }).enabled);

  return NextResponse.json({
    success: true,
    setting: {
      enabled: setting.enabled,
      updatedAt: setting.updatedAt,
    },
  });
}