import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/admin/moderation-logs/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import {
  __clearUserModerationActionLogStoreForTests,
  getSharedUserModerationActionLogStore,
} from "@/lib/auth/user-moderation-action-log-store";

describe("GET /api/admin/moderation-logs", () => {
  afterEach(() => {
    __clearUserModerationActionLogStoreForTests();
    __clearSessionStoreForTests();
    delete process.env.ADMIN_EMAILS;
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/moderation-logs") as unknown as Parameters<typeof GET>[0]
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when caller is not admin", async () => {
    const token = getSharedSessionStore().createSession("user@school.ac.kr");

    const response = await GET(
      new Request("http://localhost/api/admin/moderation-logs", {
        headers: { cookie: `auth_session=${token}` },
      }) as unknown as Parameters<typeof GET>[0]
    );

    expect(response.status).toBe(403);
  });

  it("returns recent moderation logs for admin", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const token = getSharedSessionStore().createSession("admin@school.ac.kr");

    getSharedUserModerationActionLogStore().create({
      action: "warn",
      postId: "post-1",
      actorEmail: "admin@school.ac.kr",
      targetEmail: "author@school.ac.kr",
    });

    const response = await GET(
      new Request("http://localhost/api/admin/moderation-logs", {
        headers: { cookie: `auth_session=${token}` },
      }) as unknown as Parameters<typeof GET>[0]
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "warn",
          postId: "post-1",
          actorEmail: "admin@school.ac.kr",
          targetEmail: "author@school.ac.kr",
        }),
      ])
    );
  });
});
