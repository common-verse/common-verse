import { expect, test } from "@playwright/test";
import { localizedPath } from "@poetry/i18n";

const expectations = [
  ["de", "ltr"],
  ["en", "ltr"],
  ["ar", "rtl"],
  ["fa", "rtl"],
  ["uk", "ltr"],
  ["ku", "ltr"],
] as const;

const eventTitles = {
  de: "Poesie über Grenzen",
  en: "Poetry Across Borders",
  ar: "الشعر عبر الحدود",
  fa: "شعر فراتر از مرزها",
  uk: "Поезія без кордонів",
  ku: "Helbest li Ser Sînoran",
} as const;

for (const [locale, direction] of expectations) {
  test(`${locale} has the expected document language and direction`, async ({
    page,
  }) => {
    await page.goto(localizedPath(locale));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", direction);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const brand = (await page.locator(".site-header .brand").boundingBox())!;
      const controls = (await page.locator(".header-controls").boundingBox())!;
      expect(brand.x + brand.width).toBeLessThanOrEqual(controls.x);
      const links = page.locator(".site-header nav a");
      let previousRight = 0;
      for (const link of await links.all()) {
        const box = (await link.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(previousRight);
        previousRight = box.x + box.width;
        await expect(link).toHaveCSS("direction", direction);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });

  test(`${locale} workshop route renders localized content`, async ({
    page,
  }) => {
    await page.goto(localizedPath(locale, "events/test"));
    await expect(
      page.getByRole("heading", { level: 1, name: eventTitles[locale] }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", direction);
  });
}

test("primary navigation is keyboard accessible", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /zum inhalt/i })).toBeFocused();
});

test("the mobile bottom bar labels five links on one line and widens the current one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto("/autoren");
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  const links = nav.getByRole("link");
  // The bar uses the short "Termine"; the desktop header keeps "Veranstaltungen".
  const visibleText = () =>
    links.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).innerText.trim()),
    );
  expect(await visibleText()).toEqual([
    "Termine",
    "Artikel",
    "Gedichte",
    "Autor:innen",
    "Shop",
  ]);
  const widths: number[] = [];
  for (const link of await links.all()) {
    await expect(link.locator("svg")).toBeVisible();
    const label = link.locator("span:visible");
    // One line that fits inside its item.
    expect(
      await label.evaluate(
        (element) =>
          element.getClientRects().length === 1 &&
          element.scrollWidth <= element.parentElement!.clientWidth,
      ),
    ).toBe(true);
    widths.push((await link.boundingBox())!.width);
  }
  const current = nav.locator("[aria-current]");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("Autor:innen");
  expect(widths[3] / widths[0]).toBeCloseTo(1.5, 1);
  const bar = (await nav.boundingBox())!;
  expect(bar.y + bar.height).toBeCloseTo(780, 0);
  await page.setViewportSize({ width: 1280, height: 780 });
  expect((await visibleText())[0]).toBe("Veranstaltungen");
});

test("primary navigation targets render collection indexes", async ({
  page,
}) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Events", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/events$/);
  await expect(
    page.getByRole("link", { name: "Poetry Across Borders" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Poems", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/poems$/);
  await expect(
    page.getByRole("link", { name: "A Shared Morning" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Authors", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/authors$/);
  await expect(page.getByRole("link", { name: "Samira Taleb" })).toBeVisible();
});

test("language switcher changes the locale URL and document direction", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sprache: Deutsch" }).click();
  await page.getByRole("link", { name: /^العربية/ }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("localized workshop renders media, metadata, and structured data", async ({
  page,
}) => {
  await page.goto("/ar/events/test");
  await expect(
    page.getByRole("heading", { level: 1, name: "الشعر عبر الحدود" }),
  ).toBeVisible();
  await expect(page.getByRole("img")).toHaveAttribute("alt", /paper shapes/i);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "الشعر عبر الحدود · مشروع الشعر",
  );
  await expect(page.locator('link[hreflang="ku"]')).toHaveAttribute(
    "href",
    /\/ku\/events\/test$/,
  );
  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(structuredData ?? "{}")["@type"]).toBe("Event");
});

test("workshop hreflang omits locales without a translation", async ({
  page,
}) => {
  await page.goto("/en/events/partial");
  await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
  await expect(page.locator('link[hreflang="fa"]')).toHaveCount(0);
});

test("draft preview rejects a bad secret and renders an authorized draft", async ({
  page,
}) => {
  const invalid = await page.request.get("/en/events/test?previewSecret=wrong");
  expect(invalid.status()).toBe(401);

  await page.goto("/en/events/test?previewSecret=test-preview");
  await expect(page.getByRole("status")).toHaveText("Draft preview");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("draft");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
});

test("Arabic home has no console or page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ar");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("preview secrets are taken from runtime for both content types", async ({
  page,
}) => {
  for (const route of ["/veranstaltungen/test", "/ar/poems/test-poem"]) {
    const buildSecret = await page.request.get(
      `${route}?previewSecret=build-preview`,
    );
    expect(buildSecret.status()).toBe(401);
    await page.goto(`${route}?previewSecret=test-preview`);
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
  }
});
