import { describe, expect, it } from "vitest";

import { validateSchoolEmailDomain } from "@/lib/auth/domain";

describe("validateSchoolEmailDomain", () => {
  const whitelist = ["school.ac.kr", "edu.school.ac.kr"];

  it("allows a whitelisted domain", () => {
    const result = validateSchoolEmailDomain("student@school.ac.kr", whitelist);

    expect(result).toEqual({
      isValid: true,
      domain: "school.ac.kr",
    });
  });

  it("normalizes case and whitespace", () => {
    const result = validateSchoolEmailDomain("  USER@SCHOOL.AC.KR  ", whitelist);

    expect(result).toEqual({
      isValid: true,
      domain: "school.ac.kr",
    });
  });

  it("rejects an empty email", () => {
    const result = validateSchoolEmailDomain("", whitelist);

    expect(result).toEqual({
      isValid: false,
      domain: null,
      error: "EMPTY_EMAIL",
    });
  });

  it("rejects malformed emails", () => {
    const result = validateSchoolEmailDomain("not-an-email", whitelist);

    expect(result).toEqual({
      isValid: false,
      domain: null,
      error: "INVALID_FORMAT",
    });
  });

  it("rejects emails with multiple at symbols", () => {
    const result = validateSchoolEmailDomain("user@fake@school.ac.kr", whitelist);

    expect(result).toEqual({
      isValid: false,
      domain: null,
      error: "INVALID_FORMAT",
    });
  });

  it("rejects non-whitelisted domains", () => {
    const result = validateSchoolEmailDomain("user@gmail.com", whitelist);

    expect(result).toEqual({
      isValid: false,
      domain: null,
      error: "DOMAIN_NOT_WHITELISTED",
    });
  });

  it("rejects empty whitelist", () => {
    const result = validateSchoolEmailDomain("student@school.ac.kr", []);

    expect(result).toEqual({
      isValid: false,
      domain: null,
      error: "EMPTY_WHITELIST",
    });
  });

  it("rejects typo-squatting style domains", () => {
    const result = validateSchoolEmailDomain("user@schooll.ac.kr", whitelist);

    expect(result).toEqual({
      isValid: false,
      domain: null,
      error: "DOMAIN_NOT_WHITELISTED",
    });
  });

  it("rejects subdomain attacks unless explicitly allowed", () => {
    const result = validateSchoolEmailDomain("user@attacker.school.ac.kr", whitelist);

    expect(result).toEqual({
      isValid: false,
      domain: null,
      error: "DOMAIN_NOT_WHITELISTED",
    });
  });
});
