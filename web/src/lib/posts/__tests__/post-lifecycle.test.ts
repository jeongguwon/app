import { afterEach, describe, expect, it } from "vitest";

import {
  __clearNotificationStoreForTests,
  __resetNotificationStoreNowForTests,
  __setNotificationStoreNowForTests,
  getSharedNotificationStore,
} from "@/lib/notifications/notification-store";
import { applyAutomaticPostTransitions } from "@/lib/posts/post-lifecycle";
import {
  __clearPostMessageStoreForTests,
  __resetPostMessageStoreNowForTests,
  __setPostMessageStoreNowForTests,
  getSharedPostMessageStore,
} from "@/lib/posts/post-message-store";
import { __clearPostStoreForTests, getSharedPostStore } from "@/lib/posts/post-store";

describe("applyAutomaticPostTransitions", () => {
  afterEach(() => {
    __clearPostStoreForTests();
    __clearPostMessageStoreForTests();
    __resetPostMessageStoreNowForTests();
    __clearNotificationStoreForTests();
    __resetNotificationStoreNowForTests();
  });

  it("hides returned posts after 30 days", () => {
    const createdAt = Date.parse("2026-01-01T00:00:00.000Z");
    const post = getSharedPostStore().create({
      authorEmail: "writer@school.ac.kr",
      type: "lost",
      title: "지갑 분실",
      category: "지갑/카드",
      location: "도서관",
      eventAt: "2026-01-01T00:00:00.000Z",
      now: () => createdAt,
    });

    getSharedPostStore().update(post.id, {
      status: "returned",
      now: () => Date.parse("2026-01-02T00:00:00.000Z"),
    });

    const result = applyAutomaticPostTransitions(Date.parse("2026-02-01T00:00:00.000Z"));
    const updated = getSharedPostStore().findById(post.id);

    expect(result).toEqual({
      hiddenCount: 1,
      deletedCount: 0,
      purgedMessageCount: 0,
      purgedNotificationCount: 0,
    });
    expect(updated?.status).toBe("hidden");
    expect(updated?.statusChangedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("deletes hidden posts after 60 days", () => {
    const post = getSharedPostStore().create({
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

    getSharedPostStore().update(post.id, {
      status: "hidden",
      now: () => Date.parse("2026-01-05T00:00:00.000Z"),
    });

    const result = applyAutomaticPostTransitions(Date.parse("2026-03-10T00:00:00.000Z"));
    const updated = getSharedPostStore().findById(post.id);

    expect(result).toEqual({
      hiddenCount: 0,
      deletedCount: 1,
      purgedMessageCount: 0,
      purgedNotificationCount: 0,
    });
    expect(updated?.status).toBe("deleted");
    expect(updated?.statusChangedAt).toBe("2026-03-10T00:00:00.000Z");
  });

  it("does not change posts before their thresholds", () => {
    const returnedPost = getSharedPostStore().create({
      authorEmail: "writer@school.ac.kr",
      type: "lost",
      title: "이어폰 분실",
      category: "전자기기",
      location: "교실",
      eventAt: "2026-01-01T00:00:00.000Z",
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
    });
    getSharedPostStore().update(returnedPost.id, {
      status: "returned",
      now: () => Date.parse("2026-01-10T00:00:00.000Z"),
    });

    const hiddenPost = getSharedPostStore().create({
      authorEmail: "writer@school.ac.kr",
      type: "lost",
      title: "학생증 분실",
      category: "문구",
      location: "복도",
      eventAt: "2026-01-01T00:00:00.000Z",
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
    });
    getSharedPostStore().update(hiddenPost.id, {
      status: "hidden",
      now: () => Date.parse("2026-01-20T00:00:00.000Z"),
    });

    const result = applyAutomaticPostTransitions(Date.parse("2026-01-30T00:00:00.000Z"));

    expect(result).toEqual({
      hiddenCount: 0,
      deletedCount: 0,
      purgedMessageCount: 0,
      purgedNotificationCount: 0,
    });
    expect(getSharedPostStore().findById(returnedPost.id)?.status).toBe("returned");
    expect(getSharedPostStore().findById(hiddenPost.id)?.status).toBe("hidden");
  });

  it("purges messages and notifications older than 90 days", () => {
    const post = getSharedPostStore().create({
      authorEmail: "writer@school.ac.kr",
      type: "lost",
      title: "무선 이어폰 분실",
      category: "전자기기",
      location: "도서관",
      eventAt: "2026-01-01T00:00:00.000Z",
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
    });

    __setPostMessageStoreNowForTests(() => Date.parse("2026-01-01T00:00:00.000Z"));
    getSharedPostMessageStore().create(post.id, "finder@school.ac.kr", "오래된 메시지");
    __setPostMessageStoreNowForTests(() => Date.parse("2026-04-05T00:00:00.000Z"));
    getSharedPostMessageStore().create(post.id, "finder2@school.ac.kr", "최근 메시지");

    __setNotificationStoreNowForTests(() => Date.parse("2026-01-10T00:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "writer@school.ac.kr",
      type: "message_received",
      title: "오래된 알림",
      body: "정리 대상입니다.",
      postId: post.id,
    });
    __setNotificationStoreNowForTests(() => Date.parse("2026-04-10T00:00:00.000Z"));
    getSharedNotificationStore().create({
      recipientEmail: "writer@school.ac.kr",
      type: "claim_received",
      title: "최근 알림",
      body: "유지되어야 합니다.",
      postId: post.id,
    });

    const result = applyAutomaticPostTransitions(Date.parse("2026-04-20T00:00:00.000Z"));

    expect(result).toEqual({
      hiddenCount: 0,
      deletedCount: 0,
      purgedMessageCount: 1,
      purgedNotificationCount: 1,
    });
    expect(getSharedPostMessageStore().listByPost(post.id)).toEqual([
      expect.objectContaining({ content: "최근 메시지" }),
    ]);
    expect(getSharedNotificationStore().listByRecipient("writer@school.ac.kr")).toEqual([
      expect.objectContaining({ title: "최근 알림" }),
    ]);
  });
});
