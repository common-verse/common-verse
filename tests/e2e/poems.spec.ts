import { expect, test } from "@playwright/test";

test("poems list pages newest first and shows originals with a note", async ({
  page,
}) => {
  await page.goto("/gedichte");
  await expect(page.locator(".collection-count")).toHaveText("27 Gedichte");
  const cards = page.locator(".poem-card");
  await expect(cards).toHaveCount(24);
  await expect(cards.first().getByRole("heading")).toHaveText(
    "Gemeinsamer Morgen",
  );
  const arabic = cards.nth(1);
  await expect(arabic).toHaveAttribute("lang", "ar");
  await expect(arabic).toHaveAttribute("dir", "rtl");
  await expect(arabic.locator(".poem-note")).toHaveText(
    "Nicht auf Deutsch verfügbar",
  );
  await expect(cards.first().locator(".poem-note")).toHaveCount(0);
  await expect(page.locator(".pagination a[aria-current=page]")).toHaveText(
    "1",
  );

  await page
    .locator(".pagination")
    .getByRole("link", { name: "Seite 2" })
    .click();
  await expect(page).toHaveURL(/\/gedichte\?page=2$/);
  await expect(cards).toHaveCount(3);
  await expect(cards.last().getByRole("heading")).toHaveText("Elbe, Februar");
  for (const query of ["?page=3", "?page=0", "?page=x"])
    expect((await page.request.get(`/gedichte${query}`)).status()).toBe(404);
});

test("Arabic poems list shows the original, never another translation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/ar/poems");
  const card = page.locator(".poem-card").first();
  await expect(card).toHaveAttribute("lang", "fa");
  await expect(card.getByRole("heading")).toHaveText("صبح مشترک");
  await expect(card).toContainText("نور حداد");
  await expect(card.locator(".poem-note")).toHaveText("غير متوفرة بالعربية");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("poem shows one version at a time, the page language first", async ({
  page,
  baseURL,
}) => {
  await page.goto("/gedichte/test-poem");
  const versions = page.getByRole("list", { name: "Lesen auf" });
  await expect(versions.getByRole("link")).toHaveText([
    "Persisch",
    "Deutsch",
    "Englisch",
  ]);
  await expect(versions.locator("[aria-current]")).toHaveText("Deutsch");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Gemeinsamer Morgen",
  );
  await expect(page.locator(".poem-credit")).toHaveText(
    "Übersetzt von Prototype translation",
  );
  await expect(page.locator(".poem .poem-note")).toHaveCount(0);
  await expect(page.locator(".facts")).toContainText("OriginalPersisch");
  await expect(
    page.locator(".facts").getByRole("link", { name: "Nour Haddad" }),
  ).toHaveAttribute("href", "/autoren/nour-haddad");
  await expect(page.locator(".poem-card")).toHaveCount(1);
  await expect(page.locator('link[hreflang="ar"]')).toHaveAttribute(
    "href",
    `${baseURL}/ar/poems/test-poem`,
  );

  await versions.getByRole("link", { name: "Persisch" }).click();
  await expect(page).toHaveURL(/\/gedichte\/test-poem\?fassung=fa$/);
  await expect(page.locator(".poem [lang=fa][dir=rtl]")).toContainText(
    "صبح مشترک",
  );
  await expect(page.locator(".poem-credit")).toHaveCount(0);
});

test("a poem without the page language shows its original with a note first", async ({
  page,
}) => {
  await page.goto("/gedichte/regeln-des-ankommens");
  const note = page.locator(".poem .poem-note");
  await expect(note).toHaveText("Nicht auf Deutsch verfügbar");
  await expect(note).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "قواعد الوصول",
  );
  expect(
    await note.evaluate(
      (element) =>
        element.compareDocumentPosition(document.querySelector("h1")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBeTruthy();

  await page.goto("/ar/poems/test-poem");
  await expect(page.locator(".poem .poem-note")).toHaveText(
    "غير متوفرة بالعربية",
  );
  await expect(page.locator(".poem h1")).toHaveText("صبح مشترک");
  await expect(page.locator(".poem-author")).toContainText(
    "تكتب نور حداد بالعربية",
  );
  for (const path of ["/en/poems/regeln-des-ankommens", "/gedichte/missing"])
    expect((await page.request.get(path)).status()).toBe(404);
});
