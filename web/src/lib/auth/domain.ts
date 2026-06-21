export type DomainValidationError =
  | "EMPTY_EMAIL"
  | "INVALID_FORMAT"
  | "DOMAIN_NOT_WHITELISTED"
  | "EMPTY_WHITELIST";

const DOMAIN_ERRORS = {
  EMPTY_EMAIL: "EMPTY_EMAIL",
  INVALID_FORMAT: "INVALID_FORMAT",
  DOMAIN_NOT_WHITELISTED: "DOMAIN_NOT_WHITELISTED",
  EMPTY_WHITELIST: "EMPTY_WHITELIST",
} as const;

export type DomainValidationResult =
  | {
      isValid: true;
      domain: string;
    }
  | {
      isValid: false;
      domain: null;
      error: DomainValidationError;
    };

function extractDomain(normalizedEmail: string): string | null {
  const parts = normalizedEmail.split("@");

  if (parts.length !== 2 || parts.some((part) => !part)) {
    return null;
  }

  return parts[1];
}

export function validateSchoolEmailDomain(
  email: string,
  whitelist: string[]
): DomainValidationResult {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return { isValid: false, domain: null, error: DOMAIN_ERRORS.EMPTY_EMAIL };
  }

  if (whitelist.length === 0) {
    return {
      isValid: false,
      domain: null,
      error: DOMAIN_ERRORS.EMPTY_WHITELIST,
    };
  }

  const normalizedEmail = trimmedEmail.toLowerCase();
  const domain = extractDomain(normalizedEmail);

  if (!domain) {
    return { isValid: false, domain: null, error: DOMAIN_ERRORS.INVALID_FORMAT };
  }

  const allowedDomains = whitelist.map((item) => item.trim().toLowerCase());

  if (!allowedDomains.includes(domain)) {
    return {
      isValid: false,
      domain: null,
      error: DOMAIN_ERRORS.DOMAIN_NOT_WHITELISTED,
    };
  }

  return { isValid: true, domain };
}
