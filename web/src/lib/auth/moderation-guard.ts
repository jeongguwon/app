import { getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";

export function buildSuspendedResponse(): Response {
  return Response.json(
    {
      success: false,
      reason: "suspended",
    },
    {
      status: 403,
    }
  );
}

export function ensureNotSuspended(email: string): Response | null {
  if (getSharedUserModerationStore().isSuspended(email)) {
    return buildSuspendedResponse();
  }

  return null;
}