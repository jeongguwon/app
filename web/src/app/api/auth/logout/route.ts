import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";

function buildClearedSessionCookie(): string {
  return [
    "auth_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

export async function POST(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get("cookie");
  const token = readAuthSessionToken(cookieHeader);

  if (token) {
    getSharedSessionStore().deleteSession(token);
  }

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        "set-cookie": buildClearedSessionCookie(),
      },
    }
  );
}
