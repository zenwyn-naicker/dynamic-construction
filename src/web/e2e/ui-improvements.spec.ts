import { test, expect, type Page } from "@playwright/test";

const account = {
  id: "client-1",
  fullName: "Test Client",
  email: "client@example.test",
  roles: ["Client"],
  twoFactorEnabled: false,
  requiresMfaSetup: false,
};

async function mockApi(page: Page, user = account) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/auth/me"
        ? user
        : path === "/api/auth/csrf"
          ? { token: "test-token" }
          : path === "/api/content" || path === "/api/content/manage"
            ? []
            : { items: [], total: 0, number: 1, pageSize: 25 };
    await route.fulfill({ json: body });
  });
}

test("MFA restriction explains access without requesting protected records", async ({
  page,
}) => {
  await mockApi(page, { ...account, roles: ["Admin"], requiresMfaSetup: true });
  const protectedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/audit"))
      protectedRequests.push(request.url());
  });
  await page.goto("/staff/audit");
  await expect(
    page.getByRole("heading", {
      name: "Set up your authenticator to continue",
    }),
  ).toBeVisible();
  await expect(page.getByText(/0 records/)).toHaveCount(0);
  expect(protectedRequests).toEqual([]);
  await page.getByRole("link", { name: "Set up MFA", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("link", { name: /Return to your workspace/ }),
  ).toHaveAttribute("href", "/staff");
});

test("quote loading and failures never display a false empty state", async ({
  page,
}) => {
  await mockApi(page, { ...account, roles: ["Staff"] });
  await page.route("**/api/operations/quotes/clients", (route) =>
    route.fulfill({ json: [] }),
  );
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/operations/quotes?**", async (route) => {
    await waiting;
    await route.fulfill({
      status: 503,
      json: { title: "Quotes temporarily unavailable." },
    });
  });
  await page.goto("/staff/quotes");
  await expect(page.getByText("Loading quotes…")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No matching quotes" }),
  ).toHaveCount(0);
  release();
  await expect(page.getByRole("alert")).toHaveText(
    "Quotes temporarily unavailable.",
  );
  await expect(
    page.getByRole("heading", { name: "No matching quotes" }),
  ).toHaveCount(0);
  await page.route("**/api/operations/quotes?**", (route) =>
    route.fulfill({ json: { items: [], total: 0, number: 1, pageSize: 25 } }),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching quotes" }),
  ).toBeVisible();
});

test("estimate retains its previous amount but blocks continuation until refreshed", async ({
  page,
}) => {
  await mockApi(page);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/quotes/estimate", async (route) => {
    const input = route.request().postDataJSON();
    if (input.length === 8) await waiting;
    await route.fulfill({
      json: {
        total: input.length * input.width * 2000,
        area: input.length * input.width,
        unitRate: 2000,
        assumptions: "Subject to a formal quotation.",
        rateVersion: "test",
      },
    });
  });
  await page.goto("/quote?type=Deck");
  const dialog = page.getByRole("dialog", { name: "INSTANT ESTIMATE" });
  const continueButton = dialog.getByRole("button", { name: "Continue" });
  const amount = dialog.locator(".qb-total strong");
  await expect(continueButton).toBeEnabled();
  await expect(amount).toHaveText(/48\s000,00/);
  const previous = await amount.innerText();
  await dialog.getByLabel("Length").fill("8");
  await expect(dialog.locator(".qb-total")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(amount).toHaveText(previous);
  await expect(continueButton).toBeDisabled();
  release();
  await expect(amount).not.toHaveText(previous);
  await continueButton.click();
  await expect(dialog.getByLabel("Full name")).toHaveValue(account.fullName);
  await expect(dialog.getByLabel("Email address")).toHaveValue(account.email);
  await dialog.getByLabel("Full name").fill("Corrected name");
  await dialog.getByRole("button", { name: "Back" }).click();
  await continueButton.click();
  await expect(dialog.getByLabel("Full name")).toHaveValue("Corrected name");
  const checkbox = dialog.getByRole("checkbox");
  const bounds = await checkbox.boundingBox();
  expect(bounds?.width).toBeCloseTo(20, 1);
  const consentText = await dialog.locator(".check-label > span").boundingBox();
  expect(consentText!.x).toBeGreaterThan(bounds!.x + bounds!.width);
  expect(Math.abs(consentText!.y - bounds!.y)).toBeLessThan(3);
  await dialog
    .getByText("I agree to use of these details", { exact: false })
    .click();
  await expect(checkbox).toBeChecked();
});

