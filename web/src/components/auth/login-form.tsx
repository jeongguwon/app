"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "email" | "otp";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const body = (await response.json()) as {
        success: boolean;
        reason?: string;
        expiresIn?: number;
      };

      if (!body.success) {
        setErrorMessage("이메일 주소를 확인해 주세요. 허용된 도메인만 사용 가능합니다.");
        return;
      }

      setExpiresIn(body.expiresIn ?? 300);
      setStep("otp");
    } catch {
      setErrorMessage("요청 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });

      const body = (await response.json()) as { success: boolean };

      if (!body.success) {
        setErrorMessage("인증 코드가 올바르지 않습니다. 다시 확인해 주세요.");
        return;
      }

      router.push("/me");
      router.refresh();
    } catch {
      setErrorMessage("요청 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900">로그인</h1>
        <p className="mb-8 text-sm text-zinc-500">
          {step === "email"
            ? "학교 이메일을 입력하면 인증 코드를 보내드립니다."
            : `${email} 로 발송된 6자리 코드를 입력해 주세요.`}
        </p>

        {errorMessage ? (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}

        {step === "email" ? (
          <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@school.ac.kr"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {isLoading ? "전송 중..." : "인증 코드 받기"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleOtpSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="code" className="block text-sm font-medium text-zinc-700">
                인증 코드
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6자리 숫자"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xl font-semibold tracking-[0.5em] text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
              {expiresIn ? (
                <p className="text-xs text-zinc-400">코드 유효 시간: {Math.floor(expiresIn / 60)}분</p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {isLoading ? "확인 중..." : "로그인"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setErrorMessage(null);
              }}
              className="w-full text-center text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
            >
              이메일 다시 입력
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
