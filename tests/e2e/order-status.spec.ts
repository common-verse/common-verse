import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectFocusNeverObscured } from "./focus";

// The mock CMS knows one order per status for reader@example.org (tests/fixtures/mock-cms.mjs).
const email = "reader@example.org";

// Each test is its own client for the lookup's rate limit (the test build trusts X-Forwarded-For).
let clientNumber = 0;
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${100 + (process.pid % 100)}.${Math.floor(++clientNumber / 250)}.${clientNumber % 250}`,
  });
});

async function lookUp(page: Page, code: string, address = email) {
  await page.locator("#code").fill(code);
  await page.locator("#email").fill(address);
  await page
    .getByRole("button", { name: /Status anzeigen|Show status|عرض الحالة/ })
    .click();
}

async function expectAccessible(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("the footer leads to the status page; aliases redirect to the canonical path", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Bestellstatus" })
    .click();
  await expect(page).toHaveURL(/\/bestellstatus$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bestellstatus",
  );
  const response = await request.get("/de/order-status?code=PA1D0002", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/bestellstatus?code=PA1D0002");
  const arabic = await request.get("/ar/bestellstatus", { maxRedirects: 0 });
  expect(arabic.headers().location).toBe("/ar/order-status");
  expect((await request.get("/bestellstatus")).headers()["cache-control"]).toBe(
    "no-store",
  );
});

test("each status shows its label, books, total and timeline, never a name or address", async ({
  page,
}) => {
  const cases = [
    ["SEPA-0001", "Zahlung läuft", "Lastschrift läuft"],
    ["pa1d 0002", "Bezahlt, wird gepackt", "Wir packen deine Bücher"],
    ["SH1P-0003", "Versendet", "Versendet"],
    ["CANC-0004", "Storniert", "Storniert"],
    ["FA17-0005", "Zahlung fehlgeschlagen", "Zahlung fehlgeschlagen"],
  ] as const;
  for (const [code, label, now] of cases) {
    await page.goto("/bestellstatus");
    await lookUp(page, code, " Reader@Example.org ");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
    await expect(
      page.locator(".order-steps li:is([data-state=now], [data-state=stop])"),
    ).toContainText(now);
  }
  // The last one, failed, names the shop's address.
  await expect(
    page.getByRole("link", { name: "shop@thepoetryproject.de" }),
  ).toHaveAttribute("href", "mailto:shop@thepoetryproject.de");
  await expect(page.getByText("Bestellung FA17-0005")).toBeVisible();
  const summary = page.locator(".checkout-summary");
  await expect(summary.locator(".summary-lines li")).toHaveText([
    /Sei neben mir/,
    /كلمات عابرة/,
  ]);
  await expect(summary.locator(".summary-lines li").first()).toContainText(
    "× 2",
  );
  await expect(summary.locator(".status-total")).toContainText("54,00 €");
  await expect(page.locator(".order-steps li").first()).toContainText(
    "Bestellung eingegangen am 30. Oktober 2026",
  );
  await expect(page.locator("main")).not.toContainText("Haddad");
  await expectAccessible(page);

  await page.getByRole("link", { name: "Andere Bestellung suchen" }).click();
  await expect(page.locator("#code")).toHaveValue("");
});

test("a wrong email or code gets one quiet answer in a reserved place", async ({
  page,
}) => {
  await page.goto("/bestellstatus");
  const button = page.getByRole("button", { name: "Status anzeigen" });
  const privacy = page.locator(".status-privacy");
  const before = [await button.boundingBox(), await privacy.boundingBox()];

  await lookUp(page, "PA1D-0002", "someone@example.org");
  const message = page.locator("#status-problem");
  await expect(message).toHaveText(
    "Keine Bestellung gefunden. Prüfe Bestellcode und E-Mail-Adresse.",
  );
  await expect(message).toBeFocused();
  expect([await button.boundingBox(), await privacy.boundingBox()]).toEqual(
    before,
  );
  await expect(page.locator("#code")).toHaveValue("PA1D-0002");
  await expect(page.locator("#email")).toHaveValue("someone@example.org");

  // Keyboard only: Shift+Tab from the message back to the email, then to the code; Enter sends.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#code")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("zzzz-zzzz");
  await page.keyboard.press("Enter");
  await expect(page.locator("#code")).toHaveValue("ZZZZ-ZZZZ");
  await expect(message).toHaveText(
    "Keine Bestellung gefunden. Prüfe Bestellcode und E-Mail-Adresse.",
  );
  expect([await button.boundingBox(), await privacy.boundingBox()]).toEqual(
    before,
  );
  await expectAccessible(page);
});

test("fields report a missing or malformed code and email without asking the CMS", async ({
  page,
}) => {
  await page.goto("/bestellstatus");
  await page.getByRole("button", { name: "Status anzeigen" }).click();
  await expect(page.locator("#code")).toBeFocused();
  await expect(page.locator("#code")).toHaveAccessibleDescription(
    "Bitte fülle dieses Feld aus.",
  );
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await lookUp(page, "K7QD-93FU", "reader@");
  await expect(page.locator("#code")).toHaveAccessibleDescription(
    "Bitte gib die 8 Zeichen deines Bestellcodes ein.",
  );
  await expect(page.locator("#email")).toHaveAccessibleDescription(
    "Bitte gib eine gültige E-Mail-Adresse ein.",
  );
  await expect(page.locator("#status-problem")).toHaveCount(0);
});

test("five failed lookups block the client for a while, even for a right code", async ({
  page,
}) => {
  await page.goto("/en/order-status");
  for (let attempt = 0; attempt < 5; attempt++) {
    await lookUp(page, "PA1D-0002", `wrong${attempt}@example.org`);
    await expect(page.locator("#status-problem")).toHaveText(/^No order found/);
  }
  await lookUp(page, "PA1D-0002");
  await expect(page.locator("#status-problem")).toHaveText(
    "Too many attempts. Please try again in 15 minutes.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Order status",
  );
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the form posts, shows errors and finds the order", async ({ page }) => {
    await page.goto("/en/order-status?code=sh1p0003");
    await expect(page.locator("#code")).toHaveValue("SH1P-0003");
    await expect(page.getByText("Taken from your link.")).toBeVisible();
    await page.getByRole("button", { name: "Show status" }).click();
    await expect(page.locator("#email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await lookUp(page, "SH1P-0003");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shipped");
    await expect(
      page.locator(".order-steps [aria-current=step]"),
    ).toContainText("on its way to you");
  });
});

for (const width of [375, 1280]) {
  test(`Arabic at ${width}px mirrors the text, keeps the code left-to-right and the summary left`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ar/order-status");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("#code")).toHaveAttribute("dir", "ltr");
    expect(await noSideScroll(page)).toBe(true);
    await lookUp(page, "SEPA-0001", "nobody@example.org");
    await expect(page.locator("#status-problem")).toHaveText(
      /^لم يُعثر على طلب/,
    );
    expect(await noSideScroll(page)).toBe(true);
    await lookUp(page, "SEPA-0001");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "الدفع قيد التنفيذ",
    );
    await expect(page.locator(".status-code")).toHaveText("SEPA-0001");
    expect(await noSideScroll(page)).toBe(true);
    const summary = await page.locator(".checkout-summary").boundingBox();
    const main = await page.locator(".checkout-main").boundingBox();
    if (width >= 960) expect(summary!.x).toBeLessThan(main!.x);
    else expect(summary!.y).toBeLessThan(main!.y);
    await expectAccessible(page);
  });
}

test("at 375px no focused control hides under the bottom bar, including the footer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/bestellstatus");
  await expectFocusNeverObscured(page, ".site-footer nav a >> nth=-1");
  // Browsers without scroll-state queries never tuck the bar away.
  await page.goto("/bestellstatus");
  await page.addStyleTag({
    content: ".site-header nav { translate: none !important; }",
  });
  await expectFocusNeverObscured(page, ".site-footer nav a >> nth=-1");
});
