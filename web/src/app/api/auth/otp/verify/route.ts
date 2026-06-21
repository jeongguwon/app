import { OtpService } from "@/lib/auth/otp";
import { getSharedLoginAttemptLimiter } from "@/lib/auth/login-attempt-limiter";
import { getSharedSessionStore } from "@/lib/auth/session";

function getAllowedDomainsFromEnv(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS ?? "";

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSessionCookie(token: string): string {

  return [
    `auth_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
  ].join("; ");
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();

    if (!body || typeof body.email !== "string" || typeof body.code !== "string") {
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

    const email = body.email.trim().toLowerCase();
    const limiter = getSharedLoginAttemptLimiter();

    if (limiter.isLocked(email)) {
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

    const service = new OtpService({
      allowedDomains: getAllowedDomainsFromEnv(),
    });

    const result = await service.verify(email, body.code);

    if (!result.success) {
      limiter.recordFailure(email);
      return Response.json(result, { status: 400 });
    }

    limiter.reset(email);
    const token = getSharedSessionStore().createSession(email);

    return Response.json(
      { success: true },
      {
        status: 200,
        headers: {
          "set-cookie": buildSessionCookie(token),
        },
      }
    );
  } catch {
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
}
