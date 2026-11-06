import { expect, test } from "@playwright/test";

test("authors overview lists every author alphabetically, never a generated face", async ({
  page,
}) => {
  await page.goto("/autoren");
  await expect(page.locator(".collection-count")).toHaveText("3 Autor:innen");
  const cards = page.locator(".author-card");
  await expect(cards.getByRole("heading")).toHaveText([
    "Nachtfalter",
    "Nour Haddad",
    "Samira Taleb",
  ]);
  await expect(cards.first()).toContainText("Afghanistan Noch keine Gedichte");
  await expect(cards.last()).toContainText("25 Gedichte");
  // Only Samira Taleb has an uploaded portrait; the others get no image.
  await expect(cards.locator("img")).toHaveCount(1);
  await expect(cards.last().locator("img")).toHaveCount(1);
  await expect(cards.locator(".monogram")).toHaveText(["N", "N"]);
  await expect(
    page.getByRole("link", { name: "Nour Haddad", exact: true }),
  ).toHaveAttribute("href", "/autoren/nour-haddad");
});

test("Arabic authors overview sorts Arabic names first and runs right to left", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/ar/authors");
  const cards = page.locator(".author-card");
  await expect(cards.getByRole("heading")).toHaveText([
    "سميرة طالب",
    "نور حداد",
    "Nachtfalter",
  ]);
  await expect(cards.nth(1)).toContainText("قصيدتان");
  await expect(cards.nth(2).locator("bdi")).toHaveAttribute("lang", "de");
  const [first, second] = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
  ]);
  expect(first!.x).toBeGreaterThan(second!.x);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("author page shows place, biography, awards and every poem", async ({
  page,
}) => {
  await page.goto("/autoren/nour-haddad");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nour Haddad",
  );
  await expect(page.locator(".author-place")).toHaveText("Latakia, Syrien");
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.locator(".awards li")).toHaveText([
    "2024Preis für junge Lyrik",
    "2021Schreibstipendium Wasserzeichen",
  ]);
  await expect(page.locator(".poem-card h3")).toHaveText([
    "Gemeinsamer Morgen",
    "قواعد الوصول",
  ]);

  await page.goto("/autoren/samira-taleb");
  await expect(page.locator("main img")).toHaveAttribute(
    "alt",
    "Layered colourful paper shapes",
  );
  await expect(
    page.getByRole("heading", { name: "Auszeichnungen" }),
  ).toHaveCount(0);
  await expect(page.locator(".author-bio")).toHaveCount(0);
  await expect(page.locator(".poem-card")).toHaveCount(25);
  await expect(page.locator(".poem-card h3").last()).toHaveText(
    "Elbe, Februar",
  );
});

test("a pseudonym without portrait, city or poems in Arabic", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/ar/authors/moth");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nachtfalter",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute(
    "lang",
    "de",
  );
  await expect(page.locator(".author-place")).toHaveText("أفغانستان");
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.locator(".author-no-poems")).toContainText("Nachtfalter");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await page.request.get("/autoren/moth")).status()).toBe(404);
});

test("the language switch keeps the author across different German and English slugs", async ({
  page,
}) => {
  await page.goto("/autoren/nachtfalter");
  await page.getByRole("button", { name: "Sprache: Deutsch" }).click();
  await page.getByRole("link", { name: /^English/ }).click();
  await expect(page).toHaveURL(/\/en\/authors\/moth$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moth");
  await page.getByRole("button", { name: /English$/ }).click();
  await page.getByRole("link", { name: /^Deutsch/ }).click();
  await expect(page).toHaveURL(/\/autoren\/nachtfalter$/);
});

test("author drafts render only in an authorized preview", async ({ page }) => {
  expect((await page.goto("/en/authors/draft-author"))?.status()).toBe(404);
  expect(
    (await page.goto("/en/authors/draft-author?previewSecret=wrong"))?.status(),
  ).toBe(401);
  const response = await page.goto(
    "/en/authors/draft-author?previewSecret=test-preview&editorLanguage=uk",
  );
  expect(response?.status()).toBe(200);
  expect(response?.headers()["cache-control"]).toBe("no-store");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Draft Author",
  );
  await expect(page.locator(`[data-slot="banner"]:not([data-update-banner])`)).toHaveAttribute("lang", "uk");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
});
