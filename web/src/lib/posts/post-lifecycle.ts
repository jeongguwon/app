import { getSharedNotificationStore } from "@/lib/notifications/notification-store";
import { getSharedPostStore } from "@/lib/posts/post-store";
import { getSharedPostMessageStore } from "@/lib/posts/post-message-store";

const DAY_MS = 24 * 60 * 60 * 1000;
const HIDE_AFTER_RETURNED_MS = 30 * DAY_MS;
const DELETE_AFTER_HIDDEN_MS = 60 * DAY_MS;

export interface PostLifecycleResult {
  hiddenCount: number;
  deletedCount: number;
  purgedMessageCount: number;
  purgedNotificationCount: number;
}

export function applyAutomaticPostTransitions(now: number = Date.now()): PostLifecycleResult {
  const store = getSharedPostStore();
  const posts = store.list();

  let hiddenCount = 0;
  let deletedCount = 0;

  for (const post of posts) {
    const statusChangedAt = Date.parse(post.statusChangedAt);

    if (Number.isNaN(statusChangedAt)) {
      continue;
    }

    if (post.status === "returned" && now - statusChangedAt >= HIDE_AFTER_RETURNED_MS) {
      store.update(post.id, { status: "hidden", now: () => now });
      hiddenCount += 1;
      continue;
    }

    if (post.status === "hidden" && now - statusChangedAt >= DELETE_AFTER_HIDDEN_MS) {
      store.update(post.id, { status: "deleted", now: () => now });
      deletedCount += 1;
    }
  }

  const purgedMessageCount = getSharedPostMessageStore().purgeExpired(now);
  const purgedNotificationCount = getSharedNotificationStore().purgeExpired(now);

  return {
    hiddenCount,
    deletedCount,
    purgedMessageCount,
    purgedNotificationCount,
  };
}
