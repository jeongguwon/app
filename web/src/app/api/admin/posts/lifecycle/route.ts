import { type NextRequest, NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/auth/is-admin";
import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { applyAutomaticPostTransitions } from "@/lib/posts/post-lifecycle";

export async function POST(request: NextRequest): Promise<Response> {
  const token = readAuthSessionToken(request.headers.get("cookie"));
  const email = token ? getSharedSessionStore().getEmailByToken(token) : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  if (!isAdminEmail(email)) {
    return NextResponse.json({ success: false, reason: "forbidden" }, { status: 403 });
  }

  let body: unknown = null;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const nowMs =
    body &&
    typeof body === "object" &&
    "nowMs" in body &&
    typeof (body as { nowMs?: unknown }).nowMs === "number"
      ? (body as { nowMs: number }).nowMs
      : Date.now();

  const result = applyAutomaticPostTransitions(nowMs);

  return NextResponse.json({
    success: true,
    result,
  });
}
