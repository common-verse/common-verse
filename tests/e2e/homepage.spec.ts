import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("automatic authors show the newest profiles with published poems", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(
    page.locator("#home-authors-11 .author-card").getByRole("heading"),
  ).toHaveText(["Nour Haddad", "Samira Taleb"]);
});

test("embedded draft preview refreshes on a trusted CMS document event", async ({
  page,
  baseURL,
}) => {
  const cmsURL = `http://127.0.0.1:${process.env.PLAYWRIGHT_CMS_PORT ?? "3001"}`;
  const preview = new URL("/en?previewSecret=test-preview", baseURL);
  // Use one loopback hostname, as the real local CMS and web configuration does.
  // Chromium blocks an iframe that crosses from 127.0.0.1 to localhost.
  preview.hostname = "127.0.0.1";
  const previewURL = preview.href;
  await page.goto(`${cmsURL}/preview-host`);
  await expect(
    page.frameLocator("iframe").getByRole("heading", { level: 1 }),
  ).toHaveText("Draft homepage");
  const frame = page.frames().find((entry) => entry.url() === previewURL)!;
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
    "Draft homepage",
  );
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const refreshed = frame.waitForNavigation();
  await page
    .locator("iframe")
    .evaluate((iframe: HTMLIFrameElement) =>
      iframe.contentWindow?.postMessage(
        { type: "payload-document-event" },
        "*",
      ),
    );
  await refreshed;
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
    "Draft homepage",
  );
});

