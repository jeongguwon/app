import { afterEach, describe, expect, it } from "vitest";

import { POST as createPost } from "@/app/api/posts/route";
import { GET, POST } from "@/app/api/posts/[postId]/claims/route";
import { PATCH } from "@/app/api/posts/[postId]/claims/[claimId]/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import { getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { __clearUserModerationStoreForTests } from "@/lib/auth/user-moderation-store";
import {
  __clearNotificationStoreForTests,
  getSharedNotificationStore,
} from "@/lib/notifications/notification-store";
import {
  __clearPostClaimStoreForTests,
  __resetPostClaimStoreNowForTests,
  __setPostClaimStoreNowForTests,
} from "@/lib/posts/post-claim-store";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostStoreForTests, getSharedPostStore } from "@/lib/posts/post-store";

function postContext(postId: string): { params: Promise<{ postId: string }> } {
  return {
    params: Promise.resolve({ postId }),
  };
}

describe("POST /api/posts/[postId]/claims", () => {
  afterEach(() => {
    __clearNotificationStoreForTests();
    __clearUserModerationStoreForTests();
    __resetPostClaimStoreNowForTests();
    __clearPostClaimStoreForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("transitions found post to claiming when owner answer matches", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const claimerToken = getSharedSessionStore().createSession("owner@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "found",
          title: "무선이어폰 습득",
          category: "전자기기",
          location: "교실",
          eventAt: "2026-06-13T12:00:00.000Z",
          storagePlace: "행정실",
          secretQuestion: "각인 글자는?",
          secretAnswer: "Minsu",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${claimerToken}`,
        },
        body: JSON.stringify({
          path: "owner",
          secretAnswer: "Minsu",
        }),
      }),
      postContext(postId)
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.claim.path).toBe("owner");
    expect(body.post.status).toBe("claiming");
    expect(getSharedPostStore().findById(postId)?.status).toBe("claiming");
    expect(getSharedNotificationStore().listByRecipient("writer@school.ac.kr")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "claim_approved", postId })])
    );
  });

  it("locks owner claim after 3 failed attempts within 24h", async () => {
    __setPostClaimStoreNowForTests(() => Date.parse("2026-06-13T12:00:00.000Z"));

    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const claimerToken = getSharedSessionStore().createSession("owner@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "found",
          title: "텀블러 습득",
          category: "기타",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
          storagePlace: "행정실",
          secretQuestion: "스티커 문구는?",
          secretAnswer: "A-12",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    for (let i = 0; i < 2; i += 1) {
      const attemptResponse = await POST(
        new Request(`http://localhost/api/posts/${postId}/claims`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `auth_session=${claimerToken}`,
          },
          body: JSON.stringify({
            path: "owner",
            secretAnswer: "wrong",
          }),
        }),
        postContext(postId)
      );
      const attemptBody = await attemptResponse.json();

      expect(attemptResponse.status).toBe(409);
      expect(attemptBody.reason).toBe("invalid_secret_answer");
    }

    const thirdResponse = await POST(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${claimerToken}`,
        },
        body: JSON.stringify({
          path: "owner",
          secretAnswer: "wrong",
        }),
      }),
      postContext(postId)
    );
    const thirdBody = await thirdResponse.json();

    expect(thirdResponse.status).toBe(409);
    expect(thirdBody).toEqual({
      success: false,
      reason: "claim_locked",
    });
  });

  it("creates pending finder claim for lost post", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const finderToken = getSharedSessionStore().createSession("finder@school.ac.kr");

    const createResponse = await createPost(
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

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({
          path: "finder",
        }),
      }),
      postContext(postId)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.claim.path).toBe("finder");
    expect(body.claim.status).toBe("pending");
    expect(body.post).toBeUndefined();
    expect(getSharedNotificationStore().listByRecipient("writer@school.ac.kr")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "claim_received", postId })])
    );
  });

  it("rejects claim creation when claimant is suspended", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const finderToken = getSharedSessionStore().createSession("finder@school.ac.kr");
    getSharedUserModerationStore().suspend("finder@school.ac.kr");

    const createResponse = await createPost(
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

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await POST(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({
          path: "finder",
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

  it("allows author to list and approve pending finder claims", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const finderToken = getSharedSessionStore().createSession("finder@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "노트북 분실",
          category: "전자기기",
          location: "컴퓨터실",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    await POST(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({
          path: "finder",
        }),
      }),
      postContext(postId)
    );

    const listResponse = await GET(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        headers: {
          cookie: `auth_session=${writerToken}`,
        },
      }),
      postContext(postId)
    );

    const listBody = await listResponse.json();
    const claimId = listBody.claims[0].id as string;

    expect(listResponse.status).toBe(200);
    expect(listBody.success).toBe(true);
    expect(listBody.claims).toHaveLength(1);
    expect(listBody.claims[0].status).toBe("pending");

    const approveResponse = await PATCH(
      new Request(`http://localhost/api/posts/${postId}/claims/${claimId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          action: "approve",
        }),
      }),
      {
        params: Promise.resolve({ postId, claimId }),
      }
    );

    const approveBody = await approveResponse.json();

    expect(approveResponse.status).toBe(200);
    expect(approveBody.claim.status).toBe("approved");
    expect(approveBody.post.status).toBe("claiming");
    expect(getSharedPostStore().findById(postId)?.status).toBe("claiming");
    expect(getSharedNotificationStore().listByRecipient("finder@school.ac.kr")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "claim_approved", postId })])
    );
  });

  it("allows author to reject pending finder claim", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const finderToken = getSharedSessionStore().createSession("finder@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "체육복 분실",
          category: "의류",
          location: "체육관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const claimResponse = await POST(
      new Request(`http://localhost/api/posts/${postId}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${finderToken}`,
        },
        body: JSON.stringify({
          path: "finder",
        }),
      }),
      postContext(postId)
    );

    const claimBody = await claimResponse.json();
    const claimId = claimBody.claim.id as string;

    const rejectResponse = await PATCH(
      new Request(`http://localhost/api/posts/${postId}/claims/${claimId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          action: "reject",
        }),
      }),
      {
        params: Promise.resolve({ postId, claimId }),
      }
    );

    const rejectBody = await rejectResponse.json();

    expect(rejectResponse.status).toBe(200);
    expect(rejectBody.claim.status).toBe("rejected");
    expect(rejectBody.post).toBeUndefined();
    expect(getSharedPostStore().findById(postId)?.status).toBe("active");
    expect(getSharedNotificationStore().listByRecipient("finder@school.ac.kr")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "claim_rejected", postId })])
    );
  });
});