test("custom projects are described in words and priced after assessment", async ({
  page,
}) => {
  await mockApi(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/quotes", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      json: { reference: "QR-TEST", estimate: null, assumptions: "" },
    });
  });
  await page.goto("/quote?type=Other");
  const dialog = page.getByRole("dialog", { name: "INSTANT ESTIMATE" });
  const continueButton = dialog.getByRole("button", { name: "Continue" });
  await expect(dialog.getByText("Priced after a site visit")).toBeVisible();
  await continueButton.click();
  await expect(dialog.getByText(/at least 10 characters/)).toBeVisible();
  await dialog
    .getByLabel("What would you like built?")
    .fill("Concrete driveway with a drainage channel.");
  await continueButton.click();
  await dialog.getByLabel("Phone number").fill("0825550142");
  await dialog.getByLabel("Site address").fill("Fictional test site, Durban");
  await dialog.getByRole("checkbox").check();
  await continueButton.click();
  await expect(
    dialog.getByText("Concrete driveway with a drainage channel."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByText("QR-TEST")).toBeVisible();
  expect(submitted).toMatchObject({
    type: "Other",
    length: 0,
    width: 0,
    description: "Concrete driveway with a drainage channel.",
  });
});

test("closing with unsent details asks first and returns to the page", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  const card = page.locator(".quote-card");
  await card.getByRole("radio", { name: "Something else" }).click();
  await card.getByRole("button", { name: "Continue" }).click();
  const dialog = page.getByRole("dialog", { name: "INSTANT ESTIMATE" });
  await dialog
    .getByLabel("What would you like built?")
    .fill("A garden pergola.");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByLabel("Phone number").fill("0825550142");
  await page.keyboard.press("Escape");
  const prompt = page.getByRole("alertdialog", {
    name: "Leave without sending?",
  });
  await expect(prompt).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(prompt).toHaveCount(0);
  await expect(dialog.getByLabel("Phone number")).toHaveValue("0825550142");
  await dialog.getByRole("button", { name: "Close estimate" }).click();
  await prompt.getByRole("button", { name: "Leave" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the homepage card prices a project and carries it into the builder", async ({
  page,
}) => {
  await mockApi(page);
  const requests: { type: string; length: number }[] = [];
  await page.route("**/api/quotes/estimate", async (route) => {
    const input = route.request().postDataJSON();
    requests.push(input);
    await route.fulfill({
      json: {
        total: input.length * input.width * 7200,
        area: input.length * input.width,
        unitRate: 7200,
        assumptions: "Subject to a formal quotation.",
        rateVersion: "test",
      },
    });
  });
  await page.goto("/");
  const card = page.locator(".quote-card");
  await card.getByRole("radio", { name: "Pool" }).click();
  await expect(card.getByRole("img")).toHaveAccessibleName(/pool/);
  await card.getByLabel("Length").fill("10");
  await expect(card.locator(".qb-total strong")).toHaveText(/288\s000,00/);
  await expect(card).toContainText(
    "Includes excavation, marble plaster, a pool pump and labour.",
  );
  expect(requests.at(-1)).toMatchObject({ type: "Pool", length: 10 });
  await card.getByRole("button", { name: "Continue" }).click();
  const dialog = page.getByRole("dialog", { name: "INSTANT ESTIMATE" });
  await expect(
    dialog.getByRole("heading", { name: "How big is the gunite pool?" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Length")).toHaveValue("10");
  await expect(dialog.getByRole("radio", { name: "Pool" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("workspace navigation stays contained across responsive widths and scrolling", async ({
  page,
}) => {
  await mockApi(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [390, 820, 1100, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/client/projects");
    await expect(
      page.getByRole("heading", { name: "No projects yet" }),
    ).toBeVisible();
    const sidebar = page.locator(".portal-shell > aside");
    if (width <= 1100) {
      expect((await sidebar.boundingBox())!.height).toBeLessThan(90);
      await page.getByRole("button", { name: "Workspace navigation" }).click();
    }
    const side = (await sidebar.boundingBox())!;
    const links = sidebar.getByRole("link");
    for (const link of await links.all()) {
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(side.x);
      expect(box.x + box.width).toBeLessThanOrEqual(side.x + side.width + 1);
    }
    await sidebar
      .getByRole("link", { name: "Notifications", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "No notifications yet" }),
    ).toBeVisible();
    if (width <= 1100) {
      await expect(
        page.getByRole("button", { name: "Workspace navigation" }),
      ).toHaveAttribute("aria-expanded", "false");
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const geometry = await page.evaluate(() => {
        const side = document
          .querySelector(".portal-shell > aside")!
          .getBoundingClientRect();
        const content = document
          .querySelector(".portal-main")!
          .getBoundingClientRect();
        const inner = document
          .querySelector(".workspace-sidebar-inner")!
          .getBoundingClientRect();
        const header = document
          .querySelector("header")!
          .getBoundingClientRect();
        return {
          bottom: side.bottom,
          contentBottom: content.bottom,
          innerTop: inner.top,
          headerBottom: header.bottom,
        };
      });
      expect(Math.abs(geometry.bottom - geometry.contentBottom)).toBeLessThan(
        2,
      );
      expect(geometry.innerTop).toBeGreaterThanOrEqual(
        geometry.headerBottom - 1,
      );
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("secondary action links render as buttons and empty projects have one action", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/client/projects");
  const start = page.getByRole("link", {
    name: "Start an estimate",
    exact: true,
  });
  await expect(start).toHaveCount(1);
  expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await mockApi(page, { ...account, roles: ["Admin"] });
  await page.goto("/staff/content");
  const shortcuts = page
    .getByRole("navigation", { name: "Record shortcuts" })
    .getByRole("link");
  for (const link of await shortcuts.all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await link.evaluate((element) => getComputedStyle(element).display),
    ).toBe("inline-flex");
  }
  await shortcuts.filter({ hasText: "Files & photographs" }).click();
  await expect(page).toHaveURL("/staff/projects");
});

test("recipient selection survives filtering and sends only selected clients", async ({
  page,
}) => {
  await mockApi(page, { ...account, roles: ["Staff"] });
  await page.route("**/api/operations/quotes/clients", (route) =>
    route.fulfill({
      json: [
        { id: "one", fullName: "Alice Client", email: "alice@example.test" },
        { id: "two", fullName: "Bob Client", email: "bob@example.test" },
      ],
    }),
  );
  let sent: unknown;
  await page.route("**/api/notifications", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 204 });
  });
  await page.goto("/staff/notifications");
  await expect(
    page.getByRole("button", { name: "Send notification" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /Alice Client/ }).check();
  await page.getByLabel("Find a client").fill("Bob");
  await expect(page.getByText("1 selected · maximum 100")).toBeVisible();
  await page.getByRole("checkbox", { name: /Bob Client/ }).check();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Test project notification");
  await page.getByRole("button", { name: "Send notification" }).click();
  await expect(
    page.getByText("Notification delivered to each selected recipient."),
  ).toBeVisible();
  expect(sent).toEqual({
    recipients: ["one", "two"],
    message: "Test project notification",
    projectId: null,
  });
  await expect(page.getByText("0 selected · maximum 100")).toBeVisible();
});

test("portal navigation keeps public links outside the workspace and closes the account menu", async ({
  page,
  isMobile,
}) => {
  await mockApi(page, { ...account, roles: ["Admin"] });
  await page.goto("/staff");
  await expect(
    page.getByRole("heading", { name: "Awaiting review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  if (isMobile) {
    const workspaceMenu = page.getByRole("button", {
      name: "Workspace navigation",
    });
    await expect(workspaceMenu).toBeVisible();
    await workspaceMenu.click();
    await expect(workspaceMenu).toHaveAttribute("aria-expanded", "true");
  }
  await expect(
    page.getByText("Work management", { exact: true }),
  ).toBeVisible();
  await page.locator(".account-menu summary").click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeHidden();
  await page.getByRole("link", { name: "View website", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Plan your project with confidence." }),
  ).toBeVisible();
  if (isMobile) {
    const publicMenu = page.getByRole("button", { name: "Toggle menu" });
    await expect(publicMenu).toBeVisible();
    await expect(publicMenu).toHaveAttribute("aria-expanded", "false");
    await publicMenu.click();
    await expect(publicMenu).toHaveAttribute("aria-expanded", "true");
  }
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
});

test("quote status filter reaches the server and is retained in the URL", async ({
  page,
}) => {
  await mockApi(page, { ...account, roles: ["Staff"] });
  await page.route("**/api/operations/quotes/clients", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.goto("/staff/quotes");
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/operations/quotes?") &&
      r.url().includes("status=Under%20Review"),
  );
  await page.getByLabel("Quote status").selectOption("Under Review");
  await request;
  await expect(page).toHaveURL(/status=Under\+Review/);
  await page.reload();
  await expect(page.getByLabel("Quote status")).toHaveValue("Under Review");
});

test("project progress navigation exposes published milestones and updates", async ({
  page,
}) => {
  await mockApi(page);
  await page.route("**/api/projects/project-one", (r) =>
    r.fulfill({
      json: {
        id: "project-one",
        reference: "PR-1",
        name: "Test build",
        status: "Active",
        contractValue: 1000,
        milestones: [
          {
            id: "m1",
            title: "Foundation complete",
            complete: true,
            published: true,
            dueAt: "2026-09-25",
          },
        ],
        updates: [
          {
            id: "u1",
            message: "Roof work underway",
            createdAt: "2026-09-25",
            published: true,
          },
        ],
      },
    }),
  );
  await page.goto("/client/projects/project-one/overview");
  await expect(page.getByRole("heading", { name: "Test build" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Project milestones" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByText("Foundation complete")).toBeVisible();
  await expect(page.getByText("Roof work underway")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete milestone", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Financials", exact: true }),
  ).toHaveAttribute("href", "/client/projects/project-one/finance");
});
