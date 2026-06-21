import { OtpSender, OtpService } from "@/lib/auth/otp";

const defaultSender: OtpSender = {
  async sendOtp(email: string, code: string): Promise<void> {
    // 개발 환경에서는 콘솔에 OTP 코드를 출력합니다.
    // 실제 서비스 배포 시에는 이메일 발송 로직으로 교체하세요.
    console.log(`[OTP] ${email} → 코드: ${code}`);
  },
};

let otpSender: OtpSender = defaultSender;

export function __setOtpSenderForTests(sender: OtpSender): void {
  otpSender = sender;
}

export function __resetOtpSenderForTests(): void {
  otpSender = defaultSender;
}

function getAllowedDomainsFromEnv(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS ?? "";

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();

    if (!body || typeof body.email !== "string") {
      return Response.json(
        {
          success: false,
          reason: "invalid_request",
        },
        {
          status: 400,
        }
      );
    }

    const service = new OtpService({
      allowedDomains: getAllowedDomainsFromEnv(),
      sender: otpSender,
    });

    const result = await service.issue(body.email);

    if (!result.success) {
      return Response.json(result, { status: 400 });
    }

    return Response.json(result, { status: 200 });
  } catch {
    return Response.json(
      {
        success: false,
        reason: "invalid_request",
      },
      {
        status: 400,
      }
    );
  }
}
