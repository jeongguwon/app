"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PhotoUploader } from "@/components/upload/photo-uploader";

type PostType = "lost" | "found";

interface PostCreatePayload {
  type: PostType;
  title: string;
  category: string;
  location: string;
  eventAt: string;
  description?: string;
  photoPaths: string[];
  storagePlace?: string;
  secretQuestion?: string;
  secretAnswer?: string;
}

export function PostCreateForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<PostType>("lost");
  const [files, setFiles] = useState<File[]>([]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [description, setDescription] = useState("");

  const [storagePlace, setStoragePlace] = useState("");
  const [secretQuestion, setSecretQuestion] = useState("");
  const [secretAnswer, setSecretAnswer] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForbiddenModal, setShowForbiddenModal] = useState(false);

  const forbiddenCategories = ["현금", "신분증", "의약품"];

  const photoPaths = useMemo(() => files.map((file) => `local://${file.name}`), [files]);

  const toIsoFromDateTimeLocal = (value: string): string => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toISOString();
  };

  const handleSubmit = async (skipForbiddenCheck = false) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!title.trim() || !category.trim() || !location.trim() || !eventAt.trim()) {
      setErrorMessage("필수 항목을 모두 입력해 주세요.");
      return;
    }

    if (type === "found" && (!storagePlace.trim() || !secretQuestion.trim() || !secretAnswer.trim())) {
      setErrorMessage("습득물은 보관 장소와 비공개 식별 질문이 필요합니다.");
      return;
    }

    const normalizedCategory = category.trim();

    if (!skipForbiddenCheck && forbiddenCategories.includes(normalizedCategory)) {
      setShowForbiddenModal(true);
      return;
    }

    const payload: PostCreatePayload = {
      type,
      title: title.trim(),
      category: normalizedCategory,
      location: location.trim(),
      eventAt: toIsoFromDateTimeLocal(eventAt),
      description: description.trim() || undefined,
      photoPaths,
      storagePlace: type === "found" ? storagePlace.trim() : undefined,
      secretQuestion: type === "found" ? secretQuestion.trim() : undefined,
      secretAnswer: type === "found" ? secretAnswer.trim() : undefined,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        success?: boolean;
        reason?: string;
      };

      if (!response.ok || !body.success) {
        if (body.reason === "rate_limited") {
          setErrorMessage("등록 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }

        setErrorMessage("등록에 실패했습니다. 입력값을 확인해 주세요.");
        return;
      }

      setSuccessMessage("등록이 완료되었습니다.");
      setShowForbiddenModal(false);
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">분실물/습득물 등록</h1>

      {step === 1 ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-zinc-700">등록 단계 1/2</p>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-800">종류</legend>
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="radio"
                name="post-type"
                value="lost"
                checked={type === "lost"}
                onChange={() => setType("lost")}
              />
              분실물
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="radio"
                name="post-type"
                value="found"
                checked={type === "found"}
                onChange={() => setType("found")}
              />
              습득물
            </label>
          </fieldset>

          <PhotoUploader onChange={setFiles} />

          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setStep(2)}
            >
              다음
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-zinc-700">등록 단계 2/2</p>

          <label className="block space-y-1 text-sm text-zinc-800">
            <span>제목</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="block space-y-1 text-sm text-zinc-800">
            <span>카테고리</span>
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="block space-y-1 text-sm text-zinc-800">
            <span>장소</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="block space-y-1 text-sm text-zinc-800">
            <span>일시</span>
            <input
              type="datetime-local"
              value={eventAt}
              onChange={(event) => setEventAt(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="block space-y-1 text-sm text-zinc-800">
            <span>설명</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
              rows={3}
            />
          </label>

          {type === "found" ? (
            <>
              <label className="block space-y-1 text-sm text-zinc-800">
                <span>보관 장소</span>
                <input
                  value={storagePlace}
                  onChange={(event) => setStoragePlace(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>

              <label className="block space-y-1 text-sm text-zinc-800">
                <span>비공개 식별 질문</span>
                <input
                  value={secretQuestion}
                  onChange={(event) => setSecretQuestion(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>

              <label className="block space-y-1 text-sm text-zinc-800">
                <span>비공개 식별 답변</span>
                <input
                  value={secretAnswer}
                  onChange={(event) => setSecretAnswer(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>
            </>
          ) : null}

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {successMessage ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-emerald-700">{successMessage}</p>
              <Link
                href="/me"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                홈으로 돌아가기
              </Link>
            </div>
          ) : null}

          {showForbiddenModal ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">금지 물품은 행정실로 전달해 주세요.</p>
              <p className="mt-1 text-xs text-amber-800">
                안전을 위해 앱 등록 전에 학교 행정실에 먼저 인계하는 것을 권장합니다.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-900"
                  onClick={() => setShowForbiddenModal(false)}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => {
                    setShowForbiddenModal(false);
                    void handleSubmit(true);
                  }}
                  disabled={isSubmitting}
                >
                  확인하고 등록
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
              onClick={() => setStep(1)}
              disabled={isSubmitting}
            >
              이전
            </button>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitting}
            >
              등록
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
