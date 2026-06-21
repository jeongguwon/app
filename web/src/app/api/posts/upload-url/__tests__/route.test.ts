import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetUploadUrlSignerForTests,
  __setUploadUrlSignerForTests,
  POST,
} from "@/app/api/posts/upload-url/route";
import { __clearUserModerationStoreForTests, getSharedUserModerationStore } from "@/lib/auth/user-moderation-store";
import { getSharedSessionStore, __clearSessionStoreForTests } from "@/lib/auth/session";

describe("POST /api/posts/upload-url", () => {
  afterEach(() => {
    __resetUploadUrlSignerForTests();
    __clearUserModerationStoreForTests();
    __clearSessionStoreForTests();
  });

  it("returns presigned upload url for authenticated user", async () => {
    const token = getSharedSessionStore().createSession("student@school.ac.kr");
    const signer = {
      createUploadUrl: vi.fn().mockResolvedValue("https://storage.example/upload"),
    };

    __setUploadUrlSignerForTests(signer);

    const request = new Request("http://localhost/api/posts/upload-url", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `auth_session=${token}`,
      },
      body: JSON.stringify({
        fileName: "airpods.jpg",
        contentType: "image/jpeg",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.uploadUrl).toBe("https://storage.example/upload");
    expect(body.path).toContain("posts/student@school.ac.kr/");
    expect(body.path).toContain("airpods.jpg");
    expect(body.expiresIn).toBe(600);

    expect(signer.createUploadUrl).toHaveBeenCalledTimes(1);
    expect(signer.createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/jpeg",
        expiresInSeconds: 600,
      })
    );
  });

  it("rejects request without valid session", async () => {
    const request = new Request("http://localhost/api/posts/upload-url", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileName: "a.jpg",
        contentType: "image/jpeg",
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

  it("rejects unsupported content type", async () => {
    const token = getSharedSessionStore().createSession("student@school.ac.kr");

    const request = new Request("http://localhost/api/posts/upload-url", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `auth_session=${token}`,
      },
      body: JSON.stringify({
        fileName: "a.gif",
        contentType: "image/gif",
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

  it("sanitizes suspicious file names in path", async () => {
    const token = getSharedSessionStore().createSession("student@school.ac.kr");
    const signer = {
      createUploadUrl: vi.fn().mockResolvedValue("https://storage.example/upload"),
    };

    __setUploadUrlSignerForTests(signer);

    const request = new Request("http://localhost/api/posts/upload-url", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `auth_session=${token}`,
      },
      body: JSON.stringify({
        fileName: "../../secret.txt",
        contentType: "image/jpeg",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.path).not.toContain("..");
    expect(body.path).toContain("secret.txt");
  });

  it("rejects suspended user", async () => {
    const token = getSharedSessionStore().createSession("student@school.ac.kr");
    getSharedUserModerationStore().suspend("student@school.ac.kr");

    const request = new Request("http://localhost/api/posts/upload-url", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `auth_session=${token}`,
      },
      body: JSON.stringify({
        fileName: "airpods.jpg",
        contentType: "image/jpeg",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      reason: "suspended",
    });
  });
});
