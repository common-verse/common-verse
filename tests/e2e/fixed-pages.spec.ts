import { expect, test } from "@playwright/test";
import { fixedPageKeys, locales, localizedPath } from "@poetry/i18n";

for (const locale of locales) {
  test(`${locale} fixed pages render with canonical routes and local footer links`, async ({
    page,
  }) => {
    for (const key of fixedPageKeys) {
      const path = localizedPath(locale, key);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        ["ar", "fa"].includes(locale) ? "rtl" : "ltr",
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        `${key} ${key === "privacy" && locale === "fa" ? "en" : locale}`,
      );
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(
        "More information",
      );
      await expect(page.locator(".rich-text strong")).toContainText(
        "Fixture content",
      );
      await expect(page.locator(".rich-text p")).toHaveCount(2);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`${path}$`),
      );
      await expect(
        page.locator(`footer a[href="${localizedPath(locale, key)}"]`),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });
}

test("missing fixed-page translations use English with its own language and direction", async ({
  page,
}) => {
  await page.goto("/en/privacy");
  await expect(page.locator('link[hreflang="fa"]')).toHaveCount(1);
  const response = await page.goto("/fa/privacy");
  expect(response?.status()).toBe(200);
  await expect(page.locator("article")).toHaveAttribute("lang", "en");
  await expect(page.locator("article")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "privacy en",
  );
  await expect(page.locator(".prose")).toContainText(
    "Fixture content for privacy in en.",
  );
  await expect(
    page.getByText("This content is not yet available in this language."),
  ).toHaveCount(0);
});

test("fixed routes redirect German aliases and preserve language switching", async ({
  page,
  request,
}) => {
  const response = await request.get("/de/contact?ref=test", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(301);
  expect(new URL(response.headers().location, "http://x").pathname).toBe(
    "/kontakt",
  );
  await page.goto("/kontakt?ref=test#main");
  await page.getByRole("button", { name: "Sprache: Deutsch" }).click();
  await page.getByRole("link", { name: /^العربية/ }).click();
  await expect(page).toHaveURL(/\/ar\/contact\?ref=test#main$/);
  expect((await request.get("/en/not-a-page")).status()).toBe(404);
});

test("fixed page previews require the runtime secret and remain unindexed", async ({
  page,
  request,
}) => {
  expect((await request.get("/en/about?previewSecret=wrong")).status()).toBe(
    401,
  );
  await page.goto("/en/about?previewSecret=test-preview");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "about en — draft",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
  await expect(page.locator(".preview-banner")).toBeVisible();
});
