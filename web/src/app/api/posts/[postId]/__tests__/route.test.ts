import { afterEach, describe, expect, it } from "vitest";

import { POST as createPost } from "@/app/api/posts/route";
import { DELETE, GET, PATCH } from "@/app/api/posts/[postId]/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostStoreForTests } from "@/lib/posts/post-store";

function postContext(postId: string): { params: Promise<{ postId: string }> } {
  return {
    params: Promise.resolve({ postId }),
  };
}

describe("GET /api/posts/[postId]", () => {
  afterEach(() => {
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("returns public detail without private identifier fields for non-author", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "found",
          title: "검정 텀블러 습득",
          category: "기타",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
          storagePlace: "행정실",
          secretQuestion: "바닥 스티커 문구는?",
          secretAnswer: "A-12",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await GET(new Request(`http://localhost/api/posts/${postId}`), postContext(postId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.viewer).toEqual({ isAuthor: false, canSendMessage: false });
    expect(body.post.secretQuestion).toBeUndefined();
    expect(body.post.secretAnswerHash).toBeUndefined();
  });

  it("returns secret question for the author but never returns secretAnswerHash", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");

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
          location: "강당",
          eventAt: "2026-06-13T12:00:00.000Z",
          storagePlace: "학생회실",
          secretQuestion: "케이스 안쪽 글씨는?",
          secretAnswer: "Minsu",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const response = await GET(
      new Request(`http://localhost/api/posts/${postId}`, {
        headers: {
          cookie: `auth_session=${writerToken}`,
        },
      }),
      postContext(postId)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.viewer).toEqual({ isAuthor: true, canSendMessage: false });
    expect(body.post.secretQuestion).toBe("케이스 안쪽 글씨는?");
    expect(body.post.secretAnswerHash).toBeUndefined();
  });

  it("returns 404 for unknown post id", async () => {
    const response = await GET(
      new Request("http://localhost/api/posts/not-exist"),
      postContext("not-exist")
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      success: false,
      reason: "not_found",
    });
  });
});

describe("PATCH /api/posts/[postId]", () => {
  afterEach(() => {
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("updates post for the author", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "검정색 지갑",
          category: "지갑/카드",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const patchResponse = await PATCH(
      new Request(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          title: "검정색 반지갑",
          description: "학생증이 같이 들어있습니다.",
        }),
      }),
      postContext(postId)
    );

    const patchBody = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(patchBody.success).toBe(true);
    expect(patchBody.post).toEqual(
      expect.objectContaining({
        id: postId,
        title: "검정색 반지갑",
        description: "학생증이 같이 들어있습니다.",
      })
    );
  });

  it("rejects update by non-author", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const anotherToken = getSharedSessionStore().createSession("other@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "파란 우산",
          category: "기타",
          location: "강당",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const patchResponse = await PATCH(
      new Request(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${anotherToken}`,
        },
        body: JSON.stringify({
          title: "수정 시도",
        }),
      }),
      postContext(postId)
    );
    const patchBody = await patchResponse.json();

    expect(patchResponse.status).toBe(403);
    expect(patchBody).toEqual({
      success: false,
      reason: "forbidden",
    });
  });

  it("allows active to returned transition for author", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "노트북 분실",
          category: "전자기기",
          location: "컴퓨터실",
          eventAt: "2026-06-13T12:00:00.000Z",
          photoPaths: ["posts/laptop-1.jpg", "posts/laptop-2.jpg"],
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const patchResponse = await PATCH(
      new Request(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          status: "returned",
        }),
      }),
      postContext(postId)
    );
    const patchBody = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(patchBody.post.status).toBe("returned");
    expect(patchBody.post.photoPaths).toEqual([]);
  });

  it("rejects invalid status transition", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
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

    await PATCH(
      new Request(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          status: "returned",
        }),
      }),
      postContext(postId)
    );

    const invalidResponse = await PATCH(
      new Request(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          status: "active",
        }),
      }),
      postContext(postId)
    );
    const invalidBody = await invalidResponse.json();

    expect(invalidResponse.status).toBe(400);
    expect(invalidBody).toEqual({
      success: false,
      reason: "invalid_transition",
    });
  });
});

describe("DELETE /api/posts/[postId]", () => {
  afterEach(() => {
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("marks post as deleted for author", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "카드지갑",
          category: "지갑/카드",
          location: "복도",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/posts/${postId}`, {
        method: "DELETE",
        headers: {
          cookie: `auth_session=${token}`,
        },
      }),
      postContext(postId)
    );
    const deleteBody = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.post.status).toBe("deleted");
  });

  it("rejects delete by non-author", async () => {
    const writerToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    const anotherToken = getSharedSessionStore().createSession("other@school.ac.kr");

    const createResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${writerToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "필통",
          category: "문구",
          location: "교실",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const createdBody = await createResponse.json();
    const postId = createdBody.post.id as string;

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/posts/${postId}`, {
        method: "DELETE",
        headers: {
          cookie: `auth_session=${anotherToken}`,
        },
      }),
      postContext(postId)
    );
    const deleteBody = await deleteResponse.json();

    expect(deleteResponse.status).toBe(403);
    expect(deleteBody).toEqual({
      success: false,
      reason: "forbidden",
    });
  });
});
