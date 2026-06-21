import { describe, expect, it } from "vitest";

import { POST as logout } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  it("always clears auth_session cookie", async () => {
    const request = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: "auth_session=test-token",
      },
    });

    const response = await logout(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });

    const cookieHeader = response.headers.get("set-cookie");
    expect(cookieHeader).toContain("auth_session=");
    expect(cookieHeader).toContain("Max-Age=0");
    expect(cookieHeader).toContain("HttpOnly");
  });
});
