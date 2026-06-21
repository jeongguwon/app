import { afterEach, describe, expect, it } from "vitest";

import {
  GET,
  __resetPostRouteNowForTests,
  __setPostRouteNowForTests,
  POST,
} from "@/app/api/posts/route";
import { PATCH } from "@/app/api/posts/[postId]/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import { __clearUserModerationStoreForTests, getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostStoreForTests } from "@/lib/posts/post-store";

describe("POST /api/posts", () => {
  afterEach(() => {
    __resetPostRouteNowForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearUserModerationStoreForTests();
    __clearSessionStoreForTests();
  });

  it("creates a post for authenticated user", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");
    __setPostRouteNowForTests(() => 1_700_000_000_000);

    const request = new Request("http://localhost/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `auth_session=${token}`,
      },
      body: JSON.stringify({
        type: "found",
        title: "교실에서 찾은 에어팟",
        category: "전자기기",
        location: "1-2 교실",
        eventAt: "2026-06-13T12:00:00.000Z",
        description: "흰색 케이스",
        photoPaths: ["posts/writer/photo-1.jpg"],
        storagePlace: "행정실",
        secretQuestion: "케이스 각인 글자는?",
        secretAnswer: "Minsu",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.post).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        authorEmail: "writer@school.ac.kr",
        type: "found",
        status: "active",
        secretQuestion: "케이스 각인 글자는?",
        secretAnswerHash: expect.any(String),
      })
    );
    expect(body.post.secretAnswerHash).not.toBe("Minsu");
    expect(body.post.secretAnswer).toBeUndefined();
  });

  it("rejects unauthenticated request", async () => {
    const request = new Request("http://localhost/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "lost",
        title: "지갑 분실",
        category: "지갑/카드",
        location: "운동장",
        eventAt: "2026-06-13T12:00:00.000Z",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("rejects found post without secret answer", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");

    const request = new Request("http://localhost/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `auth_session=${token}`,
      },
      body: JSON.stringify({
        type: "found",
        title: "에어팟",
        category: "전자기기",
        location: "교실",
        eventAt: "2026-06-13T12:00:00.000Z",
        storagePlace: "행정실",
        secretQuestion: "질문",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("blocks 6th post creation in the same hour", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");
    __setPostRouteNowForTests(() => 1_700_000_000_000);

    const payload = {
      type: "lost",
      title: "분실물",
      category: "기타",
      location: "복도",
      eventAt: "2026-06-13T12:00:00.000Z",
    };

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(
        new Request("http://localhost/api/posts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `auth_session=${token}`,
          },
          body: JSON.stringify(payload),
        })
      );

      expect(response.status).toBe(201);
    }

    const sixthResponse = await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify(payload),
      })
    );
    const sixthBody = await sixthResponse.json();

    expect(sixthResponse.status).toBe(429);
    expect(sixthBody).toEqual({
      success: false,
      reason: "rate_limited",
    });
  });

  it("rejects post creation when user is suspended", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");
    getSharedUserModerationStore().suspend("writer@school.ac.kr");

    const response = await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
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
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      reason: "suspended",
    });
  });
});

