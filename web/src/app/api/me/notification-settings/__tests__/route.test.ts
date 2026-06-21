import { afterEach, describe, expect, it } from "vitest";

import { GET, PATCH } from "@/app/api/me/notification-settings/route";
import { __clearSessionStoreForTests, getSharedSessionStore } from "@/lib/auth/session";
import {
  __clearNotificationPreferenceStoreForTests,
  __resetNotificationPreferenceStoreNowForTests,
  __setNotificationPreferenceStoreNowForTests,
  getSharedNotificationPreferenceStore,
} from "@/lib/notifications/notification-preference-store";

describe("/api/me/notification-settings", () => {
  afterEach(() => {
    __clearNotificationPreferenceStoreForTests();
    __resetNotificationPreferenceStoreNowForTests();
    __clearSessionStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request("http://localhost/api/me/notification-settings"));

    expect(response.status).toBe(401);
  });

  it("returns default enabled setting", async () => {
    const token = getSharedSessionStore().createSession("me@school.ac.kr");
    const response = await GET(
      new Request("http://localhost/api/me/notification-settings", {
        headers: { cookie: `auth_session=${token}` },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.setting.enabled).toBe(true);
  });

  it("updates notification setting", async () => {
    __setNotificationPreferenceStoreNowForTests(() => Date.parse("2026-06-20T10:00:00.000Z"));

    const token = getSharedSessionStore().createSession("me@school.ac.kr");
    const response = await PATCH(
      new Request("http://localhost/api/me/notification-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `auth_session=${token}`,
        },
        body: JSON.stringify({ enabled: false }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.setting).toEqual({
      enabled: false,
      updatedAt: "2026-06-20T10:00:00.000Z",
    });
    expect(getSharedNotificationPreferenceStore().isEnabled("me@school.ac.kr")).toBe(false);
  });
});