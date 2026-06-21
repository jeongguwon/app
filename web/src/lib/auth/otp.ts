import { validateSchoolEmailDomain } from "@/lib/auth/domain";

export interface OtpSender {
  sendOtp(email: string, code: string, ttlSeconds: number): Promise<void>;
}

interface OtpRecord {
  code: string;
  expiresAtMs: number;
}

interface OtpStore {
  set(email: string, record: OtpRecord): void;
  get(email: string): OtpRecord | undefined;
  delete(email: string): void;
  clear(): void;
}

class InMemoryOtpStore implements OtpStore {
  private readonly records = new Map<string, OtpRecord>();

  set(email: string, record: OtpRecord): void {
    this.records.set(email, record);
  }

  get(email: string): OtpRecord | undefined {
    return this.records.get(email);
  }

  delete(email: string): void {
    this.records.delete(email);
  }

  clear(): void {
    this.records.clear();
  }
}

const otpStore = new InMemoryOtpStore();

export type OtpIssueResult =
  | {
      success: true;
      expiresIn: number;
    }
  | {
      success: false;
      reason: "invalid_request";
    };

export type OtpVerifyResult =
  | {
      success: true;
    }
  | {
      success: false;
      reason: "invalid_request";
    };

interface OtpServiceOptions {
  allowedDomains: string[];
  sender?: OtpSender;
  ttlSeconds?: number;
  now?: () => number;
  generateCode?: () => string;
  store?: OtpStore;
}

export function generateOtpCode(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

export class OtpService {
  private readonly allowedDomains: string[];
  private readonly sender?: OtpSender;
  private readonly ttlSeconds: number;
  private readonly now: () => number;
  private readonly generateCode: () => string;
  private readonly store: OtpStore;

  constructor(options: OtpServiceOptions) {
    this.allowedDomains = options.allowedDomains;
    this.sender = options.sender;
    this.ttlSeconds = options.ttlSeconds ?? 300;
    this.now = options.now ?? Date.now;
    this.generateCode = options.generateCode ?? generateOtpCode;
    this.store = options.store ?? otpStore;
  }

  async issue(rawEmail: string): Promise<OtpIssueResult> {
    const email = rawEmail.trim().toLowerCase();
    const validation = validateSchoolEmailDomain(email, this.allowedDomains);

    if (!validation.isValid || !this.sender) {
      return { success: false, reason: "invalid_request" };
    }

    const code = this.generateCode();
    const expiresAtMs = this.now() + this.ttlSeconds * 1_000;

    this.store.set(email, {
      code,
      expiresAtMs,
    });

    await this.sender.sendOtp(email, code, this.ttlSeconds);

    return {
      success: true,
      expiresIn: this.ttlSeconds,
    };
  }

  async verify(rawEmail: string, rawCode: string): Promise<OtpVerifyResult> {
    const email = rawEmail.trim().toLowerCase();
    const code = rawCode.trim();
    const validation = validateSchoolEmailDomain(email, this.allowedDomains);

    if (!validation.isValid || !/^\d{6}$/.test(code)) {
      return { success: false, reason: "invalid_request" };
    }

    const record = this.store.get(email);

    if (!record) {
      return { success: false, reason: "invalid_request" };
    }

    if (record.expiresAtMs < this.now()) {
      this.store.delete(email);
      return { success: false, reason: "invalid_request" };
    }

    if (record.code !== code) {
      return { success: false, reason: "invalid_request" };
    }

    this.store.delete(email);
    return { success: true };
  }
}

export function __clearOtpStoreForTests(): void {
  otpStore.clear();
}
