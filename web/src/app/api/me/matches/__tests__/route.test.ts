import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/me/matches/route";
import { POST as createClaim } from "@/app/api/posts/[postId]/claims/route";
import { POST as createPost } from "@/app/api/posts/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import { __clearPostClaimStoreForTests } from "@/lib/posts/post-claim-store";
import { __clearPostCreateLimiterForTests } from "@/lib/posts/post-create-limiter";
import { __clearPostStoreForTests } from "@/lib/posts/post-store";

function postContext(postId: string): { params: Promise<{ postId: string }> } {
  return { params: Promise.resolve({ postId }) };
}

describe("GET /api/me/matches", () => {
  afterEach(() => {
    __clearPostClaimStoreForTests();
    __clearPostCreateLimiterForTests();
    __clearPostStoreForTests();
    __clearSessionStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/me/matches"));

    expect(response.status).toBe(401);
  });

  it("returns attempted and received claims for the current user", async () => {
    const ownerToken = getSharedSessionStore().createSession("owner@school.ac.kr");
    const claimantToken = getSharedSessionStore().createSession("claimant@school.ac.kr");
    const otherOwnerToken = getSharedSessionStore().createSession("other-owner@school.ac.kr");

    const myPostResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_session=${ownerToken}` },
        body: JSON.stringify({
          type: "lost",
          title: "내 분실물",
          category: "기타",
          location: "도서관",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );
    const myPostBody = await myPostResponse.json();

    const otherPostResponse = await createPost(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_session=${otherOwnerToken}` },
        body: JSON.stringify({
          type: "lost",
          title: "남의 분실물",
          category: "기타",
          location: "강당",
          eventAt: "2026-06-13T12:00:00.000Z",
        }),
      })
    );
    const otherPostBody = await otherPostResponse.json();

    await createClaim(
      new Request(`http://localhost/api/posts/${myPostBody.post.id}/claims`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_session=${claimantToken}` },
        body: JSON.stringify({ path: "finder" }),
      }),
      postContext(myPostBody.post.id)
    );

    await createClaim(
      new Request(`http://localhost/api/posts/${otherPostBody.post.id}/claims`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_session=${ownerToken}` },
        body: JSON.stringify({ path: "finder" }),
      }),
      postContext(otherPostBody.post.id)
    );

    const response = await GET(
      new Request("http://localhost/api/me/matches", {
        headers: { cookie: `auth_session=${ownerToken}` },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.receivedClaims).toHaveLength(1);
    expect(body.receivedClaims[0].post.title).toBe("내 분실물");
    expect(body.attemptedClaims).toHaveLength(1);
    expect(body.attemptedClaims[0].post.title).toBe("남의 분실물");
  });
});
