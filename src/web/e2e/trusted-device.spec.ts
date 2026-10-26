import { test, expect } from "@playwright/test";

test("remembering a device is optional and submitted only with the authenticator code", async ({ page }) => {
  const logins: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") {
      await route.fulfill({ status: 401, json: { title: "Sign in" } });
    } else if (path === "/api/auth/login") {
      logins.push(route.request().postDataJSON());
      await route.fulfill({ json: { requiresMfaCode: true, requiresMfaSetup: false } });
    } else {
      await route.fulfill({ json: path === "/api/auth/csrf" ? { token: "test" } : [] });
    }
  });
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Test-password-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const remember = page.getByRole("checkbox", { name: "Remember this device for 7 days" });
  await expect(remember).not.toBeChecked();
  await remember.check();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect.poll(() => logins.length).toBe(2);
  expect(logins[0].rememberDevice).toBe(false);
  expect(logins[1]).toMatchObject({ code: "123456", rememberDevice: true });
});
