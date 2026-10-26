import { test, expect } from "@playwright/test";

test("staff manages pricing and publishes portfolio content", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("staff@example.test");
  await page.getByLabel("Password", { exact: true }).fill(process.env.TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations", exact: true }).last()).toBeVisible();
  await page.goto("/staff/publications");
  await page.getByLabel("Priced project").selectOption({ label: "Concrete deck" });
  await page.getByLabel("Unit rate (ZAR / m²)").fill("2000");
  await page.getByLabel("Estimate assumptions").fill("Approved test rate, subject to a site assessment.");
  await page.getByLabel("Available for online estimates").check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Save rate" }).click();
  await expect(page.getByText("Rate saved. Existing quote estimates remain unchanged.")).toBeVisible();
  const title = "Browser publication " + testInfo.project.name + " " + Date.now();
  const location = "Site " + testInfo.project.name + " " + Date.now();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Location", { exact: true }).fill(location);
  await page.getByLabel("Project type", { exact: true }).fill("Deck");
  await page.getByLabel("Summary", { exact: true }).fill("Completed project summary entered through the staff interface.");
  await page.getByLabel("Project details", { exact: true }).fill("Project detail entered through the authorised publication workflow.");
  await page.getByLabel("Completion date").fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel("Duration (days)").fill("20");
  await page.getByLabel("Publish on website", { exact: true }).check();
  await page.getByRole("button", { name: "Save portfolio entry" }).click();
  await expect(page.getByText("Portfolio entry saved.")).toBeVisible();
  if (await page.locator(".account-menu summary").isVisible()) await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/#projects");
  await expect(page.getByRole("tablist", { name: "Portfolio projects" })).toBeVisible();
  const publishedTab = page.getByRole("tab", { name: location + " Deck" });
  for (let attempt = 0; await publishedTab.count() === 0 && attempt < 100; attempt++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("tablist", { name: "Portfolio projects" })).toBeVisible();
  }
  await publishedTab.click();
  await expect(page.locator("#portfolio-detail")).toContainText("Browser publication");
  await expect(page.getByText("R 48,000", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath(`public-${testInfo.project.name}.png`), fullPage: true });
  expect(errors).toEqual([]);
});
test("public navigation, estimate, validation and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Plan your project with confidence." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Build my estimate" }).click();
  await expect(page).toHaveURL(/\/quote$/);
  const dialog = page.getByRole("dialog", { name: "INSTANT ESTIMATE" });
  await expect(dialog.getByText("Step 1 of 3 · Your project")).toBeVisible();
  const estimateResponse = page.waitForResponse(response =>
    response.url().endsWith("/api/quotes/estimate") && response.request().method() === "POST");
  await dialog.getByRole("radio", { name: "Deck" }).click();
  await expect(dialog.getByRole("heading", { name: "How big is the concrete deck?" })).toBeVisible();
  expect((await estimateResponse).ok()).toBe(true);
  const continueButton = dialog.getByRole("button", { name: "Continue", exact: true });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(dialog.getByText("Step 2 of 3 · Your details")).toBeVisible();
  await continueButton.click();
  await expect(dialog.getByText("Enter your full name.")).toBeVisible();
  await dialog.getByLabel("Full name").fill("Browser Test Client");
  await dialog.getByLabel("Email address").fill("browser@example.test");
  await dialog.getByLabel("Phone number").fill("0825550142");
  await dialog.getByLabel("Site address").fill("Fictional test site, Durban");
  await dialog.getByRole("checkbox").check();
  await continueButton.click();
  await expect(dialog.getByText("Step 3 of 3 · Review")).toBeVisible();
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByRole("heading", { name: "Request received." })).toBeVisible();
  await expect(dialog.getByText(/^QR-/)).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("project photographs can be paused and stepped through, and the account dialog dismisses", async ({ page }) => {
  await page.goto("/");
  const panels = page.getByRole("region", { name: "Project photographs" });
  await panels.scrollIntoViewIfNeeded();
  await panels.getByRole("button", { name: "Pause project photographs" }).click();
  await expect(panels.getByRole("button", { name: "Play project photographs" })).toBeVisible();
  await panels.getByRole("button", { name: "Show Ronaldo Road" }).click();
  await expect(panels.getByRole("heading", { name: "Ronaldo Road" })).toBeVisible();
  await panels.getByRole("button", { name: "Next project" }).click();
  await expect(panels.getByRole("heading", { name: "Gunite pool" })).toBeVisible();
  const pool = panels.getByRole("article", { name: "Gunite pool, 1 of 4" });
  await pool.getByRole("button", { name: "Show stage 6: Completed pool" }).click();
  await expect(pool.getByText("Stage 6 of 6")).toBeVisible();
  const photograph = pool.getByRole("img", { name: "Finished gunite pool with paving and a view over the valley" });
  await expect(photograph).toHaveAttribute("src", /gunite-pool\/pool-finished.jpg$/);
  await expect.poll(() => photograph.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "New client? Create an account" }).click();
  await expect(dialog.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("client session and role boundary", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("thandi@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.goto("/staff/users");
  await expect(
    page.getByRole("heading", { name: "Access restricted." }),
  ).toBeVisible();
  if (await page.locator(".account-menu summary").isVisible()) await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await page.goto("/client");
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
});
