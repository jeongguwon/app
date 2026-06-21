import { NextResponse } from "next/server";

import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import { getSharedPostClaimStore } from "@/lib/posts/post-claim-store";
import { getSharedPostStore } from "@/lib/posts/post-store";

export async function GET(request: Request): Promise<Response> {
  const token = readAuthSessionToken(request.headers.get("cookie"));
  const email = token ? getSharedSessionStore().getEmailByToken(token) : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "unauthenticated" }, { status: 401 });
  }

  const postStore = getSharedPostStore();
  const claimStore = getSharedPostClaimStore();
  const myPosts = postStore.list().filter((post) => post.authorEmail === email);
  const myPostIds = myPosts.map((post) => post.id);

  const attemptedClaims = claimStore
    .listByClaimant(email)
    .map((claim) => ({
      ...claim,
      post: postStore.findById(claim.postId),
    }))
    .filter((claim) => claim.post !== null);

  const receivedClaims = claimStore
    .listByPosts(myPostIds)
    .map((claim) => ({
      ...claim,
      post: postStore.findById(claim.postId),
    }))
    .filter((claim) => claim.post !== null);

  return NextResponse.json({
    success: true,
    attemptedClaims,
    receivedClaims,
  });
}
