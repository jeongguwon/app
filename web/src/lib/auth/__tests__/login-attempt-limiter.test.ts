import { describe, expect, it } from "vitest";

import {
  __clearLoginAttemptStoreForTests,
  LoginAttemptLimiter,
} from "@/lib/auth/login-attempt-limiter";

describe("LoginAttemptLimiter", () => {
  it("locks after 5 failures and unlocks after 15 minutes", () => {
    let now = 1_000;
    const limiter = new LoginAttemptLimiter({
      maxFailures: 5,
      lockSeconds: 900,
      now: () => now,
    });

    for (let i = 0; i < 4; i += 1) {
      limiter.recordFailure("user@school.ac.kr");
      expect(limiter.isLocked("user@school.ac.kr")).toBe(false);
    }

    limiter.recordFailure("user@school.ac.kr");
    expect(limiter.isLocked("user@school.ac.kr")).toBe(true);

    now = 1_000 + 899_000;
    expect(limiter.isLocked("user@school.ac.kr")).toBe(true);

    now = 1_000 + 900_000;
    expect(limiter.isLocked("user@school.ac.kr")).toBe(false);
  });

  it("resets failure counter on success", () => {
    __clearLoginAttemptStoreForTests();

    const limiter = new LoginAttemptLimiter({
      maxFailures: 5,
      lockSeconds: 900,
      now: Date.now,
    });

    limiter.recordFailure("user@school.ac.kr");
    limiter.recordFailure("user@school.ac.kr");
    limiter.reset("user@school.ac.kr");

    expect(limiter.isLocked("user@school.ac.kr")).toBe(false);
  });
});
