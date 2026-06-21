import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/me/notifications/route";
import {
  __clearNotificationStoreForTests,
  __resetNotificationStoreNowForTests,
  __setNotificationStoreNowForTests,
  getSharedNotificationStore,
} from "@/lib/notifications/notification-store";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";

describe("GET /api/me/notifications", () => {
  afterEach(() => {
    __clearNotificationStoreForTests();
    __resetNotificationStoreNowForTests();
    __clearSessionStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/me/notifications"));

    expect(response.status).toBe(401);
  });

  it("returns notifications for the current user ordered newest first", async () => {
    __setNotificationStoreNowForTests(() => Date.parse("2026-06-20T10:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "me@school.ac.kr",
      type: "claim_received",
      title: "새 요청이 도착했습니다",
      body: "분실물 글에 새로운 요청이 있습니다.",
      postId: "post-1",
    });

    __setNotificationStoreNowForTests(() => Date.parse("2026-06-20T11:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "other@school.ac.kr",
      type: "message_received",
      title: "새 메시지",
      body: "다른 사용자 알림",
      postId: "post-2",
    });

    __setNotificationStoreNowForTests(() => Date.parse("2026-06-20T12:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "me@school.ac.kr",
      type: "message_received",
      title: "새 메시지가 도착했습니다",
      body: "클레이머 메시지를 확인해 주세요.",
      postId: "post-3",
    });

    const token = getSharedSessionStore().createSession("me@school.ac.kr");
    const response = await GET(
      new Request("http://localhost/api/me/notifications", {
        headers: { cookie: `auth_session=${token}` },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.notifications).toHaveLength(2);
    expect(body.notifications[0].title).toBe("새 메시지가 도착했습니다");
    expect(body.notifications[1].title).toBe("새 요청이 도착했습니다");
  });

  it("returns only notifications from the last 30 days", async () => {
    __setNotificationStoreNowForTests(() => Date.parse("2026-05-10T10:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "me@school.ac.kr",
      type: "claim_received",
      title: "오래된 알림",
      body: "30일을 초과했습니다.",
      postId: "post-old",
    });

    __setNotificationStoreNowForTests(() => Date.parse("2026-06-19T10:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "me@school.ac.kr",
      type: "message_received",
      title: "최근 알림",
      body: "30일 이내 알림입니다.",
      postId: "post-recent",
    });

    __setNotificationStoreNowForTests(() => Date.parse("2026-06-20T10:00:00.000Z"));

    const token = getSharedSessionStore().createSession("me@school.ac.kr");
    const response = await GET(
      new Request("http://localhost/api/me/notifications", {
        headers: { cookie: `auth_session=${token}` },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].title).toBe("최근 알림");
  });
});
