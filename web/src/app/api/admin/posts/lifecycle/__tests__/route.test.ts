import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/admin/posts/lifecycle/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import {
  __clearNotificationStoreForTests,
  __resetNotificationStoreNowForTests,
  __setNotificationStoreNowForTests,
  getSharedNotificationStore,
} from "@/lib/notifications/notification-store";
import {
  __clearPostMessageStoreForTests,
  __resetPostMessageStoreNowForTests,
  __setPostMessageStoreNowForTests,
  getSharedPostMessageStore,
} from "@/lib/posts/post-message-store";
import { __clearPostStoreForTests, getSharedPostStore } from "@/lib/posts/post-store";

describe("POST /api/admin/posts/lifecycle", () => {
  afterEach(() => {
    __clearPostStoreForTests();
    __clearPostMessageStoreForTests();
    __resetPostMessageStoreNowForTests();
    __clearNotificationStoreForTests();
    __resetNotificationStoreNowForTests();
    __clearSessionStoreForTests();
    delete process.env.ADMIN_EMAILS;
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await POST(new Request("http://localhost/api/admin/posts/lifecycle", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    const token = getSharedSessionStore().createSession("user@school.ac.kr");

    const response = await POST(
      new Request("http://localhost/api/admin/posts/lifecycle", {
        method: "POST",
        headers: { cookie: `auth_session=${token}` },
      })
    );

    expect(response.status).toBe(403);
  });

  it("applies automatic lifecycle transitions for eligible posts", async () => {
    process.env.ADMIN_EMAILS = "admin@school.ac.kr";
    const adminToken = getSharedSessionStore().createSession("admin@school.ac.kr");

    const returnedPost = getSharedPostStore().create({
      authorEmail: "writer@school.ac.kr",
      type: "lost",
      title: "지갑 분실",
      category: "지갑/카드",
      location: "도서관",
      eventAt: "2026-01-01T00:00:00.000Z",
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
    });
    getSharedPostStore().update(returnedPost.id, {
      status: "returned",
      now: () => Date.parse("2026-01-02T00:00:00.000Z"),
    });

    const hiddenPost = getSharedPostStore().create({
      authorEmail: "writer@school.ac.kr",
      type: "found",
      title: "텀블러 습득",
      category: "기타",
      location: "강당",
      eventAt: "2026-01-01T00:00:00.000Z",
      storagePlace: "행정실",
      secretQuestion: "각인은?",
      secretAnswerHash: "hash",
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
    });
    getSharedPostStore().update(hiddenPost.id, {
      status: "hidden",
      now: () => Date.parse("2026-01-05T00:00:00.000Z"),
    });

    __setPostMessageStoreNowForTests(() => Date.parse("2025-12-01T00:00:00.000Z"));
    getSharedPostMessageStore().create(returnedPost.id, "finder@school.ac.kr", "오래된 메시지");
    __setNotificationStoreNowForTests(() => Date.parse("2025-12-05T00:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "writer@school.ac.kr",
      type: "message_received",
      title: "오래된 알림",
      body: "보관 기간이 지났습니다.",
      postId: returnedPost.id,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/posts/lifecycle", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${adminToken}`,
        },
        body: JSON.stringify({ nowMs: Date.parse("2026-03-10T00:00:00.000Z") }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result).toEqual({
      hiddenCount: 1,
      deletedCount: 1,
      purgedMessageCount: 1,
      purgedNotificationCount: 1,
    });
    expect(getSharedPostStore().findById(returnedPost.id)?.status).toBe("hidden");
    expect(getSharedPostStore().findById(hiddenPost.id)?.status).toBe("deleted");
    expect(getSharedPostMessageStore().listByPost(returnedPost.id)).toEqual([]);
    expect(getSharedNotificationStore().listByRecipient("writer@school.ac.kr")).toEqual([]);
  });
});