for (const locale of ["en", "ar"]) {
  test(`${locale} homepage works at 320px and keeps the original language`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto(`/${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // English has a translation; Arabic shows the Persian original.
    await expect(
      page.locator(
        locale === "en"
          ? '.featured-poem [lang="en"][dir="ltr"]'
          : '.featured-poem [lang="fa"][dir="rtl"]',
      ),
    ).toContainText(locale === "en" ? "A Shared Morning" : "صبح");
    await expect(page.locator("#upcoming time")).toBeVisible();
    await expect(page.getByText("Hidden section")).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
    const author = page.waitForResponse((response) =>
      response.url().endsWith(`/${locale}/authors/samira-taleb`),
    );
    await page
      .locator("#home-authors-1")
      .getByRole("link", {
        name: locale === "en" ? "Samira Taleb" : "سميرة طالب",
      })
      .click();
    expect((await author).status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("all hero types render their correct content and destination", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.locator(".featured-poem")).toContainText(
    "A Shared Morning",
  );
  await page.goto("/");
  await expect(page.locator(".featured-event")).toContainText(
    "Poesie über Grenzen",
  );
  await page.goto("/fa");
  await expect(page.locator(".featured-event")).toContainText("خبر تازه");
  await expect(
    page.locator('.featured-event a[href="/fa/events"]'),
  ).toBeVisible();
});

test("homepage preview requires runtime authorization, respects order and stays private", async ({
  page,
}) => {
  for (const secret of ["wrong", "build-preview", ""]) {
    const response = await page.request.get(`/en?previewSecret=${secret}`);
    expect(response.status()).toBe(401);
  }
  const response = await page.goto("/en?previewSecret=test-preview");
  expect(response?.headers()["cache-control"]).toBe("no-store");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Draft homepage",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
  expect(
    await page
      .locator(".home-section")
      .evaluateAll((sections) => sections.map((section) => section.id)),
  ).toEqual([
    "home-authors-0",
    "home-introduction-1",
    "home-poems-2",
    "upcoming",
    "home-participation-4",
    "home-newsletter-5",
    "home-featured-6",
    "home-featured-7",
    "home-featured-8",
    "home-poems-9",
    "home-poems-10",
    "home-authors-11",
  ]);
  // A draft selection shows only in the preview.
  await expect(
    page.locator("#home-poems-9 .poem-card").getByRole("heading"),
  ).toHaveText(["قواعد الوصول", "Draft", "Elbe, Februar"]);
  await page.goto("/en");
  await expect(page.getByText("Draft homepage")).toHaveCount(0);
});

test("public homepage ignores arbitrary postMessage events", async ({
  page,
}) => {
  await page.goto("/en");
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  await page.evaluate(() =>
    window.postMessage({ type: "payload-document-event" }, "*"),
  );
  await page.waitForTimeout(100);
  expect(navigations).toEqual([]);
});

test("homepage remains useful without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en");
  await expect(page.locator(".featured-poem")).toBeVisible();
  await expect(page.locator("#upcoming time")).toBeVisible();
  await page.getByRole("link", { name: "Read the full poem" }).click();
  await expect(page).toHaveURL(/\/en\/poems\/test-poem$/);
  await context.close();
});

for (const locale of ["ar", "ku"]) {
  test(`${locale} missing homepage translations do not invent editorial copy`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("main h1")).toHaveText(
      locale === "ar" ? "مشروع الشعر" : "Projeya Helbestê",
    );
    await expect(page.locator(".home-feature .lede")).toHaveCount(0);
    await expect(page.locator(".home-feature [role=status]")).toBeVisible();
    await expect(
      page.locator(".section-introduction .section-prose"),
    ).toHaveCount(0);
    await expect(page.locator(".participation-grid > li")).toHaveCount(0);
    const newsletter = page.locator(".section-newsletter");
    await expect(newsletter.locator("[role=status]")).toBeVisible();
    await expect(newsletter.getByRole("heading")).toHaveCount(0);
    await expect(newsletter.getByRole("link")).toHaveCount(0);
    await expect(newsletter).not.toHaveAttribute("aria-labelledby");
  });
}

for (const locale of ["en", "ar"]) {
  test(`${locale} composed sections inherit item content and respect automatic/manual choices`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const automatic = page.locator("#home-poems-2 .poem-card");
    await expect(automatic).toHaveCount(4);
    // The page language where it exists, else the original with a note.
    await expect(automatic.first()).toHaveAttribute(
      "lang",
      locale === "en" ? "en" : "fa",
    );
    await expect(automatic.nth(1)).toHaveAttribute("lang", "ar");
    const selected = page.locator("#home-poems-9 .poem-card");
    // The draft selection is never shown publicly.
    await expect(selected.getByRole("heading")).toHaveText([
      "قواعد الوصول",
      "Elbe, Februar",
    ]);
    await expect(selected.last().locator(".poem-note")).toBeVisible();
    await expect(page.locator("#home-poems-10 .poem-cards")).toHaveCount(0);
    await expect(page.locator("#home-featured-6")).toContainText(
      "The biography comes from the poet profile.",
    );
    await expect(
      page.locator(`#home-featured-6 a[href="/${locale}/authors/nour-haddad"]`),
    ).toBeVisible();
    await expect(
      page.locator(`#home-featured-7 a[href="/${locale}/events/test"]`),
    ).toBeVisible();
    const poem = page.locator(
      `#home-featured-8 a[href="/${locale}/poems/test-poem"]`,
    );
    await expect(poem).toBeVisible();
    await expect(
      page.locator(".section-authors .text-link").first(),
    ).toContainText(locale === "en" ? "Meet all authors" : "تعرّف");
    const response = page.waitForResponse((entry) =>
      entry.url().endsWith(`/${locale}/poems/test-poem`),
    );
    await poem.click();
    expect((await response).status()).toBe(200);
  });
}

test("authors without an uploaded portrait show a monogram, never a generated face", async ({
  page,
}) => {
  await page.goto("/en");
  const cards = page.locator("#home-authors-1 .author-card");
  await expect(cards.first().locator("img")).toHaveAttribute("alt", "");
  await expect(cards.last().locator("img")).toHaveCount(0);
  await expect(cards.last().locator(".monogram")).toHaveText("M");
});
