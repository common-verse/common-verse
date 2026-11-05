import { expect, test } from "@playwright/test";

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
