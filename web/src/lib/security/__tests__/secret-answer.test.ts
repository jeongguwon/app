import { describe, expect, it } from "vitest";

import { hashSecretAnswer, verifySecretAnswer } from "@/lib/security/secret-answer";

describe("secret answer hashing", () => {
  it("hashes answer with bcrypt and verifies match", async () => {
    const answer = "Minsu";

    const hash = await hashSecretAnswer(answer);

    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toBe(answer);

    const isMatch = await verifySecretAnswer(answer, hash);
    expect(isMatch).toBe(true);
  });

  it("rejects non-matching answer", async () => {
    const hash = await hashSecretAnswer("Minsu");

    const isMatch = await verifySecretAnswer("Wrong", hash);
    expect(isMatch).toBe(false);
  });
});
