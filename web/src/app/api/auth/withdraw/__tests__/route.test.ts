import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetOtpSenderForTests, __setOtpSenderForTests, POST as issueOtp } from "@/app/api/auth/otp/route";
import { POST as verifyOtp } from "@/app/api/auth/otp/verify/route";
import { POST as withdraw } from "@/app/api/auth/withdraw/route";
import { __clearOtpStoreForTests } from "@/lib/auth/otp";
import { __clearLoginAttemptStoreForTests } from "@/lib/auth/login-attempt-limiter";
import { __clearSessionStoreForTests } from "@/lib/auth/session";

describe("POST /api/auth/withdraw", () => {
  afterEach(() => {
    __resetOtpSenderForTests();
    __clearOtpStoreForTests();
    __clearLoginAttemptStoreForTests();
    __clearSessionStoreForTests();
    delete process.env.ALLOWED_EMAIL_DOMAINS;
  });

  it("withdraws an authenticated user and invalidates session", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    let sentCode = "";
    __setOtpSenderForTests({
      sendOtp: vi.fn(async (_email: string, code: string) => {
        sentCode = code;
      }),
    });

    const issueRequest = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "member@school.ac.kr" }),
      headers: {
        "content-type": "application/json",
      },
    });
    await issueOtp(issueRequest);

    const verifyRequest = new Request("http://localhost/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "member@school.ac.kr", code: sentCode }),
      headers: {
        "content-type": "application/json",
      },
    });

    const verifyResponse = await verifyOtp(verifyRequest);
    expect(verifyResponse.status).toBe(200);

    const sessionCookie = verifyResponse.headers.get("set-cookie");
    expect(sessionCookie).toContain("auth_session=");

    const withdrawRequest = new Request("http://localhost/api/auth/withdraw", {
      method: "POST",
      headers: {
        cookie: sessionCookie ?? "",
      },
    });

    const withdrawResponse = await withdraw(withdrawRequest);
    const body = await withdrawResponse.json();

    expect(withdrawResponse.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(withdrawResponse.headers.get("set-cookie")).toContain("Max-Age=0");

    const secondWithdraw = await withdraw(withdrawRequest);
    expect(secondWithdraw.status).toBe(400);
  });

  it("returns generic invalid response without session", async () => {
    const request = new Request("http://localhost/api/auth/withdraw", {
      method: "POST",
    });

    const response = await withdraw(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });
});
