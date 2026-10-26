import { describe, it, expect, vi, beforeEach } from "vitest";
describe("API session boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", new EventTarget());
  });
  it("sends cookies and an antiforgery token for writes", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reference: "QR-test" })),
      );
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api");
    await api("/quotes", "POST", { name: "Client" });
    expect(fetch.mock.calls[1][1]).toMatchObject({
      credentials: "include",
      headers: { "X-CSRF-TOKEN": "csrf", "Content-Type": "application/json" },
    });
  });
  it("fetches a new token after sign-in changes the principal", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "anonymous" })),
      )
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "signed-in" })),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api");
    await api("/auth/login", "POST", {});
    await api("/notifications/id/read", "POST");
    expect(fetch.mock.calls[3][1].headers["X-CSRF-TOKEN"]).toBe("signed-in");
  });
  it("notifies the application when the session expires", async () => {
    const handler = vi.fn();
    window.addEventListener("session-expired", handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );
    const { api } = await import("./api");
    await expect(api("/projects")).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
  });
  it("preserves a useful conflict message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: "Reload before saving." }), {
          status: 409,
        }),
      ),
    );
    const { api } = await import("./api");
    await expect(api("/projects")).rejects.toThrow("Reload before saving.");
  });
  it("turns network failures into actionable feedback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { api } = await import("./api");
    await expect(api("/projects")).rejects.toThrow("Connection unavailable");
  });
  it("passes cancellation through without reporting a connection failure", async () => {
    const controller = new AbortController();
    const error = new DOMException("Cancelled", "AbortError");
    const fetch = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(error);
    });
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api");
    await expect(
      api("/projects", "GET", undefined, controller.signal),
    ).rejects.toBe(error);
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });
  it("does not set JSON content type on multipart uploads", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api");
    const form = new FormData();
    form.set("category", "Photo");
    await api("/files", "POST", form);
    expect(fetch.mock.calls[1][1].headers["Content-Type"]).toBeUndefined();
  });
});
