"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PostSummary {
  id: string;
  type: "lost" | "found";
  title: string;
  category: string;
  location: string;
  status: string;
  createdAt: string;
}

interface MatchClaim {
  id: string;
  path: "owner" | "finder";
  status: "approved" | "pending" | "rejected";
  claimantEmail: string;
  createdAt: string;
  post: Pick<PostSummary, "id" | "title" | "status" | "type">;
}

interface NotificationItem {
  id: string;
  type:
    | "claim_received"
    | "claim_approved"
    | "claim_rejected"
    | "message_received"
    | "report_processed";
  title: string;
  body: string;
  postId: string | null;
  createdAt: string;
}

interface NotificationSetting {
  enabled: boolean;
  updatedAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "등록됨",
  claiming: "확인 중",
  returned: "반환 완료",
  hidden: "숨김",
  deleted: "삭제됨",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  claiming: "bg-amber-100 text-amber-800",
  returned: "bg-blue-100 text-blue-800",
  hidden: "bg-zinc-200 text-zinc-600",
  deleted: "bg-red-100 text-red-600",
};

export function MyPage() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [attemptedClaims, setAttemptedClaims] = useState<MatchClaim[]>([]);
  const [receivedClaims, setReceivedClaims] = useState<MatchClaim[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationSetting, setNotificationSetting] = useState<NotificationSetting>({
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  });
  const [isSavingNotificationSetting, setIsSavingNotificationSetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "claiming" | "returned">("all");

  const loadMyPageData = useCallback(async () => {
    try {
      const [postsResponse, matchesResponse, notificationsResponse, settingsResponse] = await Promise.all([
        fetch("/api/posts?mine=true"),
        fetch("/api/me/matches"),
        fetch("/api/me/notifications"),
        fetch("/api/me/notification-settings"),
      ]);

      if (
        postsResponse.status === 401 ||
        matchesResponse.status === 401 ||
        notificationsResponse.status === 401 ||
        settingsResponse.status === 401
      ) {
        setIsUnauthenticated(true);
        setErrorMessage("로그인이 필요합니다.");
        return;
      }

      if (!postsResponse.ok || !matchesResponse.ok || !notificationsResponse.ok || !settingsResponse.ok) {
        setIsUnauthenticated(false);
        setErrorMessage("마이페이지 정보를 불러오지 못했습니다.");
        return;
      }

      setIsUnauthenticated(false);

      const postsBody = (await postsResponse.json()) as {
        success: boolean;
        posts: PostSummary[];
      };
      const matchesBody = (await matchesResponse.json()) as {
        success: boolean;
        attemptedClaims: MatchClaim[];
        receivedClaims: MatchClaim[];
      };
      const notificationsBody = (await notificationsResponse.json()) as {
        success: boolean;
        notifications: NotificationItem[];
      };
      const settingsBody = (await settingsResponse.json()) as {
        success: boolean;
        setting: NotificationSetting;
      };

      if (postsBody.success) {
        setPosts(postsBody.posts);
      }

      if (matchesBody.success) {
        setAttemptedClaims(matchesBody.attemptedClaims);
        setReceivedClaims(matchesBody.receivedClaims);
      }

      if (notificationsBody.success) {
        setNotifications(notificationsBody.notifications);
      }

      if (settingsBody.success) {
        setNotificationSetting(settingsBody.setting);
      }
    } catch {
      setIsUnauthenticated(false);
      setErrorMessage("마이페이지 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadMyPageData();
  }, [loadMyPageData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const tabPosts =
    activeTab === "all"
      ? posts
      : posts.filter((post) => post.status === activeTab);

  const formatMatchDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatNotificationDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const matchStatusLabel: Record<MatchClaim["status"], string> = {
    pending: "대기 중",
    approved: "승인됨",
    rejected: "거절됨",
  };

  const handleToggleNotifications = async () => {
    setErrorMessage(null);
    setIsSavingNotificationSetting(true);

    try {
      const response = await fetch("/api/me/notification-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ enabled: !notificationSetting.enabled }),
      });

      if (response.status === 401) {
        setIsUnauthenticated(true);
        setErrorMessage("로그인이 필요합니다.");
        return;
      }

      if (!response.ok) {
        setIsUnauthenticated(false);
        setErrorMessage("알림 설정을 저장하지 못했습니다.");
        return;
      }

      const body = (await response.json()) as {
        success: boolean;
        setting: NotificationSetting;
      };

      if (body.success) {
        setNotificationSetting(body.setting);
      }
    } catch {
      setIsUnauthenticated(false);
      setErrorMessage("알림 설정을 저장하지 못했습니다.");
    } finally {
      setIsSavingNotificationSetting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-zinc-600">내 게시글을 불러오는 중입니다...</p>;
  }

  if (isUnauthenticated) {
    return (
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">로그인이 필요합니다.</p>
        <Link
          href="/login"
          className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  if (errorMessage && posts.length === 0) {
    return <p className="text-sm text-red-600">{errorMessage}</p>;
  }

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: "all", label: "전체" },
    { key: "active", label: "등록됨" },
    { key: "claiming", label: "확인 중" },
    { key: "returned", label: "반환 완료" },
  ];

  return (
    <section className="space-y-5">
      <h1 className="text-xl font-semibold text-zinc-900">내 게시글</h1>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="flex gap-2 border-b border-zinc-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabPosts.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">게시글이 없습니다.</p>
          <Link
            href="/posts/new"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white"
          >
            게시글 등록
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {tabPosts.map((post) => (
            <li key={post.id}>
              <a
                href={`/posts/${post.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
                        {post.type === "lost" ? "분실물" : "습득물"}
                      </span>
                      <span className="text-xs text-zinc-500">{post.category}</span>
                    </div>
                    <p className="text-sm font-medium text-zinc-900">{post.title}</p>
                    <p className="text-xs text-zinc-500">{post.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[post.status] ?? "bg-zinc-100 text-zinc-700"}`}
                    >
                      {STATUS_LABEL[post.status] ?? post.status}
                    </span>
                    <span className="text-xs text-zinc-400">{formatDate(post.createdAt)}</span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">진행 중 매칭</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-zinc-900">내가 시도한 클레임</h3>
            {attemptedClaims.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">아직 시도한 클레임이 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attemptedClaims.map((claim) => (
                  <li key={claim.id} className="rounded-lg bg-zinc-50 p-3">
                    <Link href={`/posts/${claim.post.id}`} className="text-sm font-medium text-zinc-900">
                      {claim.post.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      경로: {claim.path === "owner" ? "내 물건 같아요" : "이거 제가 주웠어요"}
                    </p>
                    <p className="text-xs text-zinc-500">상태: {matchStatusLabel[claim.status]}</p>
                    <p className="text-xs text-zinc-400">{formatMatchDate(claim.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-zinc-900">내가 받은 요청</h3>
            {receivedClaims.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">아직 받은 클레임이 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {receivedClaims.map((claim) => (
                  <li key={claim.id} className="rounded-lg bg-zinc-50 p-3">
                    <Link href={`/posts/${claim.post.id}`} className="text-sm font-medium text-zinc-900">
                      {claim.post.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">요청자: {claim.claimantEmail}</p>
                    <p className="text-xs text-zinc-500">상태: {matchStatusLabel[claim.status]}</p>
                    <p className="text-xs text-zinc-400">{formatMatchDate(claim.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">알림함</h2>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">알림 수신</p>
              <p className="mt-1 text-xs text-zinc-500">
                현재 상태: {notificationSetting.enabled ? "켜짐" : "꺼짐"}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-60"
              onClick={() => void handleToggleNotifications()}
              disabled={isSavingNotificationSetting}
            >
              {isSavingNotificationSetting
                ? "저장 중..."
                : notificationSetting.enabled
                  ? "알림 끄기"
                  : "알림 켜기"}
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">최근 30일 알림이 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((notification) => {
              const content = (
                <>
                  <p className="text-sm font-medium text-zinc-900">{notification.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">{notification.body}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatNotificationDate(notification.createdAt)}
                  </p>
                </>
              );

              return (
                <li key={notification.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  {notification.postId ? (
                    <Link href={`/posts/${notification.postId}`} className="block">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
