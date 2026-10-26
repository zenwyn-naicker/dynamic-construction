import { test, expect } from "@playwright/test";

test("registration gives immediate field feedback and blocks invalid submissions", async ({
  page,
}) => {
  const registrations: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/api/auth/register") {
      registrations.push(route.request().postDataJSON());
      return route.fulfill({ json: { message: "Account created." } });
    }
    await route.fulfill({
      json: path === "/api/auth/csrf" ? { token: "test" } : [],
    });
  });
  await page.goto("/signin");
  await page
    .getByRole("button", { name: "New client? Create an account" })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Jane123");
  await expect(
    page.getByText(
      "Use letters, spaces, hyphens or apostrophes. Numbers are not allowed.",
    ),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("invalid@");
  await expect(
    page.getByText("Enter a valid email address, such as name@example.com."),
  ).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("short");
  await expect(
    page.getByText("Your password must meet all the requirements below."),
  ).toBeVisible();
  await expect(page.getByLabel("Confirm password", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect(registrations).toEqual([]);
  await page.getByLabel("Full name", { exact: true }).fill("José O’Neill");
  await page.getByLabel("Email address").fill("client@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongPassword1!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Account created. Sign in to continue."),
  ).toBeVisible();
  expect(registrations).toEqual([
    {
      fullName: "José O’Neill",
      email: "client@example.com",
      password: "StrongPassword1!",
    },
  ]);
});

test("login validates format before submit without enforcing new password rules", async ({
  page,
}) => {
  const logins: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/api/auth/login") {
      logins.push(route.request().postDataJSON());
      return route.fulfill({
        json: { requiresMfaCode: true, requiresMfaSetup: false },
      });
    }
    await route.fulfill({
      json: path === "/api/auth/csrf" ? { token: "test" } : [],
    });
  });
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("invalid");
  await expect(
    page.getByText("Enter a valid email address, such as name@example.com."),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("client@example.com");
  await page.getByLabel("Password", { exact: true }).fill("old");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Authenticator code")).toBeVisible();
  expect(logins[0].password).toBe("old");
  await page.getByLabel("Authenticator code").fill("12a");
  await expect(
    page.getByText("Enter the six-digit authenticator code."),
  ).toBeVisible();
});
