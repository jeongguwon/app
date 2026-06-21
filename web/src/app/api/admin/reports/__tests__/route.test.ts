import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/admin/reports/route";
import { POST as createPost } from "@/app/api/posts/route";
import { POST as createReport } from "@/app/api/posts/[postId]/reports/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import { __clearUserModerationStoreForTests, getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostReportStoreForTests } from "@/lib/posts/post-report-store";
import { __clearPostStoreForTests } from "@/lib/posts/post-store";

function reportContext(postId: string): { params: Promise<{ postId: string }> } {
  return {
    params: Promise.resolve({ postId }),
  };
}

function adminRequest(adminToken: string): Request {
  return new Request("http://localhost/api/admin/reports", {
    headers: { cookie: `auth_session=${adminToken}` },
  });
}

describe("GET /api/admin/reports", () => {
  afterEach(() => {
    __clearPostReportStoreForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearUserModerationStoreForTests();
    __clearSessionStoreForTests();
    delete process.env.ADMIN_EMAILS;
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/admin/reports"));

    expect(response.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    const token = getSharedSessionStore().createSession("regular@school.ac.kr");

    const response = await GET(
      new Request("http://localhost/api/admin/reports", {
        headers: { cookie: `auth_session=${token}` },
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns empty report queue for admin with no reports", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");

    const response = await GET(adminRequest(adminToken));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reports).toHaveLength(0);
  });

  it("returns reports ordered oldest first", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";

    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const reporter1Token = getSharedSessionStore().createSession("r1@school.ac.kr");
    const reporter2Token = getSharedSessionStore().createSession("r2@school.ac.kr");

    const postResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "지갑 분실",
          category: "지갑/카드",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );
    const { post } = await postResponse.json();

    await createReport(
      new Request(`http://localhost/api/posts/${post.id}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporter1Token}`,
        },
        body: JSON.stringify({ reason: "false_information" }),
      }),
      reportContext(post.id)
    );

    await createReport(
      new Request(`http://localhost/api/posts/${post.id}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporter2Token}`,
        },
        body: JSON.stringify({ reason: "abuse" }),
      }),
      reportContext(post.id)
    );

    const response = await GET(adminRequest(adminToken));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reports).toHaveLength(2);
    expect(body.reports[0].reason).toBe("false_information");
    expect(body.reports[1].reason).toBe("abuse");
    expect(body.reports[0].authorEmail).toBe("writer@school.ac.kr");
    expect(body.reports[0].moderation).toEqual(
      expect.objectContaining({ status: "active", warningCount: 0 })
    );
    expect(new Date(body.reports[0].createdAt) <= new Date(body.reports[1].createdAt)).toBe(true);
  });

  it("includes updated moderation status for suspended author", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";

    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const reporterToken = getSharedSessionStore().createSession("r1@school.ac.kr");

    const postResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "지갑 분실",
          category: "지갑/카드",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );
    const { post } = await postResponse.json();

    await createReport(
      new Request(`http://localhost/api/posts/${post.id}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporterToken}`,
        },
        body: JSON.stringify({ reason: "abuse" }),
      }),
      reportContext(post.id)
    );

    getSharedUserModerationStore().suspend("writer@school.ac.kr");

    const response = await GET(adminRequest(adminToken));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reports[0].moderation.status).toBe("suspended");
  });
});
