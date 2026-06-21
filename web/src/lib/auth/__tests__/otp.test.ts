import { describe, expect, it, vi } from "vitest";

import { __clearOtpStoreForTests, OtpService, generateOtpCode } from "@/lib/auth/otp";

describe("generateOtpCode", () => {
  it("always returns a 6-digit numeric code", () => {
    for (let i = 0; i < 100; i += 1) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("OtpService.issue", () => {
  const allowedDomains = ["school.ac.kr", "edu.school.ac.kr"];

  it("verifies a matching OTP code and invalidates it after success", async () => {
    __clearOtpStoreForTests();
    const sender = {
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OtpService({
      allowedDomains,
      sender,
      generateCode: () => "123456",
      now: () => 1_000,
      ttlSeconds: 300,
    });

    await service.issue("student@school.ac.kr");
    const firstVerify = await service.verify("student@school.ac.kr", "123456");
    const secondVerify = await service.verify("student@school.ac.kr", "123456");

    expect(firstVerify).toEqual({ success: true });
    expect(secondVerify).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("rejects wrong OTP code with generic invalid response", async () => {
    __clearOtpStoreForTests();
    const sender = {
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OtpService({
      allowedDomains,
      sender,
      generateCode: () => "123456",
      now: () => 1_000,
      ttlSeconds: 300,
    });

    await service.issue("student@school.ac.kr");
    const verifyResult = await service.verify("student@school.ac.kr", "111111");

    expect(verifyResult).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("rejects expired OTP code", async () => {
    __clearOtpStoreForTests();
    const sender = {
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    let currentTime = 1_000;
    const service = new OtpService({
      allowedDomains,
      sender,
      generateCode: () => "123456",
      now: () => currentTime,
      ttlSeconds: 300,
    });

    await service.issue("student@school.ac.kr");
    currentTime = 1_000 + 301_000;
    const verifyResult = await service.verify("student@school.ac.kr", "123456");

    expect(verifyResult).toEqual({
      success: false,
      reason: "invalid_request",
    });
  });

  it("issues OTP when email domain is whitelisted", async () => {
    const sender = {
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OtpService({ allowedDomains, sender });

    const result = await service.issue("student@school.ac.kr");

    expect(result).toEqual({
      success: true,
      expiresIn: 300,
    });
    expect(sender.sendOtp).toHaveBeenCalledTimes(1);
    expect(sender.sendOtp).toHaveBeenCalledWith(
      "student@school.ac.kr",
      expect.stringMatching(/^\d{6}$/),
      300
    );
  });

  it("returns generic invalid response for non-whitelisted domains", async () => {
    const sender = {
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OtpService({ allowedDomains, sender });

    const result = await service.issue("user@gmail.com");

    expect(result).toEqual({
      success: false,
      reason: "invalid_request",
    });
    expect(sender.sendOtp).not.toHaveBeenCalled();
  });

  it("returns generic invalid response for malformed email", async () => {
    const sender = {
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OtpService({ allowedDomains, sender });

    const result = await service.issue("not-an-email");

    expect(result).toEqual({
      success: false,
      reason: "invalid_request",
    });
    expect(sender.sendOtp).not.toHaveBeenCalled();
  });
});
