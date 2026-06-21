import { afterEach, describe, expect, it } from "vitest";

import { POST as createPost } from "@/app/api/posts/route";
import { POST } from "@/app/api/posts/[postId]/reports/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import { getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { __clearUserModerationStoreForTests } from "@/lib/auth/user-moderation-store";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostReportStoreForTests } from "@/lib/posts/post-report-store";
import { __clearPostStoreForTests } from "@/lib/posts/post-store";

function postContext(postId: string): { params: Promise<{ postId: string }> } {
  return {
    params: Promise.resolve({ postId }),
  };
}

describe("POST /api/posts/[postId]/reports", () => {
  afterEach(() => {
    __clearUserModerationStoreForTests();
    __clearPostReportStoreForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("accepts first report from a user", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const reporterToken = getSharedSessionStore().createSession("reporter@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "필통 분실",
          category: "문구",
          location: "교실",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporterToken}`,
        },
        body: JSON.stringify({
          reason: "other",
        }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.report.reason).toBe("other");
  });

  it("rejects duplicate report for same user and post", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const reporterToken = getSharedSessionStore().createSession("reporter@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "우산 분실",
          category: "기타",
          location: "강당",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    await POST(
      new Request(`http://localhost/api/posts/${postId}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporterToken}`,
        },
        body: JSON.stringify({
          reason: "abuse",
        }),
      }),
      postContext(postId)
    );

    const secondResponse = await POST(
      new Request(`http://localhost/api/posts/${postId}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporterToken}`,
        },
        body: JSON.stringify({
          reason: "privacy_exposure",
        }),
      }),
      postContext(postId)
    );

    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(409);
    expect(secondBody).toEqual({
      success: false,
      reason: "already_reported",
    });
  });

  it("rejects invalid reason", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const reporterToken = getSharedSessionStore().createSession("reporter@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "노트 분실",
          category: "문구",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporterToken}`,
        },
        body: JSON.stringify({
          reason: "unknown",
        }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("rejects report when reporter is suspended", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const reporterToken = getSharedSessionStore().createSession("reporter@school.ac.kr");
    getSharedUserModerationStore().suspend("reporter@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "노트 분실",
          category: "문구",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${reporterToken}`,
        },
        body: JSON.stringify({
          reason: "abuse",
        }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      reason: "suspended",
    });
  });
});
