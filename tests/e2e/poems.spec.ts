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
