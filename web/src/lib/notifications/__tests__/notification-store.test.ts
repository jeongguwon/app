import { afterEach, describe, expect, it } from "vitest";

import {
  __clearNotificationPreferenceStoreForTests,
  __resetNotificationPreferenceStoreNowForTests,
  getSharedNotificationPreferenceStore,
} from "@/lib/notifications/notification-preference-store";
import { __clearNotificationStoreForTests, getSharedNotificationStore } from "@/lib/notifications/notification-store";

describe("notification-store", () => {
  afterEach(() => {
    __clearNotificationStoreForTests();
    __clearNotificationPreferenceStoreForTests();
    __resetNotificationPreferenceStoreNowForTests();
  });

  it("does not create notification when recipient disabled notifications", () => {
    getSharedNotificationPreferenceStore().set("user@school.ac.kr", false);

    const created = getSharedNotificationStore().create({
      recipientEmail: "user@school.ac.kr",
      type: "message_received",
      title: "새 메시지",
      body: "테스트",
      postId: "post-1",
    });

    expect(created).toBeNull();
    expect(getSharedNotificationStore().listByRecipient("user@school.ac.kr")).toEqual([]);
  });
});