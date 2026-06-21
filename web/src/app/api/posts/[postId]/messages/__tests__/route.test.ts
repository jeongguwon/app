import { afterEach, describe, expect, it } from "vitest";

import { POST as createPost } from "@/app/api/posts/route";
import { PATCH as decideClaim } from "@/app/api/posts/[postId]/claims/[claimId]/route";
import { POST as createClaim } from "@/app/api/posts/[postId]/claims/route";
import { GET, POST } from "@/app/api/posts/[postId]/messages/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import { getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { __clearUserModerationStoreForTests } from "@/lib/auth/user-moderation-store";
import {
  __clearNotificationStoreForTests,
  getSharedNotificationStore,
} from "@/lib/notifications/notification-store";
import { __clearPostClaimStoreForTests } from "@/lib/posts/post-claim-store";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostMessageStoreForTests } from "@/lib/posts/post-message-store";
import { __clearPostStoreForTests } from "@/lib/posts/post-store";

function postContext(postId: string): { params: Promise<{ postId: string }> } {
  return {
    params: Promise.resolve({ postId }),
  };
}

describe("/api/posts/[postId]/messages", () => {
  afterEach(() => {
    __clearNotificationStoreForTests();
    __clearUserModerationStoreForTests();
    __clearPostMessageStoreForTests();
    __clearPostClaimStoreForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("allows approved claimant to send one masked message", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const finderToken = getSharedSessionStore().createSession("finder@school.ac.kr");

    const created = await createPost(
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
          location: "운동장",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await created.json();
    const postId = createdBody.post.id as string;

    const claimResponse = await createClaim(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({ path: "finder" }),
      }),
      postContext(postId)
    );

    const claimBody = await claimResponse.json();
    const claimId = claimBody.claim.id as string;

    await decideClaim(
      new Request(`http://localhost/api/posts/${postId}/claims/${claimId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({ action: "approve" }),
      }),
      {
        params: Promise.resolve({ postId, claimId }),
      }
    );

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({
          content: "연락처 010-1234-5678, 링크 https://example.com",
        }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message.content).toContain("[전화번호]");
    expect(body.message.content).toContain("[링크]");
    expect(body.message.content).not.toContain("010-1234-5678");
    expect(getSharedNotificationStore().listByRecipient("writer@school.ac.kr")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "message_received", postId })])
    );

    const secondResponse = await POST(
      new Request(`http://localhost/api/posts/${postId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({ content: "한 번 더" }),
      }),
      postContext(postId)
    );
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(409);
    expect(secondBody).toEqual({
      success: false,
      reason: "already_sent",
    });
  });

  it("rejects message from non-approved user", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const strangerToken = getSharedSessionStore().createSession("stranger@school.ac.kr");

    const created = await createPost(
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

    const createdBody = await created.json();
    const postId = createdBody.post.id as string;

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${strangerToken}`,
        },
        body: JSON.stringify({ content: "연락 바랍니다." }),
      }),
      postContext(postId)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      success: false,
      reason: "invalid_transition",
    });
  });

  it("rejects message from suspended user", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const finderToken = getSharedSessionStore().createSession("finder@school.ac.kr");

    const created = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "가방 분실",
          category: "기타",
          location: "강당",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await created.json();
    const postId = createdBody.post.id as string;

    const claimResponse = await createClaim(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({ path: "finder" }),
      }),
      postContext(postId)
    );

    const claimBody = await claimResponse.json();
    const claimId = claimBody.claim.id as string;

    await decideClaim(
      new Request(`http://localhost/api/posts/${postId}/claims/${claimId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({ action: "approve" }),
      }),
      {
        params: Promise.resolve({ postId, claimId }),
      }
    );

    getSharedUserModerationStore().suspend("finder@school.ac.kr");

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({ content: "메시지 전송" }),
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

  it("allows author to read messages only", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const finderToken = getSharedSessionStore().createSession("finder@school.ac.kr");

    const created = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "가방 분실",
          category: "기타",
          location: "강당",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await created.json();
    const postId = createdBody.post.id as string;

    const claimResponse = await createClaim(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({ path: "finder" }),
      }),
      postContext(postId)
    );

    const claimBody = await claimResponse.json();
    const claimId = claimBody.claim.id as string;

    await decideClaim(
      new Request(`http://localhost/api/posts/${postId}/claims/${claimId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({ action: "approve" }),
      }),
      {
        params: Promise.resolve({ postId, claimId }),
      }
    );

    await POST(
      new Request(`http://localhost/api/posts/${postId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({ content: "학생회실로 오시면 전달드릴게요." }),
      }),
      postContext(postId)
    );

    const authorRead = await GET(
      new Request(`http://localhost/api/posts/${postId}/messages`, {
        headers: {
          cookie: `auth_session=${writerToken}`,
        },
      }),
      postContext(postId)
    );
    const authorBody = await authorRead.json();

    expect(authorRead.status).toBe(200);
    expect(authorBody.success).toBe(true);
    expect(authorBody.messages).toHaveLength(1);

    const finderRead = await GET(
      new Request(`http://localhost/api/posts/${postId}/messages`, {
        headers: {
          cookie: `auth_session=${finderToken}`,
        },
      }),
      postContext(postId)
    );
    const finderBody = await finderRead.json();

    expect(finderRead.status).toBe(403);
    expect(finderBody).toEqual({
      success: false,
      reason: "forbidden",
    });
  });
});
