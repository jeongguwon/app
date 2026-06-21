import { afterEach, describe, expect, it, vi } from "vitest";

import { __setOtpSenderForTests, __resetOtpSenderForTests, POST as issueOtp } from "@/app/api/auth/otp/route";
import { POST as verifyOtp } from "@/app/api/auth/otp/verify/route";
import { __clearOtpStoreForTests } from "@/lib/auth/otp";
import { __clearLoginAttemptStoreForTests } from "@/lib/auth/login-attempt-limiter";
import { __clearSessionStoreForTests } from "@/lib/auth/session";

describe("POST /api/auth/otp/verify", () => {
  afterEach(() => {
    __resetOtpSenderForTests();
    __clearOtpStoreForTests();
    __clearLoginAttemptStoreForTests();
    __clearSessionStoreForTests();
    delete process.env.ALLOWED_EMAIL_DOMAINS;
  });

  it("returns success and sets session cookie for valid email/code", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    let sentCode = "";
    __setOtpSenderForTests({
      sendOtp: vi.fn(async (_email: string, code: string) => {
        sentCode = code;
      }),
    });

    const issueRequest = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "user@school.ac.kr" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const issueResponse = await issueOtp(issueRequest);
    expect(issueResponse.status).toBe(200);

    const verifyRequest = new Request("http://localhost/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@school.ac.kr", code: sentCode }),
      headers: {
        "content-type": "application/json",
      },
    });

    const verifyResponse = await verifyOtp(verifyRequest);
    const body = await verifyResponse.json();

    expect(verifyResponse.status).toBe(200);
    expect(body).toEqual({ success: true });

    const cookieHeader = verifyResponse.headers.get("set-cookie");
    expect(cookieHeader).toContain("auth_session=");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Lax");
  });

  it("returns generic invalid response for wrong code", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    __setOtpSenderForTests({
      sendOtp: vi.fn().mockResolvedValue(undefined),
    });

    const issueRequest = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "user@school.ac.kr" }),
      headers: {
        "content-type": "application/json",
      },
    });

    await issueOtp(issueRequest);

    const verifyRequest = new Request("http://localhost/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@school.ac.kr", code: "000000" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const verifyResponse = await verifyOtp(verifyRequest);
    const body = await verifyResponse.json();

    expect(verifyResponse.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
    expect(verifyResponse.headers.get("set-cookie")).toBeNull();
  });

  it("returns generic invalid response for malformed body", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    const verifyRequest = new Request("http://localhost/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@school.ac.kr" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const verifyResponse = await verifyOtp(verifyRequest);
    const body = await verifyResponse.json();

    expect(verifyResponse.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("locks verification for 15 minutes after 5 failed attempts", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    let sentCode = "";
    __setOtpSenderForTests({
      sendOtp: vi.fn(async (_email: string, code: string) => {
        sentCode = code;
      }),
    });

    const issueRequest = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "lock@school.ac.kr" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const issueResponse = await issueOtp(issueRequest);
    expect(issueResponse.status).toBe(200);

    for (let i = 0; i < 5; i += 1) {
      const wrongVerifyRequest = new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "lock@school.ac.kr", code: "000000" }),
        headers: {
          "content-type": "application/json",
        },
      });

      const wrongVerifyResponse = await verifyOtp(wrongVerifyRequest);
      expect(wrongVerifyResponse.status).toBe(400);
    }

    const correctVerifyRequest = new Request("http://localhost/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "lock@school.ac.kr", code: sentCode }),
      headers: {
        "content-type": "application/json",
      },
    });

    const correctVerifyResponse = await verifyOtp(correctVerifyRequest);
    const correctBody = await correctVerifyResponse.json();

    expect(correctVerifyResponse.status).toBe(400);
    expect(correctBody).toEqual({
      success: false,
      reason: "invalid_request",
    });
    expect(correctVerifyResponse.headers.get("set-cookie")).toBeNull();
  });
});
