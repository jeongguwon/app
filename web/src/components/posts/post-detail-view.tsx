"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PostType = "lost" | "found";
type PostStatus = "active" | "claiming" | "returned" | "hidden" | "deleted";

interface PostDetail {
  id: string;
  authorEmail: string;
  type: PostType;
  title: string;
  category: string;
  location: string;
  eventAt: string;
  description: string | null;
  photoPaths: string[];
  status: PostStatus;
  storagePlace: string | null;
  secretQuestion?: string | null;
  createdAt: string;
}

interface DetailResponse {
  success: boolean;
  post: PostDetail;
  viewer: {
    isAuthor: boolean;
    canSendMessage?: boolean;
  };
}

interface ClaimSummary {
  id: string;
  postId: string;
  claimantEmail: string;
  path: "owner" | "finder";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface PostMessage {
  id: string;
  postId: string;
  senderEmail: string;
  content: string;
  createdAt: string;
}

type ReportReason =
  | "false_information"
  | "inappropriate_photo"
  | "privacy_exposure"
  | "abuse"
  | "other";

const statusLabel: Record<PostStatus, string> = {
  active: "등록됨",
  claiming: "확인 중",
  returned: "반환 완료",
  hidden: "숨김",
  deleted: "삭제됨",
};

const MESSAGE_QUERY_DEBOUNCE_MS = 200;
const MESSAGE_SENDER_QUERY_KEY = "sender";
const MESSAGE_SEARCH_QUERY_KEY = "q";
const MAX_MESSAGE_FILTER_QUERY_LENGTH = 100;

const EMAIL_QUERY_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeMessageFilterSender = (value: string | null): string => {
  if (!value) {
    return "all";
  }

  const normalized = value.trim().toLocaleLowerCase();

  if (normalized === "all") {
    return "all";
  }

  if (!EMAIL_QUERY_PATTERN.test(normalized)) {
    return "all";
  }

  return normalized;
};

const normalizeMessageFilterQuery = (value: string | null): string => {
  if (!value) {
    return "";
  }

  return value.trim().slice(0, MAX_MESSAGE_FILTER_QUERY_LENGTH);
};

const getMessageFiltersFromLocation = (): { sender: string; query: string } => {
  if (typeof window === "undefined") {
    return { sender: "all", query: "" };
  }

  const searchParams = new URLSearchParams(window.location.search);

  return {
    sender: normalizeMessageFilterSender(searchParams.get(MESSAGE_SENDER_QUERY_KEY)),
    query: normalizeMessageFilterQuery(searchParams.get(MESSAGE_SEARCH_QUERY_KEY)),
  };
};

export function PostDetailView({ postId }: { postId: string }) {
  const initialMessageFilters = getMessageFiltersFromLocation();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editEventAt, setEditEventAt] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStoragePlace, setEditStoragePlace] = useState("");
  const [editSecretQuestion, setEditSecretQuestion] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showOwnerClaimModal, setShowOwnerClaimModal] = useState(false);
  const [ownerSecretAnswer, setOwnerSecretAnswer] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("other");
  const [pendingFinderClaims, setPendingFinderClaims] = useState<ClaimSummary[]>([]);
  const [authorMessages, setAuthorMessages] = useState<PostMessage[]>([]);
  const [selectedSender, setSelectedSender] = useState(initialMessageFilters.sender);
  const [messageQuery, setMessageQuery] = useState(initialMessageFilters.query);
  const [debouncedMessageQuery, setDebouncedMessageQuery] = useState(initialMessageFilters.query);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const toDateTimeLocal = (iso: string): string => {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const pad = (value: number) => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const toIsoFromDateTimeLocal = (value: string): string => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toISOString();
  };

  const loadPendingFinderClaims = useCallback(async () => {
    try {
      const response = await fetch(`/api/posts/${postId}/claims`);

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as { success?: boolean; claims?: ClaimSummary[] };

      if (!body.success || !Array.isArray(body.claims)) {
        return;
      }

      setPendingFinderClaims(body.claims.filter((claim) => claim.path === "finder"));
    } catch {
      // Ignore claim list loading failure and keep detail view usable.
    }
  }, [postId]);

  const loadAuthorMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/posts/${postId}/messages`);

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as { success?: boolean; messages?: PostMessage[] };

      if (!body.success || !Array.isArray(body.messages)) {
        return;
      }

      setAuthorMessages(body.messages);
    } catch {
      // Ignore message list loading failure and keep detail view usable.
    }
  }, [postId]);

  const loadPost = useCallback(async () => {
    try {
      const response = await fetch(`/api/posts/${postId}`);

      if (!response.ok) {
        setErrorMessage("게시글을 찾을 수 없습니다.");
        setPost(null);
        return;
      }

      const body = (await response.json()) as DetailResponse;

      if (!body.success) {
        setErrorMessage("게시글을 찾을 수 없습니다.");
        setPost(null);
        return;
      }

      setPost(body.post);
      setIsAuthor(body.viewer.isAuthor);
      setCanSendMessage(Boolean(body.viewer.canSendMessage));
      setEditTitle(body.post.title);
      setEditCategory(body.post.category);
      setEditLocation(body.post.location);
      setEditEventAt(toDateTimeLocal(body.post.eventAt));
      setEditDescription(body.post.description ?? "");
      setEditStoragePlace(body.post.storagePlace ?? "");
      setEditSecretQuestion(body.post.secretQuestion ?? "");

      if (body.viewer.isAuthor) {
        await loadPendingFinderClaims();
        await loadAuthorMessages();
      }
    } catch {
      setErrorMessage("상세 정보를 불러오지 못했습니다.");
      setPost(null);
    } finally {
      setIsLoading(false);
    }
  }, [loadAuthorMessages, loadPendingFinderClaims, postId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadPost();
  }, [loadPost]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedMessageQuery(messageQuery);
    }, MESSAGE_QUERY_DEBOUNCE_MS);

    return () => {
      clearTimeout(timerId);
    };
  }, [messageQuery]);

  useEffect(() => {
    const handlePopState = () => {
      const nextFilters = getMessageFiltersFromLocation();

      setSelectedSender(nextFilters.sender);
      setMessageQuery(nextFilters.query);
      setDebouncedMessageQuery(nextFilters.query);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    if (selectedSender === "all") {
      searchParams.delete(MESSAGE_SENDER_QUERY_KEY);
    } else {
      searchParams.set(MESSAGE_SENDER_QUERY_KEY, selectedSender);
    }

    const normalizedQuery = normalizeMessageFilterQuery(messageQuery);

    if (normalizedQuery.length === 0) {
      searchParams.delete(MESSAGE_SEARCH_QUERY_KEY);
    } else {
      searchParams.set(MESSAGE_SEARCH_QUERY_KEY, normalizedQuery);
    }

    const queryString = searchParams.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;

    window.history.replaceState(null, "", nextUrl);
  }, [messageQuery, selectedSender]);

  const eventAtLabel = useMemo(() => {
    if (!post) {
      return "";
    }

    const date = new Date(post.eventAt);

    if (Number.isNaN(date.getTime())) {
      return post.eventAt;
    }

    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [post]);

  const sortedAuthorMessages = useMemo(() => {
    return [...authorMessages].sort((left, right) => {
      const leftAt = new Date(left.createdAt).getTime();
      const rightAt = new Date(right.createdAt).getTime();

      return rightAt - leftAt;
    });
  }, [authorMessages]);

  const senderOptions = useMemo(() => {
    return Array.from(new Set(authorMessages.map((message) => message.senderEmail))).sort();
  }, [authorMessages]);

  const filteredAuthorMessages = useMemo(() => {
    const normalizedQuery = debouncedMessageQuery.trim().toLocaleLowerCase();

    return sortedAuthorMessages.filter((message) => {
      if (selectedSender !== "all" && message.senderEmail !== selectedSender) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return message.content.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [debouncedMessageQuery, selectedSender, sortedAuthorMessages]);

  const formatDateTimeLabel = (iso: string): string => {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderHighlightedMessageContent = (content: string) => {
    const normalizedQuery = messageQuery.trim();

    if (normalizedQuery.length === 0) {
      return content;
    }

    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const queryPattern = new RegExp(`(${escapedQuery})`, "gi");
    const segments = content.split(queryPattern);

    return segments.map((segment, index) => {
      if (segment.toLocaleLowerCase() !== normalizedQuery.toLocaleLowerCase()) {
        return <span key={`${segment}-${index}`}>{segment}</span>;
      }

      return (
        <mark key={`${segment}-${index}`} className="rounded bg-amber-200 px-0.5 text-zinc-900">
          {segment}
        </mark>
      );
    });
  };

  const markReturned = async () => {
    if (!post) {
      return;
    }

    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "returned",
        }),
      });

      const body = (await response.json()) as { success?: boolean; post?: PostDetail };

      if (!response.ok || !body.success || !body.post) {
        setErrorMessage("상태 변경에 실패했습니다.");
        return;
      }

      setPost(body.post);
      setInfoMessage("반환 완료로 상태를 변경했습니다.");
    } catch {
      setErrorMessage("상태 변경에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  const startEdit = () => {
    if (!post) {
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setEditTitle(post.title);
    setEditCategory(post.category);
    setEditLocation(post.location);
    setEditEventAt(toDateTimeLocal(post.eventAt));
    setEditDescription(post.description ?? "");
    setEditStoragePlace(post.storagePlace ?? "");
    setEditSecretQuestion(post.secretQuestion ?? "");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setErrorMessage(null);
  };

  const saveEdit = async () => {
    if (!post) {
      return;
    }

    if (!editTitle.trim() || !editCategory.trim() || !editLocation.trim() || !editEventAt.trim()) {
      setErrorMessage("필수 항목을 모두 입력해 주세요.");
      return;
    }

    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const payload: {
        title: string;
        category: string;
        location: string;
        eventAt: string;
        description: string | null;
        storagePlace?: string | null;
        secretQuestion?: string | null;
      } = {
        title: editTitle.trim(),
        category: editCategory.trim(),
        location: editLocation.trim(),
        eventAt: toIsoFromDateTimeLocal(editEventAt),
        description: editDescription.trim() || null,
      };

      if (post.type === "found") {
        payload.storagePlace = editStoragePlace.trim() || null;
        payload.secretQuestion = editSecretQuestion.trim() || null;
      }

      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as { success?: boolean; post?: PostDetail };

      if (!response.ok || !body.success || !body.post) {
        setErrorMessage("수정에 실패했습니다.");
        return;
      }

      setPost(body.post);
      setIsEditing(false);
      setInfoMessage("게시글을 수정했습니다.");
    } catch {
      setErrorMessage("수정에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  const removePost = async () => {
    if (!post) {
      return;
    }

    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
      });

      const body = (await response.json()) as { success?: boolean; post?: PostDetail };

      if (!response.ok || !body.success || !body.post) {
        setErrorMessage("삭제에 실패했습니다.");
        return;
      }

      setPost(body.post);
      setInfoMessage("게시글이 삭제 처리되었습니다.");
    } catch {
      setErrorMessage("삭제에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  const requestClaim = async (path: "owner" | "finder", secretAnswer?: string) => {
    if (!post) {
      return;
    }

    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const payload = path === "owner" ? { path, secretAnswer } : { path };

      const response = await fetch(`/api/posts/${post.id}/claims`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        success?: boolean;
        reason?: string;
        post?: PostDetail;
      };

      if (!response.ok || !body.success) {
        if (body.reason === "invalid_secret_answer") {
          setErrorMessage("식별 답변이 일치하지 않습니다. 다시 시도해 주세요.");
          return;
        }

        if (body.reason === "claim_locked") {
          setErrorMessage("검증 시도 횟수를 초과했습니다. 24시간 후 다시 시도해 주세요.");
          return;
        }

        setErrorMessage("검증 요청에 실패했습니다.");
        return;
      }

      if (body.post) {
        setPost(body.post);
      }

      setInfoMessage(
        path === "owner"
          ? "검증이 완료되어 확인 단계로 전환되었습니다."
          : "습득 확인 요청을 보냈습니다."
      );
    } catch {
      setErrorMessage("검증 요청에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  const reportPost = async (reason: ReportReason) => {
    if (!post) {
      return;
    }

    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const response = await fetch(`/api/posts/${post.id}/reports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason,
        }),
      });

      const body = (await response.json()) as { success?: boolean; reason?: string };

      if (!response.ok || !body.success) {
        if (body.reason === "already_reported") {
          setErrorMessage("이미 신고한 게시글입니다.");
          return;
        }

        setErrorMessage("신고 처리에 실패했습니다.");
        return;
      }

      setInfoMessage("신고가 접수되었습니다.");
    } catch {
      setErrorMessage("신고 처리에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  const submitOwnerClaim = async () => {
    if (!ownerSecretAnswer.trim()) {
      setErrorMessage("식별 답변을 입력해 주세요.");
      return;
    }

    await requestClaim("owner", ownerSecretAnswer.trim());
    setShowOwnerClaimModal(false);
    setOwnerSecretAnswer("");
  };

  const submitReport = async () => {
    await reportPost(reportReason);
    setShowReportModal(false);
  };

  const resolveFinderClaim = async (claimId: string, action: "approve" | "reject") => {
    if (!post) {
      return;
    }

    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const response = await fetch(`/api/posts/${post.id}/claims/${claimId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        reason?: string;
        post?: PostDetail;
      };

      if (!response.ok || !body.success) {
        setErrorMessage("요청 처리에 실패했습니다.");
        return;
      }

      setPendingFinderClaims((prev) => prev.filter((claim) => claim.id !== claimId));

      if (body.post) {
        setPost(body.post);
      }

      setInfoMessage(action === "approve" ? "요청을 승인했습니다." : "요청을 거절했습니다.");
    } catch {
      setErrorMessage("요청 처리에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  const sendMessage = async () => {
    if (!post || !canSendMessage) {
      return;
    }

    const trimmed = messageContent.trim();

    if (trimmed.length < 1 || trimmed.length > 500) {
      setErrorMessage("메시지는 1자 이상 500자 이하로 입력해 주세요.");
      return;
    }

    setInfoMessage(null);
    setErrorMessage(null);
    setIsMutating(true);

    try {
      const response = await fetch(`/api/posts/${post.id}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
        }),
      });

      const body = (await response.json()) as { success?: boolean; reason?: string };

      if (!response.ok || !body.success) {
        if (body.reason === "already_sent") {
          setErrorMessage("메시지는 한 번만 전송할 수 있습니다.");
          return;
        }

        setErrorMessage("메시지 전송에 실패했습니다.");
        return;
      }

      setMessageContent("");
      setCanSendMessage(false);
      setInfoMessage("메시지를 전송했습니다.");
    } catch {
      setErrorMessage("메시지 전송에 실패했습니다.");
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-zinc-600">게시글을 불러오는 중입니다...</p>;
  }

  if (!post) {
    return <p className="text-sm text-red-600">{errorMessage ?? "게시글을 찾을 수 없습니다."}</p>;
  }

  const canMarkReturned = isAuthor && post.status === "active";

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            {post.type === "lost" ? "분실물" : "습득물"}
          </span>
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700">
            상태: {statusLabel[post.status]}
          </span>
        </div>
        {isEditing ? (
          <label className="block space-y-1 text-sm text-zinc-800">
            <span>제목</span>
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        ) : (
          <h1 className="text-2xl font-semibold text-zinc-900">{post.title}</h1>
        )}
      </header>

      {isEditing ? (
        <div className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <label className="block space-y-1 text-sm text-zinc-800">
            <span>카테고리</span>
            <input
              value={editCategory}
              onChange={(event) => setEditCategory(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm text-zinc-800">
            <span>장소</span>
            <input
              value={editLocation}
              onChange={(event) => setEditLocation(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm text-zinc-800">
            <span>일시</span>
            <input
              type="datetime-local"
              value={editEventAt}
              onChange={(event) => setEditEventAt(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          {post.type === "found" ? (
            <label className="block space-y-1 text-sm text-zinc-800">
              <span>보관 장소</span>
              <input
                value={editStoragePlace}
                onChange={(event) => setEditStoragePlace(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <p>
            <span className="font-medium text-zinc-900">카테고리</span>: {post.category}
          </p>
          <p>
            <span className="font-medium text-zinc-900">장소</span>: {post.location}
          </p>
          <p>
            <span className="font-medium text-zinc-900">일시</span>: {eventAtLabel}
          </p>
          {post.storagePlace ? (
            <p>
              <span className="font-medium text-zinc-900">보관 장소</span>: {post.storagePlace}
            </p>
          ) : null}
        </div>
      )}

      {isEditing ? (
        <label className="block space-y-1 text-sm text-zinc-800">
          <span>설명</span>
          <textarea
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
            rows={3}
          />
        </label>
      ) : post.description ? (
        <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{post.description}</p>
      ) : null}

      {post.photoPaths.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-900">사진</p>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {post.photoPaths.map((path) => (
              <div
                key={path}
                className="min-w-[220px] snap-start rounded-xl border border-zinc-200 bg-zinc-100 p-3 text-xs text-zinc-600"
              >
                {path}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isAuthor ? (
        isEditing && post.type === "found" ? (
          <label className="block space-y-1 text-sm text-zinc-800">
            <span>비공개 식별 질문</span>
            <input
              value={editSecretQuestion}
              onChange={(event) => setEditSecretQuestion(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        ) : post.secretQuestion ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            비공개 식별 질문: {post.secretQuestion}
          </p>
        ) : null
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isAuthor ? (
          <>
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
                  onClick={cancelEdit}
                  disabled={isMutating}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  onClick={() => {
                    void saveEdit();
                  }}
                  disabled={isMutating || post.status === "deleted"}
                >
                  저장
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
                  onClick={startEdit}
                  disabled={isMutating || post.status === "deleted"}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                  onClick={() => {
                    void removePost();
                  }}
                  disabled={isMutating || post.status === "deleted"}
                >
                  삭제
                </button>
                <button
                  type="button"
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  onClick={() => {
                    void markReturned();
                  }}
                  disabled={isMutating || !canMarkReturned}
                >
                  완료 처리
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-60"
              onClick={() => {
                setErrorMessage(null);
                setShowOwnerClaimModal(true);
              }}
              disabled={isMutating || post.status !== "active"}
            >
              내 물건 같아요
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-60"
              onClick={() => {
                void requestClaim("finder");
              }}
              disabled={isMutating || post.status !== "active"}
            >
              이거 제가 주웠어요
            </button>
            <button
              type="button"
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
              onClick={() => {
                setErrorMessage(null);
                setShowReportModal(true);
              }}
              disabled={isMutating}
            >
              신고
            </button>
          </>
        )}
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {infoMessage ? <p className="text-sm text-emerald-700">{infoMessage}</p> : null}
      {isAuthor ? (
        <Link
          href="/me"
          className="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          홈으로 돌아가기
        </Link>
      ) : null}

      {isAuthor && pendingFinderClaims.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-900">대기 중 습득 확인 요청</p>
          <ul className="mt-3 space-y-2">
            {pendingFinderClaims
              .filter((claim) => claim.status === "pending")
              .map((claim) => (
                <li
                  key={claim.id}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xs text-zinc-700">요청자: {claim.claimantEmail}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-60"
                      onClick={() => {
                        void resolveFinderClaim(claim.id, "reject");
                      }}
                      disabled={isMutating}
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                      onClick={() => {
                        void resolveFinderClaim(claim.id, "approve");
                      }}
                      disabled={isMutating}
                    >
                      승인
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {isAuthor ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-900">클레이머 메시지</p>
            {authorMessages.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <span>발신자</span>
                <select
                  aria-label="발신자 필터"
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800"
                  value={selectedSender}
                  onChange={(event) => setSelectedSender(event.target.value)}
                >
                  <option value="all">전체</option>
                  {senderOptions.map((sender) => (
                    <option key={sender} value={sender}>
                      {sender}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {authorMessages.length > 0 ? (
            <label className="mt-2 block space-y-1 text-xs text-zinc-700">
              <span>메시지 검색</span>
              <input
                aria-label="메시지 검색"
                value={messageQuery}
                onChange={(event) =>
                  setMessageQuery(normalizeMessageFilterQuery(event.target.value))
                }
                placeholder="메시지 내용으로 검색"
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800"
                maxLength={MAX_MESSAGE_FILTER_QUERY_LENGTH}
              />
            </label>
          ) : null}
          {authorMessages.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">아직 도착한 메시지가 없습니다.</p>
          ) : filteredAuthorMessages.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">조건에 맞는 메시지가 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {filteredAuthorMessages.map((message) => (
                <li key={message.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-xs text-zinc-500">보낸 사람: {message.senderEmail}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    전송 시각: {formatDateTimeLabel(message.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-800">
                    {renderHighlightedMessageContent(message.content)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!isAuthor && canSendMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">작성자에게 메시지 1회를 보낼 수 있습니다.</p>
          <textarea
            aria-label="작성자에게 보낼 메시지"
            value={messageContent}
            onChange={(event) => setMessageContent(event.target.value)}
            className="mt-2 w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-950"
            rows={3}
            maxLength={500}
          />
          <div className="mt-1 text-right text-xs text-emerald-700">{messageContent.length}/500</div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              onClick={() => {
                void sendMessage();
              }}
              disabled={
                isMutating || messageContent.trim().length < 1 || messageContent.trim().length > 500
              }
            >
              메시지 전송
            </button>
          </div>
        </div>
      ) : null}

      {showOwnerClaimModal ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-900">비공개 식별 답변을 입력해 주세요.</p>
          <input
            aria-label="비공개 식별 답변 입력"
            value={ownerSecretAnswer}
            onChange={(event) => setOwnerSecretAnswer(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800"
              onClick={() => {
                setShowOwnerClaimModal(false);
                setOwnerSecretAnswer("");
              }}
              disabled={isMutating}
            >
              취소
            </button>
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              onClick={() => {
                void submitOwnerClaim();
              }}
              disabled={isMutating}
            >
              검증 요청
            </button>
          </div>
        </div>
      ) : null}

      {showReportModal ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">신고 사유를 선택해 주세요.</p>
          <select
            aria-label="신고 사유"
            className="mt-2 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-900"
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value as ReportReason)}
          >
            <option value="false_information">허위</option>
            <option value="inappropriate_photo">부적절 사진</option>
            <option value="privacy_exposure">개인정보 노출</option>
            <option value="abuse">욕설</option>
            <option value="other">기타</option>
          </select>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800"
              onClick={() => setShowReportModal(false)}
              disabled={isMutating}
            >
              취소
            </button>
            <button
              type="button"
              className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              onClick={() => {
                void submitReport();
              }}
              disabled={isMutating}
            >
              신고 접수
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