describe("GET /api/posts", () => {
  afterEach(() => {
    __resetPostRouteNowForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearUserModerationStoreForTests();
    __clearSessionStoreForTests();
  });

  it("supports keyword search over title and description", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");
    __setPostRouteNowForTests(() => Date.parse("2026-06-13T12:00:00.000Z"));

    await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "검은색 지갑 분실",
          category: "지갑/카드",
          location: "도서관",
          eventAt: "2026-06-12T12:00:00.000Z",
          description: "학생증 포함",
        }),
      })
    );

    await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          type: "found",
          title: "파란 우산 습득",
          category: "기타",
          location: "강당",
          eventAt: "2026-06-12T11:00:00.000Z",
          storagePlace: "행정실",
          secretQuestion: "손잡이 색은?",
          secretAnswer: "검정",
        }),
      })
    );

    const response = await GET(new Request("http://localhost/api/posts?q=학생증"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].title).toBe("검은색 지갑 분실");
  });

  it("applies type/category/location/status filters", async () => {
    const token = getSharedSessionStore().createSession("writer@school.ac.kr");

    const lostResponse = await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "아이패드 분실",
          category: "전자기기",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );
    const lostBody = await lostResponse.json();
    const lostId = lostBody.post.id as string;

    await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({
          type: "found",
          title: "에어팟 습득",
          category: "전자기기",
          location: "교실",
          eventAt: "2026-06-13T11:00:00.000Z",
          storagePlace: "행정실",
          secretQuestion: "케이스 색상은?",
          secretAnswer: "흰색",
        }),
      })
    );

    const markReturnedToken = getSharedSessionStore().createSession("writer@school.ac.kr");
    await PATCH(
      new Request(`http://localhost/api/posts/${lostId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${markReturnedToken}`,
        },
        body: JSON.stringify({
          status: "returned",
        }),
      }),
      {
        params: Promise.resolve({ postId: lostId }),
      }
    );

    const response = await GET(
      new Request(
        "http://localhost/api/posts?type=lost&category=전자기기&location=도서관&status=returned"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0]).toEqual(
      expect.objectContaining({
        type: "lost",
        category: "전자기기",
        location: "도서관",
        status: "returned",
      })
    );
  });

  it("filters by period and paginates by 20 items", async () => {
    __setPostRouteNowForTests(() => Date.parse("2026-06-13T12:00:00.000Z"));

    for (let i = 0; i < 21; i += 1) {
      const token = getSharedSessionStore().createSession(`writer${i}@school.ac.kr`);

      await POST(
        new Request("http://localhost/api/posts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `auth_session=${token}`,
          },
          body: JSON.stringify({
            type: "lost",
            title: `분실물-${i}`,
            category: "기타",
            location: "복도",
            eventAt: "2026-06-12T10:00:00.000Z",
          }),
        })
      );
    }

    const oldToken = getSharedSessionStore().createSession("old-writer@school.ac.kr");

    await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${oldToken}`,
        },
        body: JSON.stringify({
          type: "lost",
          title: "오래된 게시글",
          category: "기타",
          location: "복도",
          eventAt: "2026-05-01T10:00:00.000Z",
        }),
      })
    );

    const firstPageResponse = await GET(new Request("http://localhost/api/posts?period=7&page=1"));
    const firstPageBody = await firstPageResponse.json();

    expect(firstPageResponse.status).toBe(200);
    expect(firstPageBody.posts).toHaveLength(20);
    expect(firstPageBody.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });

    const secondPageResponse = await GET(new Request("http://localhost/api/posts?period=7&page=2"));
    const secondPageBody = await secondPageResponse.json();

    expect(secondPageResponse.status).toBe(200);
    expect(secondPageBody.posts).toHaveLength(1);
    expect(secondPageBody.posts[0].title).toMatch(/^분실물-/);
  });

  it("rejects invalid query parameters", async () => {
    const response = await GET(new Request("http://localhost/api/posts?type=unknown&period=99&page=0"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });
});

describe("GET /api/posts?mine=true", () => {
  afterEach(() => {
    __resetPostRouteNowForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/posts?mine=true"));

    expect(response.status).toBe(401);
  });

  it("returns only posts authored by the authenticated user", async () => {
    const aliceToken = getSharedSessionStore().createSession("alice@school.ac.kr");
    const bobToken = getSharedSessionStore().createSession("bob@school.ac.kr");

    await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_session=${aliceToken}` },
        body: JSON.stringify({
          type: "lost",
          title: "Alice 지갑",
          category: "지갑/카드",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_session=${bobToken}` },
        body: JSON.stringify({
          type: "lost",
          title: "Bob 가방",
          category: "기타",
          location: "강당",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );

    const response = await GET(
      new Request("http://localhost/api/posts?mine=true", {
        headers: { cookie: `auth_session=${aliceToken}` },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].title).toBe("Alice 지갑");
  });

  it("includes posts of all statuses for the owner", async () => {
    const token = getSharedSessionStore().createSession("owner@school.ac.kr");

    const createResp = await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_session=${token}` },
        body: JSON.stringify({
          type: "lost",
          title: "내 분실물",
          category: "기타",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );
    const { post } = await createResp.json();

    const { PATCH: patchRoute } = await import("@/app/api/posts/[postId]/route");
    await patchRoute(
      new Request(`http://localhost/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: `auth_session=${token}` },
        body: JSON.stringify({ status: "returned" }),
      }),
      { params: Promise.resolve({ postId: post.id }) }
    );

    const response = await GET(
      new Request("http://localhost/api/posts?mine=true", {
        headers: { cookie: `auth_session=${token}` },
      })
    );
    const body = await response.json();

    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].status).toBe("returned");
  });
});

