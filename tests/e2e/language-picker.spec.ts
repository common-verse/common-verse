import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("German is served at root with canonical metadata and no legacy redirects", async ({
  page,
  baseURL,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${baseURL}/`,
  );
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
    "href",
    `${baseURL}/`,
  );
  const legacy = await page.request.get("/de/events/test?ref=legacy", {
    maxRedirects: 0,
  });
  expect(legacy.status()).toBe(404);
  await page.goto("/veranstaltungen/test");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Poesie über Grenzen",
  );
});

for (const locale of ["de", "ar"] as const) {
  test(`${locale} picker works at 320px with keyboard, focus return, and readable language names`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto(locale === "de" ? "/" : "/ar");
    const trigger = page.getByRole("button", {
      name: locale === "de" ? "Sprache: Deutsch" : /العربية$/,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const popup = page.getByRole("dialog", {
      name: locale === "de" ? "Sprache" : "اللغة",
    });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole("link")).toHaveCount(6);
    // Native name plus the name in the current UI language.
    await expect(popup.locator('a[hreflang="en"]')).toHaveText(
      locale === "de" ? "EnglishEnglisch" : "Englishالإنجليزية",
    );
    await expect(popup.locator('[lang="fa"][dir="rtl"]')).toHaveText("فارسی");
    await expect(popup.locator('a[aria-current="page"]')).toContainText(
      locale === "de" ? "Deutsch" : "العربية",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(popup.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(popup).toBeHidden();
    // Leaving the menu with the keyboard closes it, so it never covers the focus.
    await page.keyboard.press("Enter");
    await expect(popup).toBeVisible();
    for (let step = 0; step < 7; step++) await page.keyboard.press("Tab");
    await expect(popup).toBeHidden();
  });
}

test("language links preserve the content path, query, and anchor when returning to German", async ({
  page,
}) => {
  await page.goto("/en/events/test?ref=invite#main");
  await page.getByRole("button", { name: "Language: English" }).click();
  const popup = page.getByRole("dialog", { name: "Language" });
  await expect(popup).toBeVisible();
  await popup.getByRole("link", { name: /^Deutsch/ }).click();
  await expect(page).toHaveURL(/\/veranstaltungen\/test\?ref=invite#main$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});

test("event language links use each locale's slug and fall back to the overview", async ({
  page,
  baseURL,
}) => {
  expect(
    (await page.request.get("/veranstaltungen/river-reading")).status(),
  ).toBe(404);
  expect((await page.request.get("/ar/events/fluss-lesung")).status()).toBe(
    404,
  );
  await page.goto("/veranstaltungen/fluss-lesung?ref=invite#main");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${baseURL}/veranstaltungen/fluss-lesung`,
  );
  await expect(page.locator('link[hreflang="ar"]')).toHaveAttribute(
    "href",
    `${baseURL}/ar/events/river-reading`,
  );
  await expect(page.locator('link[hreflang="fa"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Sprache: Deutsch" }).click();
  const popup = page.getByRole("dialog", { name: "Sprache" });
  await expect(popup.getByRole("link")).toHaveCount(6);
  await expect(popup.locator('a[hreflang="fa"]')).toHaveAttribute(
    "href",
    "/fa/events?ref=invite",
  );
  await popup.getByRole("link", { name: /^العربية/ }).click();
  await expect(page).toHaveURL(/\/ar\/events\/river-reading\?ref=invite#main$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${baseURL}/ar/events/river-reading`,
  );
  await page.getByRole("button", { name: /العربية$/ }).click();
  await page.getByRole("link", { name: /^Deutsch/ }).click();
  await expect(page).toHaveURL(
    /\/veranstaltungen\/fluss-lesung\?ref=invite#main$/,
  );
});

test("language selection remains available without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/`);
  await page.getByRole("button", { name: "Sprache: Deutsch" }).click();
  await page.getByRole("link", { name: /^English/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await context.close();
});

test("German page names share route identity, alternates, and query/hash with other languages", async ({
  page,
  baseURL,
}) => {
  const legacy = await page.request.get("/poems/test-poem?ref=legacy", {
    maxRedirects: 0,
  });
  expect(legacy.status()).toBe(404);
  await page.goto("/gedichte/test-poem?ref=invite#main");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${baseURL}/gedichte/test-poem`,
  );
  await expect(page.locator('link[hreflang="ar"]')).toHaveAttribute(
    "href",
    `${baseURL}/ar/poems/test-poem`,
  );
  await page.getByRole("button", { name: "Sprache: Deutsch" }).click();
  await page.getByRole("link", { name: /^العربية/ }).click();
  await expect(page).toHaveURL(/\/ar\/poems\/test-poem\?ref=invite#main$/);
  await page.getByRole("button", { name: /العربية$/ }).click();
  await page.getByRole("link", { name: /^Deutsch/ }).click();
  await expect(page).toHaveURL(/\/gedichte\/test-poem\?ref=invite#main$/);
});
