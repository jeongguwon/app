import { afterEach, describe, expect, it, vi } from "vitest";

import { __setOtpSenderForTests, __resetOtpSenderForTests, POST } from "@/app/api/auth/otp/route";

describe("POST /api/auth/otp", () => {
  afterEach(() => {
    __resetOtpSenderForTests();
    delete process.env.ALLOWED_EMAIL_DOMAINS;
  });

  it("returns success response for whitelisted school email", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";
    const sender = {
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    __setOtpSenderForTests(sender);

    const request = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "user@school.ac.kr" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      expiresIn: 300,
    });
    expect(sender.sendOtp).toHaveBeenCalledTimes(1);
  });

  it("returns generic invalid response for malformed body", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    const request = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ wrong: "field" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("returns generic invalid response for non-whitelisted domain", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    const request = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "user@gmail.com" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("returns generic invalid response when body is not valid JSON", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    const request = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: "{email:bad-json}",
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("uses default sender path when no test sender is injected", async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "school.ac.kr";

    const request = new Request("http://localhost/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "default@school.ac.kr" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      expiresIn: 300,
    });
  });
});
