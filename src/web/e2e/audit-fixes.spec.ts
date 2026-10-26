import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("quote acceptance requires a client and can be retried", async ({
  page,
}) => {
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("staff@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/staff");
  const { token } = await (await page.request.get("/api/auth/csrf")).json();
  const name = `Unlinked quote ${Date.now()}`;
  const headers = { "X-CSRF-TOKEN": token };
  const submitted = await page.request.post("/api/quotes", {
    headers,
    data: {
      submissionKey: randomUUID(),
      type: "Deck",
      length: 6,
      width: 4,
      finish: "Standard",
      name,
      email: "browser@example.test",
      phone: "0825550142",
      site: "Fictional test site",
      notes: "Quote acceptance regression",
      consent: true,
    },
  });
  expect(submitted.ok()).toBe(true);
  const { id } = await submitted.json();
  const { items } = await (
    await page.request.get("/api/operations/quotes")
  ).json();
  let quote = items.find((item: { id: string }) => item.id === id);
  for (const status of ["Under Review", "Quoted"]) {
    const response = await page.request.post(
      `/api/operations/quotes/${id}/decision`,
      {
        headers,
        data: {
          version: quote.version,
          status,
          reason: "Site assessment recorded.",
          formalAmount: 49000,
          validUntil: new Date(Date.now() + 86400000).toISOString(),
          clientId: null,
        },
      },
    );
    expect(response.ok()).toBe(true);
    quote = await response.json();
  }
  await page.goto("/staff/quotes");
  await page.getByLabel("Search quotes").fill(name);
  await expect(page.locator(".quote-decision-panel h2").first()).toHaveText(
    name,
  );
  await page
    .getByLabel("Reason / acceptance evidence")
    .fill("Client acceptance recorded.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Link a verified client account before accepting the quote.",
  );
  const clients = await (
    await page.request.get("/api/operations/quotes/clients")
  ).json();
  const client = clients.find(
    (item: { email: string }) => item.email === "thandi@example.test",
  );
  await page.getByLabel("Verified client account").selectOption(client.id);
  await page.getByRole("button", { name: "Save decision" }).click();
  await page.getByRole("button", { name: "Create linked project" }).click();
  await expect(page).toHaveURL(/\/staff\/projects\//);
});

test("account creation clears the form and recovery restores access", async ({
  page,
}) => {
  const password = process.env.TEST_PASSWORD!;
  const email = `recovery-ui-${Date.now()}@example.test`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/staff");
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/staff/users");
  await expect(
    page.getByRole("heading", { name: "Create account" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize(viewport);
  const create = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Create account" }) });
  await create.getByLabel("Full name").fill("Recovery UI Client");
  await create.getByLabel("Email", { exact: true }).fill(email);
  await create.getByLabel("Temporary password").fill(password);
  await create
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Account created successfully.")).toBeVisible();
  await expect(create.getByLabel("Full name")).toHaveValue("");
  await expect(create.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(create.getByLabel("Temporary password")).toHaveValue("");
  if (await page.locator(".account-menu summary").isVisible())
    await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/client");
  await page.goto("/profile");
  const recovery = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Account recovery", exact: true }),
  });
  await recovery.getByLabel("Current password").fill(password);
  await recovery
    .getByRole("button", { name: "Generate new recovery codes" })
    .click();
  await expect(recovery.locator(".recovery-codes li")).toHaveCount(10);
  const code = await recovery
    .locator(".recovery-codes code")
    .first()
    .innerText();
  if (await page.locator(".account-menu summary").isVisible())
    await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/signin");
  await page
    .getByRole("button", { name: "Lost access? Use a recovery code" })
    .click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lost access? Use a recovery code" })
    .click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Recovery code", { exact: true }).fill(code);
  await page.getByLabel("New password").fill(password + "-recovered");
  await page
    .getByRole("button", { name: "Recover account", exact: true })
    .click();
  await expect(page.getByText(/Account recovered\. Sign in/)).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(password + "-recovered");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/client");
  expect(errors).toEqual([]);
});

test("public pages fit a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 768 });
  for (const route of ["/", "/quote"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
