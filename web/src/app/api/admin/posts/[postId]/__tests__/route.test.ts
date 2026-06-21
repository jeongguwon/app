import { afterEach, describe, expect, it } from "vitest";

import { PATCH } from "@/app/api/admin/posts/[postId]/route";
import { POST as createPost } from "@/app/api/posts/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import {
  __clearUserModerationActionLogStoreForTests,
  getSharedUserModerationActionLogStore,
} from "@/lib/auth/user-moderation-action-log-store";
import { __clearUserModerationStoreForTests, getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import {
  __clearNotificationStoreForTests,
  getSharedNotificationStore,
} from "@/lib/notifications/notification-store";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostReportStoreForTests, getSharedPostReportStore } from "@/lib/posts/post-report-store";
import { __clearPostStoreForTests } from "@/lib/posts/post-store";

function postContext(postId: string): { params: Promise<{ postId: string }> } {
  return {
    params: Promise.resolve({ postId }),
  };
}

async function makePost(authorToken: string): Promise<string> {
  const response = await createPost(
    new Request("http://localhost/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `auth_session=${authorToken}`,
      },
      body: JSON.stringify({
        type: "found",
        title: "텀블러 습득",
        category: "기타",
        location: "도서관",
        eventAt: "2026-06-13T12:00:00.000Z",
        storagePlace: "행정실",
        secretQuestion: "각인은?",
        secretAnswer: "answer",
      }),
    })
  );
  const body = await response.json();
  return body.post.id as string;
}

describe("PATCH /api/admin/posts/[postId]", () => {
  afterEach(() => {
    __clearUserModerationActionLogStoreForTests();
    __clearNotificationStoreForTests();
    __clearPostReportStoreForTests();
    __clearPostStoreForTests();
    __clearPostCreateLimiterForTests();
    __clearUserModerationStoreForTests();
    __clearSessionStoreForTests();
    delete process.env.ADMIN_EMAILS;
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/posts/some-id", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "hide" }),
      }),
      postContext("some-id")
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    const token = getSharedSessionStore().createSession("user@school.ac.kr");

    const response = await PATCH(
      new Request("http://localhost/api/admin/posts/some-id", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({ action: "hide" }),
      }),
      postContext("some-id")
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 for unknown post", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");

    const response = await PATCH(
      new Request("http://localhost/api/admin/posts/non-existent", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ action: "hide" }),
      }),
      postContext("non-existent")
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid action", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const authorToken = getSharedSessionStore().createSession("author@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const postId = await makePost(authorToken);

    const response = await PATCH(
      new Request(`http://localhost/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ action: "ban" }),
      }),
      postContext(postId)
    );

    expect(response.status).toBe(400);
  });

  it("warns the post author as admin", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const authorToken = getSharedSessionStore().createSession("author@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const postId = await makePost(authorToken);

    const response = await PATCH(
      new Request(`http://localhost/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ action: "warn" }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.action).toBe("warn");
    expect(body.moderation.warningCount).toBe(1);
    expect(getSharedUserModerationStore().get("author@school.ac.kr").warningCount).toBe(1);
    expect(getSharedUserModerationActionLogStore().list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "warn",
          postId,
          actorEmail: "admin@school.ac.kr",
          targetEmail: "author@school.ac.kr",
        }),
      ])
    );
  });

  it("suspends the post author and notifies reporters", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const authorToken = getSharedSessionStore().createSession("author@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const postId = await makePost(authorToken);

    getSharedPostReportStore().create(postId, "reporter@school.ac.kr", "abuse");

    const response = await PATCH(
      new Request(`http://localhost/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ action: "suspend" }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.action).toBe("suspend");
    expect(getSharedUserModerationStore().isSuspended("author@school.ac.kr")).toBe(true);
    expect(getSharedNotificationStore().listByRecipient("author@school.ac.kr")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "report_processed",
          postId,
          title: "계정이 정지되었습니다",
        }),
      ])
    );
    expect(getSharedNotificationStore().listByRecipient("reporter@school.ac.kr")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "report_processed",
          postId,
          title: "신고 건이 처리되었습니다",
          body: expect.stringContaining("정지 처리"),
        }),
      ])
    );
  });

  it("unsuspends the post author", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const authorToken = getSharedSessionStore().createSession("author@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const postId = await makePost(authorToken);

    getSharedUserModerationStore().suspend("author@school.ac.kr");

    const response = await PATCH(
      new Request(`http://localhost/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ action: "unsuspend" }),
      }),
      postContext(postId)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.action).toBe("unsuspend");
    expect(getSharedUserModerationStore().isSuspended("author@school.ac.kr")).toBe(false);
    expect(getSharedNotificationStore().listByRecipient("author@school.ac.kr")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "report_processed",
          postId,
          title: "계정 정지가 해제되었습니다",
        }),
      ])
    );
  });

  it("hides a post as admin", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const authorToken = getSharedSessionStore().createSession("author@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const postId = await makePost(authorToken);

    const response = await PATCH(
      new Request(`http://localhost/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ action: "hide" }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.post.status).toBe("hidden");
    expect(getSharedNotificationStore().listByRecipient("author@school.ac.kr")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "report_processed", postId })])
    );
  });

  it("deletes a post as admin", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const authorToken = getSharedSessionStore().createSession("author@school.ac.kr");
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");
    const postId = await makePost(authorToken);

    const response = await PATCH(
      new Request(`http://localhost/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ action: "delete" }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.post.status).toBe("deleted");
    expect(getSharedNotificationStore().listByRecipient("author@school.ac.kr")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "report_processed", postId })])
    );
  });
});
