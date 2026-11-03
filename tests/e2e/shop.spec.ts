import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectFocusNeverObscured, expectFocusedVisible } from "./focus";

const cmsURL = `http://127.0.0.1:${process.env.PLAYWRIGHT_CMS_PORT ?? "3001"}`;

// A stand-in for Stripe.js: the Payment and Express Checkout Elements are Stripe's to test.
// It records what the page passes in `window.stripeStub`; `click` and `confirm` play the wallet sheet.
// Set `window.stubWallets` to "none" or "late" (after 1.5 s) before load; `stripeStub.incomplete` fails `elements.submit()`.
function stubStripe(page: Page, outcome: "redirect" | "decline") {
  return page.route("https://js.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.Stripe = Object.assign(function () {
        const stub = window.stripeStub = { handlers: {}, created: {}, confirmed: [], failed: [] }
        stub.confirm = (wallet) => stub.handlers['expressCheckout:confirm']({ ...wallet, expressPaymentType: 'apple_pay', paymentFailed: (payload) => stub.failed.push(payload ?? {}) })
        stub.click = () => new Promise((settle) => stub.handlers['expressCheckout:click']({ expressPaymentType: 'apple_pay', resolve: () => settle('resolved'), reject: () => settle('rejected') }))
        return {
          elements(options) {
            stub.options = options
            return {
              create(type, createOptions) {
                stub.created[type] = createOptions
                return {
                  on(event, callback) {
                    stub.handlers[type + ':' + event] = callback
                    if (event !== 'ready') return
                    if (type !== 'expressCheckout') return setTimeout(() => callback({}))
                    const wallets = window.stubWallets
                    setTimeout(() => callback({ availablePaymentMethods: wallets === 'none' ? undefined : { applePay: true } }), wallets === 'late' ? 1500 : 0)
                  },
                  mount(element) { element.textContent = type === 'payment' ? 'Payment element' : 'Wallet buttons' },
                }
              },
              async submit() { return stub.incomplete ? { error: { type: 'validation_error', message: 'Incomplete' } } : {} },
              update() {},
            }
          },
          async confirmPayment({ clientSecret, confirmParams }) {
            stub.confirmed.push({ clientSecret, confirmParams })
            if (${JSON.stringify(outcome)} === 'decline') return { error: { type: 'card_error', message: 'Your card was declined.' } }
            location.href = confirmParams.return_url + '?payment_intent=' + clientSecret.split('_secret')[0] + '&redirect_status=succeeded'
            return new Promise(() => {})
          },
        }
      }, { version: 'endive' })`,
    }),
  );
}

type StripeStub = {
  options: Record<string, unknown>;
  created: Record<string, Record<string, unknown>>;
  confirmed: { clientSecret: string; confirmParams: Record<string, unknown> }[];
  failed: Record<string, unknown>[];
};
const stripeStub = (page: Page) =>
  page.evaluate(() => {
    const { options, created, confirmed, failed } = (
      window as unknown as { stripeStub: StripeStub }
    ).stripeStub;
    return { options, created, confirmed, failed };
  });

// Each test is its own buyer for the rate limits (the test build trusts X-Forwarded-For).
let buyerNumber = 0;
const buyerAddress = () =>
  `10.${process.pid % 250}.${Math.floor(++buyerNumber / 250)}.${buyerNumber % 250}`;
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": buyerAddress() });
});

// A fresh address per test run, so parallel or repeated runs never read each other's payments.
let emailNumber = 0;
const uniqueEmail = (name: string) =>
  `${name}+${process.pid}-${++emailNumber}@example.org`;

async function initiatedFor(email: string) {
  const { initiate } = await (await fetch(`${cmsURL}/shop-log`)).json();
  return initiate.findLast(
    (entry: { body: { customerEmail: string } }) =>
      entry.body.customerEmail === email,
  );
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectAccessible(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
}

/** With JavaScript the drawer opens; without it the cart page loads. */
async function addToCart(
  page: Page,
  path: string,
  quantity = "1",
  { js = true } = {},
) {
  await page.goto(path);
  await page.locator("#quantity").selectOption(quantity);
  if (js) await hydrated(page, ".cart-drawer");
  await page.locator(".add-form button").click();
  if (js) await expect(page.locator(".cart-drawer")).toHaveAttribute("open");
  else await expect(page).toHaveURL(/\/shop\/cart\?status=added&product=\d+$/);
}

// Titles sit in translated sentences inside Unicode isolates, keeping their own direction.
const isolated = (title: string) => `\u2068${title}\u2069`;
const drawer = (page: Page) => page.locator(".cart-drawer");
const line = (page: Page, title: string) =>
  page.locator(".cart-line", { hasText: title });

const notice = (page: Page, tone: "success" | "error") =>
  page.locator(`.notice[data-tone="${tone}"]`);
const noticeText = (page: Page, tone: "success" | "error") =>
  notice(page, tone).locator(".notice-text");

// The 6 s timer is a CSS animation, which page.clock does not drive; DevTools' playback rate does.
async function fastAnimations(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 100 });
}

// Astro removes `ssr` from an island once it has hydrated.
const hydrated = (page: Page, selector: string) =>
  expect(page.locator(`astro-island:has(${selector})`)).not.toHaveAttribute(
    "ssr",
  );

async function fillCheckout(page: Page, email = "reader@example.org") {
  await page.locator("#email").fill(email);
  await page.locator("#firstName").fill("Amira");
  await page.locator("#lastName").fill("Haddad");
  await page.locator("#addressLine1").fill("Oranienstraße 1");
  await page.locator("#postalCode").fill("10999");
  await page.locator("#city").fill("Berlin");
}

test("German shop lists books with prices, sold-out state and title languages", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("link", { name: "Shop" })
    .click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bücher");
  const beside = page.locator(".book-card", { hasText: "Sei neben mir" });
  await expect(beside).toContainText("20,00 €");
  await expect(
    page.locator(".book-card", { hasText: "Sold Out Anthology" }),
  ).toContainText("Ausverkauft");
  await expect(page.getByRole("link", { name: "كلمات عابرة" })).toHaveAttribute(
    "dir",
    "rtl",
  );
  await expect(page.getByRole("link", { name: "كلمات عابرة" })).toHaveAttribute(
    "lang",
    "ar",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index,follow",
  );
  await expectAccessible(page);
  expect(
    (await page.request.get("/de/shop", { maxRedirects: 0 })).status(),
  ).toBe(301);
  expect(errors).toEqual([]);
});

test("product pages show facts, structured data and missing translations stay missing", async ({
  page,
}) => {
  await page.goto("/en/shop/beside-me");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute(
    "lang",
    "de",
  );
  await expect(page.locator(".book-description")).toHaveText(
    "Book description 101 en",
  );
  await expect(page.locator(".book-facts")).toContainText("978-3-95732-607-2");
  await expect(
    page.getByText("Plus €4.00 shipping within Germany."),
  ).toBeVisible();
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ??
      "{}",
  );
  expect(data).toMatchObject({
    "@type": "Book",
    isbn: "978-3-95732-607-2",
    numberOfPages: 240,
    offers: {
      "@type": "Offer",
      price: "20.00",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  });
  await expect(page.locator('link[hreflang="ar"]')).toHaveAttribute(
    "href",
    /\/ar\/shop\/beside-me$/,
  );

  await page.goto("/en/shop/german-only");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nur auf Deutsch",
  );
  await expect(page.locator(".book-description")).toHaveCount(0);
  await page.goto("/shop/german-only");
  await expect(page.locator(".book-description")).toHaveText(
    "Book description 102 de",
  );
  await expect(page.getByText("Gemäß § 19 UStG")).toBeVisible();

  await page.goto("/en/shop/sold-out");
  expect(await page.locator(".book-main").innerText()).not.toMatch(/^0+$/m);
  await expect(page.getByText("Sold out", { exact: true })).toBeVisible();
  await expect(page.locator(".add-form")).toHaveCount(0);
  expect((await page.request.get("/en/shop/missing")).status()).toBe(404);
});

test("the list adds a book without JavaScript; the cart page steps, removes and undoes", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/shop");
  await expect(page.locator(".cart-fab")).toHaveCount(0);
  const card = page.locator(".book-card", { hasText: "Sei neben mir" });
  await card.getByRole("button", { name: "In den Warenkorb" }).press("Enter");
  await expect(page).toHaveURL(/\/shop\/cart\?status=added&product=101$/);
  // The new line is tinted like in the drawer; no notice covers the heading.
  await expect(line(page, "Sei neben mir")).toHaveAttribute("data-fresh", "");
  await expect(notice(page, "success")).toHaveCount(0);
  await expect(page.locator(".shop-totals")).toContainText("24,00 €");
  await expect(page.locator(".cart-summary")).toContainText(
    "Lieferung nur innerhalb Deutschlands",
  );
  const cookies = await context.cookies();
  for (const name of ["poetry-cart", "poetry-cart-count"])
    expect(cookies.find((cookie) => cookie.name === name)).toMatchObject({
      httpOnly: true,
      sameSite: "Lax",
    });

  const more = line(page, "Sei neben mir").getByRole("button", {
    name: "Ein Exemplar mehr",
  });
  await more.press("Enter");
  await expect(noticeText(page, "success")).toHaveText(
    "Dein Warenkorb wurde aktualisiert.",
  );
  await expect(page).toHaveURL(/status=updated#line-/);
  await expect(line(page, "Sei neben mir").locator("output")).toHaveText("2");
  await expect(line(page, "Sei neben mir")).toContainText("je 20,00 €");
  await expect(
    line(page, "Sei neben mir").getByRole("button", {
      name: "Ein Exemplar weniger",
    }),
  ).toBeEnabled();

  // The list marks the book and the floating button counts copies, both without a script.
  await page.goto("/shop");
  await expect(card.getByRole("link", { name: "Im Warenkorb" })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "In den Warenkorb" }),
  ).toBeHidden();
  await expect(page.locator(".cart-fab")).toHaveAttribute(
    "aria-label",
    "Warenkorb (2)",
  );

  await page.goto("/shop/cart");
  await line(page, "Sei neben mir")
    .getByRole("button", { name: "Entfernen" })
    .press("Enter");
  await expect(page).toHaveURL(
    /status=removed&product=101&quantity=2#undo-101$/,
  );
  await expect(notice(page, "success")).toHaveCount(0);
  await expect(page.locator(".cart-undo")).toContainText(
    `„${isolated("Sei neben mir")}“ entfernt.`,
  );
  await expect(page.getByText("Dein Warenkorb ist leer.")).toBeVisible();
  await page.getByRole("button", { name: "Rückgängig" }).press("Enter");
  await expect(line(page, "Sei neben mir").locator("output")).toHaveText("2");
  await expect(page.locator(".cart-undo")).toHaveCount(0);
  await context.close();
});

test("adding opens a push drawer from 40rem that Escape closes, returning focus", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/shop");
  await hydrated(page, ".cart-drawer");
  const card = page.locator(".book-card", { hasText: "Sei neben mir" });
  const add = card.getByRole("button", { name: "In den Warenkorb" });
  const headingX = (await page
    .getByRole("heading", { level: 1 })
    .boundingBox())!.x;
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(drawer(page)).toHaveAttribute("open");
  await expect(page.locator("#cart-heading")).toBeFocused();
  await expect(page.locator("#cart-heading")).toHaveText("Warenkorb (1)");
  // Not modal: the page stays usable and moves aside below the full-width header.
  expect(
    await drawer(page).evaluate((element) => element.matches(":modal")),
  ).toBe(false);
  await expect(page.locator("html")).toHaveClass(/cart-pushed/);
  const box = (await drawer(page).boundingBox())!;
  const header = (await page.locator(".site-header").boundingBox())!;
  // The header may still be compacting from the scroll to the button.
  await expect
    .poll(async () => {
      const header = (await page.locator(".site-header").boundingBox())!;
      return (await drawer(page).boundingBox())!.y - (header.y + header.height);
    })
    .toBeCloseTo(0, 0);
  expect(box.x + box.width).toBeCloseTo(page.viewportSize()!.width, 0);
  expect(
    (await page.locator("main").boundingBox())!.x +
      (await page.locator("main").boundingBox())!.width,
  ).toBeLessThanOrEqual(box.x + 1);
  // Only the width shrinks; the content keeps its left edge.
  expect(
    (await page.getByRole("heading", { level: 1 }).boundingBox())!.x,
  ).toBeCloseTo(headingX, 0);
  await expect(line(page, "Sei neben mir")).toHaveAttribute("data-fresh", "");
  await expect(page.locator("#cart-status")).toHaveText(
    "Das Buch liegt jetzt in deinem Warenkorb.",
  );
  await expect(drawer(page)).toContainText(
    "Lieferung nur innerhalb Deutschlands",
  );
  await expect(drawer(page)).toContainText(
    "Zahlungsarten: Karte, Apple Pay, Google Pay, Wero, SEPA-Lastschrift",
  );
  await expect(page.locator(".cart-fab")).toBeHidden();
  await expectAccessible(page);

  await page.keyboard.press("Escape");
  await expect(drawer(page)).not.toHaveAttribute("open");
  await expect(page.locator("html")).not.toHaveClass(/cart-pushed/);
  // The add button turned into "Im Warenkorb", which now takes the focus back.
  await expect(card.getByRole("link", { name: "Im Warenkorb" })).toBeFocused();
  await expect(page.locator(".cart-fab")).toHaveAttribute(
    "aria-label",
    "Warenkorb (1)",
  );
  await page.locator(".cart-fab").click();
  await expect(drawer(page)).toHaveAttribute("open");
  await page.getByRole("button", { name: "Warenkorb schließen" }).click();
  await expect(page.locator(".cart-fab")).toBeFocused();
  expect(errors).toEqual([]);
});

test("below 40rem the cart is a modal bottom sheet that closes by swipe, Escape or button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await addToCart(page, "/shop/beside-me");
  expect(
    await drawer(page).evaluate((element) => element.matches(":modal")),
  ).toBe(true);
  await expect(page.locator("html")).not.toHaveClass(/cart-pushed/);
  const box = (await drawer(page).boundingBox())!;
  expect(box.width).toBe(375);
  expect(box.height).toBeCloseTo(760 * 0.9, 0);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).overflow,
    ),
  ).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(drawer(page)).not.toHaveAttribute("open");
  await expect(page.locator(".add-form button")).toBeFocused();

  // The floating button sits above the bottom bar.
  await expect(page.locator(".cart-fab")).toBeVisible();
  const fab = (await page.locator(".cart-fab").boundingBox())!;
  const bar = (await page.locator(".site-header nav").boundingBox())!;
  expect(fab.y + fab.height).toBeLessThanOrEqual(bar.y);
  await page.locator(".cart-fab").click();
  await expect(drawer(page)).toHaveAttribute("open");
  await page.waitForTimeout(300);
  const head = (await page.locator(".cart-head").boundingBox())!;
  await page.mouse.move(head.x + 20, head.y + 30);
  await page.mouse.down();
  await page.mouse.move(head.x + 20, head.y + 400, { steps: 8 });
  await page.mouse.up();
  await expect(drawer(page)).not.toHaveAttribute("open");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the floating cart button never covers focused content at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await addToCart(page, "/shop/beside-me");
  await page.keyboard.press("Escape");
  await page.goto("/shop");
  await expect(page.locator(".cart-fab")).toBeVisible();
  // Place the fourth card's button (second row, right column) behind the floating button, then Tab onto it.
  const card = page.locator(".book-card").nth(3);
  const target = card.locator(".book-add button");
  await page.evaluate(() => {
    const card = document.querySelectorAll(".book-card")[3];
    const button = card.querySelector(".book-add button")!;
    const fab = document.querySelector(".cart-fab")!.getBoundingClientRect();
    scrollBy({
      top: button.getBoundingClientRect().top - fab.top,
      behavior: "instant",
    });
    card
      .querySelector<HTMLElement>(".book-title a")!
      .focus({ preventScroll: true });
  });
  const covered = () =>
    page.evaluate(() => {
      const focused = document.activeElement!.getBoundingClientRect();
      const fab = document.querySelector(".cart-fab")!.getBoundingClientRect();
      return !(
        focused.bottom <= fab.top ||
        focused.top >= fab.bottom ||
        focused.right <= fab.left ||
        focused.left >= fab.right
      );
    });
  // The button really starts out behind the floating button.
  const fab = (await page.locator(".cart-fab").boundingBox())!;
  const start = (await target.boundingBox())!;
  expect(start.y).toBeGreaterThanOrEqual(fab.y - 1);
  expect(start.y).toBeLessThan(fab.y + fab.height);
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
  // Focus scrolls smoothly; wait until it settles clear of the button.
  await expect.poll(covered).toBe(false);
});

test("Arabic drawer keeps its side and mirrors its text; a short phone still shows a whole line", async ({
  page,
}) => {
  await page.goto("/ar/shop");
  await hydrated(page, ".cart-drawer");
  await page
    .locator(".book-card", { hasText: "كلمات عابرة" })
    .locator(".book-add button")
    .click();
  await expect(drawer(page)).toHaveAttribute("open");
  const box = (await drawer(page).boundingBox())!;
  expect(box.x + box.width).toBeCloseTo(page.viewportSize()!.width, 0);
  await expect(page.locator("#cart-heading")).toHaveText("سلة التسوق (١)");
  const book = line(page, "كلمات عابرة");
  await expect(book.getByRole("link", { name: "كلمات عابرة" })).toHaveAttribute(
    "dir",
    "rtl",
  );
  const plus = (await book
    .getByRole("button", { name: "نسخة أخرى" })
    .boundingBox())!;
  const minus = (await book
    .getByRole("button", { name: "نسخة أقل" })
    .boundingBox())!;
  expect(plus.x).toBeLessThan(minus.x);
  await expectAccessible(page);
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator(".cart-fab").click();
  expect(
    await drawer(page).evaluate((element) => element.matches(":modal")),
  ).toBe(true);
  await page.waitForTimeout(300);
  const sheet = (await drawer(page).boundingBox())!;
  const first = (await book.boundingBox())!;
  expect(first.y).toBeGreaterThanOrEqual(sheet.y);
  expect(first.y + first.height).toBeLessThanOrEqual(sheet.y + sheet.height);
});

test("a step pressed right before checkout reaches the checkout", async ({
  page,
}) => {
  await addToCart(page, "/shop/beside-me");
  await line(page, "Sei neben mir")
    .getByRole("button", { name: "Ein Exemplar mehr" })
    .click();
  await page.getByRole("link", { name: "Zur Kasse" }).click();
  await expect(page).toHaveURL(/\/shop\/checkout$/);
  await expect(page.locator(".order-facts")).toContainText("× 2");
});

test("the cart API refuses form posts, malformed bodies and bad IDs", async ({
  page,
}) => {
  await page.goto("/shop");
  const post = (body: string, type = "application/json") =>
    page.evaluate(
      async ([body, type]) => {
        const response = await fetch("/api/cart?locale=de", {
          method: "POST",
          headers: { "content-type": type },
          body,
        });
        return [
          response.status,
          response.status === 200 ? (await response.json()).status : null,
        ];
      },
      [body, type],
    );
  expect(
    await post(
      "action=add&product=101&quantity=1",
      "application/x-www-form-urlencoded",
    ),
  ).toEqual([415, null]);
  expect(await post("{")).toEqual([200, "failed"]);
  expect(await post("null")).toEqual([200, "failed"]);
  expect(
    await post(
      JSON.stringify({ action: "add", product: "../carts", quantity: 1 }),
    ),
  ).toEqual([200, "failed"]);
  expect(
    await post(JSON.stringify({ action: "add", product: "101", quantity: 11 })),
  ).toEqual([200, "invalid"]);
  expect(await post(JSON.stringify({ action: "remove", item: "x y" }))).toEqual(
    [200, "failed"],
  );
  expect(
    (await page.context().cookies()).some(({ name }) => name === "poetry-cart"),
  ).toBe(false);
});

test("the drawer steps within stock, removes with an undo row and restores the line", async ({
  page,
}) => {
  await addToCart(page, "/shop/german-only", "4");
  const book = line(page, "Nur auf Deutsch");
  const more = book.getByRole("button", { name: "Ein Exemplar mehr" });
  const fewer = book.getByRole("button", { name: "Ein Exemplar weniger" });
  await more.click();
  await expect(book.locator("output")).toHaveText("5");
  await expect(more).toHaveAttribute("aria-disabled", "true");
  await expect(book.locator(".cart-line-hint")).toHaveText(
    "Nur noch 5 vorrätig",
  );
  // Pressing again at the limit sends nothing; the control keeps focus.
  await more.press("Enter");
  await expect(more).toBeFocused();
  await expect(page.locator("#cart-status")).toHaveText(
    "Menge 5, Zwischensumme 75,00 €",
  );
  await expect(book.locator("output")).toHaveText("5");
  for (let step = 0; step < 4; step++) await fewer.click();
  await expect(book.locator("output")).toHaveText("1");
  await expect(fewer).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".shop-totals")).toContainText("15,00 €");
  await expect(page.locator("#cart-status")).toHaveText(
    "Menge 1, Zwischensumme 15,00 €",
  );

  await book.getByRole("button", { name: "Entfernen" }).click();
  const undo = page.getByRole("button", { name: "Rückgängig" });
  await expect(undo).toBeFocused();
  await expect(page.locator(".cart-undo span")).toHaveText(
    `„${isolated("Nur auf Deutsch")}“ entfernt.`,
  );
  await expect(page.getByText("Dein Warenkorb ist leer.")).toBeVisible();
  await expect(page.locator(".cart-foot")).toHaveCount(0);
  await expect(page.locator(".cart-fab")).toHaveCount(0);
  await undo.click();
  await expect(
    book.getByRole("link", { name: "Nur auf Deutsch" }),
  ).toBeFocused();
  await expect(page.locator("#cart-status")).toHaveText(
    `„${isolated("Nur auf Deutsch")}“ ist wieder im Warenkorb.`,
  );
  await expect(book.locator("output")).toHaveText("1");

  // Pressing the disabled "+" at the limit reads the limit again.
  await addToCart(page, "/shop/german-only", "4");
  await expect(book.locator("output")).toHaveText("5");
  await expect(more).toHaveAttribute("aria-disabled", "true");
  await more.press("Enter");
  await expect(page.locator("#cart-status")).toHaveText("Nur noch 5 vorrätig");

  // Removing right after a step: the waiting change is dropped, no error follows.
  await fewer.click();
  await book.getByRole("button", { name: "Entfernen" }).click();
  await expect(page.getByRole("button", { name: "Rückgängig" })).toBeFocused();
  // A double press on Undo restores the line once.
  await page.getByRole("button", { name: "Rückgängig" }).dblclick();
  await expect(book.locator("output")).toHaveText("5");
  await page.waitForTimeout(500);
  await expect(book.locator("output")).toHaveText("5");
  await expect(notice(page, "error")).toHaveCount(0);
});

test("the shop grid aligns its rows, never scrolls sideways and skips motion when reduced", async ({
  page,
}) => {
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/shop");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px`,
    ).toBe(true);
  }
  const prices = await page
    .locator(".book-price")
    .evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    );
  // The four test books fit one row at 1280px; every price sits on the same line.
  expect(prices).toHaveLength(4);
  expect(new Set(prices).size).toBe(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await hydrated(page, ".cart-drawer");
  // Count view transitions the drawer starts; with reduced motion there are none.
  await page.evaluate(() => {
    const counted = window as unknown as { transitions: number };
    counted.transitions = 0;
    new MutationObserver(() => {
      if (document.documentElement.hasAttribute("data-cart-transition"))
        counted.transitions++;
    }).observe(document.documentElement, { attributes: true });
  });
  await page
    .locator(".book-card", { hasText: "Sei neben mir" })
    .getByRole("button", { name: "In den Warenkorb" })
    .click();
  await expect(drawer(page)).toHaveAttribute("open");
  await expect(line(page, "Sei neben mir")).toHaveAttribute("data-fresh", "");
  expect(
    await line(page, "Sei neben mir").evaluate(
      (element) => element.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
  // Still tinted, just without motion.
  expect(
    await line(page, "Sei neben mir").evaluate(
      (element) => getComputedStyle(element, "::before").backgroundColor,
    ),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "Warenkorb schließen" }).click();
  await expect(drawer(page)).not.toHaveAttribute("open");
  expect(
    await page.evaluate(
      () => (window as unknown as { transitions: number }).transitions,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("cart rejects cross-site posts, invalid quantities and an eighth distinct book", async ({
  page,
}) => {
  const crossSite = await page.request.post("/shop/cart", {
    form: { action: "add", product: "101", quantity: "1" },
    headers: { origin: "https://evil.example" },
    maxRedirects: 0,
  });
  expect(crossSite.status()).toBe(403);
  await page.goto("/shop");
  // Same-origin browser posts carry the Secure cart cookie, unlike the API request context.
  const post = (product: string, quantity = "1") =>
    page.evaluate(
      async (form) =>
        new URL(
          (
            await fetch("/shop/cart", {
              method: "POST",
              body: new URLSearchParams(form),
            })
          ).url,
        ).search,
      { action: "add", product, quantity },
    );
  expect(await post("101", "11")).toBe("?status=invalid");
  for (const product of ["101", "201", "202", "203", "204", "205", "206"])
    expect(await post(product)).toBe(`?status=added&product=${product}`);
  expect(await post("207")).toBe("?status=limit");
  expect(await post("101", "10")).toBe("?status=invalid");
  // With JavaScript the refused add shows the error notification instead of opening the drawer.
  await page.goto("/shop");
  await hydrated(page, ".cart-drawer");
  await page
    .locator(".book-card", { hasText: "Nur auf Deutsch" })
    .getByRole("button", { name: "In den Warenkorb" })
    .click();
  await expect(noticeText(page, "error")).toHaveText(
    "Pro Bestellung passen bis zu 7 verschiedene Bücher in den Warenkorb.",
  );
  await expect(drawer(page)).not.toHaveAttribute("open");
  await page.goto("/shop/cart?status=limit");
  await expect(noticeText(page, "error")).toHaveText(
    "Pro Bestellung passen bis zu 7 verschiedene Bücher in den Warenkorb.",
  );
  await expect(page.locator(".cart-line")).toHaveCount(7);
});

test("checkout validates fields in the browser and starts payment without forwarding cookies", async ({
  page,
}) => {
  const errors = collectErrors(page);
  // Unique per run, so parallel or repeated runs do not share payment starts in the mock CMS.
  const buyer = `reader-${Date.now()}@example.org`;
  await stubStripe(page, "decline");
  await addToCart(page, "/shop/beside-me");
  await page.getByRole("link", { name: "Zur Kasse" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kasse");
  await expect(
    page.getByRole("link", { name: "AGB & Widerruf" }).first(),
  ).toHaveAttribute("href", "/agb");
  // Hydrated: the browser validates with the shared schema.
  await hydrated(page, ".checkout-form");

  const email = page.locator("#email");
  const emailField = page.locator(".field", { has: email });
  const height = (await emailField.boundingBox())!.height;
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#firstName")).toBeFocused();
  await expect(email).not.toHaveAttribute("aria-invalid");

  await email.fill("reader@");
  await expect(email).not.toHaveAttribute("aria-invalid");
  await page.keyboard.press("Tab");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "email-error");
  await expect(page.locator("#email-error")).toHaveText(
    "Bitte gib eine gültige E-Mail-Adresse ein.",
  );
  await expect(page.locator("#email-error")).toBeVisible();
  await expect(page.locator("#email-hint")).toBeHidden();
  expect((await emailField.boundingBox())!.height).toBe(height);
  // Hint and errors share one reserved line instead of stacking.
  expect(
    (await emailField.locator(".field-message").boundingBox())!.height,
  ).toBe((await page.locator("#email-error").boundingBox())!.height);

  await email.pressSequentially("example.org");
  await expect(email).not.toHaveAttribute("aria-invalid");
  await expect(email).toHaveAttribute("aria-describedby", "email-hint");
  await expect(page.locator("#email-hint")).toBeVisible();
  expect((await emailField.boundingBox())!.height).toBe(height);
  // Once fixed, the error waits for the next blur instead of flashing while typing.
  await email.fill("reader@");
  await expect(email).not.toHaveAttribute("aria-invalid");
  await email.fill(buyer);

  const postalField = page.locator(".field", {
    has: page.locator("#postalCode"),
  });
  const postalHeight = (await postalField.boundingBox())!.height;
  await page.locator("#postalCode").fill("1099");
  await page.locator("#postalCode").blur();
  await expect(page.locator("#postalCode-error")).toHaveText(
    "Bitte gib eine fünfstellige Postleitzahl ein.",
  );
  expect((await postalField.boundingBox())!.height).toBe(postalHeight);

  // A valid field that was left stays quiet while it is edited again.
  await page.locator("#city").fill("Berlin");
  await page.locator("#city").blur();
  await page.locator("#city").fill("");
  await expect(page.locator("#city")).not.toHaveAttribute("aria-invalid");

  await page
    .getByRole("button", { name: "Zahlungspflichtig bestellen" })
    .click();
  // The first name is optional (wallets often give one name); the last name is not.
  await expect(page.locator("#lastName")).toBeFocused();
  await expect(page.locator("#lastName")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#firstName")).not.toHaveAttribute("aria-invalid");
  await expect(page.locator("#lastName-error")).toHaveText(
    "Bitte fülle dieses Feld aus.",
  );
  await expect(page.locator("#company")).not.toHaveAttribute("aria-invalid");
  await expect(notice(page, "error")).toHaveCount(0);
  expect(await initiatedFor(buyer)).toBeUndefined();
  // Contrast is checked once the 160 ms fade has ended.
  await expect(page.locator("#city-error")).toHaveCSS("opacity", "1");
  await expectAccessible(page);

  await fillCheckout(page, buyer);
  const pay = page.getByRole("button", { name: "Zahlungspflichtig bestellen" });
  await pay.click();
  await expect(noticeText(page, "error")).toHaveText("Your card was declined.");
  await expect(notice(page, "error").locator("..")).toHaveAttribute(
    "aria-live",
    "assertive",
  );
  await expect(pay).toBeFocused();
  await expect(page).toHaveURL(/\/shop\/checkout$/);
  // Deferred intent: Elements load with the current total, which includes shipping.
  const stub = await stripeStub(page);
  expect(stub.options).toMatchObject({
    mode: "payment",
    amount: 2400,
    currency: "eur",
    locale: "de",
  });
  expect(stub.created.payment).toMatchObject({
    layout: { type: "accordion" },
    wallets: { applePay: "never", googlePay: "never" },
    // Our form already asks for email and country.
    fields: {
      billingDetails: { email: "never", address: { country: "never" } },
    },
  });
  const started = await initiatedFor(buyer);
  expect(stub.confirmed[0]).toMatchObject({
    clientSecret: `${started.paymentIntentID}_secret_test`,
    confirmParams: {
      return_url: expect.stringMatching(/\/shop\/checkout\/complete$/),
      payment_method_data: {
        billing_details: { email: buyer, address: { country: "DE" } },
      },
    },
  });
  expect(started).toMatchObject({
    cookie: null,
    body: {
      customerEmail: buyer,
      shippingAddress: {
        country: "DE",
        postalCode: "10999",
        firstName: "Amira",
      },
    },
  });
  expect(started.body.secret).toMatch(/^secret/);
  expect(await page.content()).not.toContain(started.body.secret);
  // The order code from payment start waits in the httpOnly checkout cookie for the confirmation page.
  const checkoutCookie = (await page.context().cookies()).find(
    ({ name }) => name === "poetry-checkout",
  )!;
  expect(checkoutCookie.httpOnly).toBe(true);
  expect(JSON.parse(decodeURIComponent(checkoutCookie.value))).toMatchObject({
    orderCode: started.orderCode,
    paymentIntentID: started.paymentIntentID,
  });

  // A retry with the same cart and contact confirms the same PaymentIntent.
  await pay.click();
  await expect
    .poll(async () => (await stripeStub(page)).confirmed.length)
    .toBe(2);
  expect((await stripeStub(page)).confirmed[1]!.clientSecret).toBe(
    stub.confirmed[0]!.clientSecret,
  );
  const { initiate } = await (await fetch(`${cmsURL}/shop-log`)).json();
  expect(
    initiate.filter(
      (entry: { body: { customerEmail: string } }) =>
        entry.body.customerEmail === buyer,
    ),
  ).toHaveLength(1);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("checkout keeps what was typed before the form hydrated", async ({
  page,
}) => {
  await addToCart(page, "/shop/beside-me");
  let release = () => {};
  const loaded = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/_astro/CheckoutForm.*.js", async (route) => {
    await loaded;
    await route.continue();
  });
  await page.goto("/shop/checkout", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill("early@");
  release();
  await hydrated(page, ".checkout-form");
  await expect(page.locator("#email")).toHaveValue("early@");
  // Counted as edited, so leaving it shows the error.
  await page.locator("#email").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
});

test("one press of the order button starts one payment", async ({ page }) => {
  await stubStripe(page, "decline");
  await addToCart(page, "/shop/beside-me");
  await page.goto("/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, "twice@example.org");
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let requests = 0;
  await page.route("**/api/checkout?**", async (route) => {
    requests++;
    await held;
    await route.continue();
  });
  const submit = page.getByRole("button", {
    name: "Zahlungspflichtig bestellen",
  });
  await submit.click();
  await expect(
    page.getByRole("button", { name: "Zahlung wird verarbeitet …" }),
  ).toBeDisabled();
  await expect(page.locator(".checkout-form")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page
    .getByRole("button", { name: "Zahlung wird verarbeitet …" })
    .click({ force: true });
  await page.locator("#city").press("Enter");
  release();
  await expect(noticeText(page, "error")).toHaveText("Your card was declined.");
  expect(requests).toBe(1);
  expect((await stripeStub(page)).confirmed).toHaveLength(1);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("checkout reports server errors in the fields and one notification", async ({
    page,
  }) => {
    await addToCart(page, "/shop/beside-me", "1", { js: false });
    await page.goto("/shop/checkout");
    await fillCheckout(page, "reader@example");
    await page.locator("#lastName").fill("");
    await page.locator("#postalCode").fill("1099");
    // Keyboard submit: in this no-JavaScript page Playwright's click kept reporting the
    // scrolled button as not stable until it timed out.
    await page.locator("#postalCode").press("Enter");
    await expect(noticeText(page, "error")).toHaveText(
      "Bitte prüfe die markierten Felder.",
    );
    await expect(page.locator("#email")).toBeFocused();
    await expect(page.locator("#email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator("#email-error")).toHaveText(
      "Bitte gib eine gültige E-Mail-Adresse ein.",
    );
    await expect(page.locator("#postalCode-error")).toHaveText(
      "Bitte gib eine fünfstellige Postleitzahl ein.",
    );
    await expect(page.locator("#lastName-error")).toHaveText(
      "Bitte fülle dieses Feld aus.",
    );
    await expect(page.locator("#postalCode")).toHaveValue("1099");
    await expect(page.locator("#city")).not.toHaveAttribute("aria-invalid");
    // The skip link leaves the notification alone; its close link hides it in place.
    await page.locator(".skip-link").press("Enter");
    await expect(notice(page, "error")).toBeVisible();
    const close = notice(page, "error").getByRole("link", {
      name: "Meldung schließen",
    });
    await expect(close).toHaveAttribute("href", "#notice-closed");
    await close.press("Enter");
    await expect(notice(page, "error")).toBeHidden();
    await expect(page.locator("#postalCode")).toHaveValue("1099");

    // A valid form keeps its values; paying needs JavaScript, which a quiet note says.
    await fillCheckout(page, "nojs@example.org");
    await page.locator("#postalCode").press("Enter");
    await expect(page.locator("#city")).toHaveValue("Berlin");
    await expect(
      page.getByText("Für die Zahlung wird JavaScript benötigt.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.locator(".express")).toBeHidden();
    await expect(notice(page, "error")).toHaveCount(0);
    expect(await initiatedFor("nojs@example.org")).toBeUndefined();
  });

  test("cart status closes with a link to the page without status", async ({
    page,
  }) => {
    await page.goto("/en/shop/cart?status=failed");
    const close = notice(page, "error").getByRole("link", {
      name: "Close message",
    });
    await expect(close).toHaveAttribute("href", "/en/shop/cart");
    await close.press("Enter");
    await expect(page).toHaveURL(/\/en\/shop\/cart$/);
    await expect(notice(page, "error")).toHaveCount(0);
  });
});

test("success notifications close themselves; errors stay until closed", async ({
  page,
}) => {
  await page.goto("/en/shop/cart");
  const heading = page.getByRole("heading", { level: 1 });
  const top = (await heading.boundingBox())!.y;

  await page.goto("/en/shop/cart?status=removed");
  await expect(notice(page, "success")).toBeVisible();
  expect((await heading.boundingBox())!.y).toBe(top);
  // Announced once after hydration: the visible text is repeated in the live region.
  await expect(page.locator('[aria-live="polite"] .sr-only')).toHaveText(
    "The book has been removed from your cart.",
  );
  await expect(notice(page, "success").locator(".notice-text")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(notice(page, "success")).not.toBeFocused();
  await fastAnimations(page);
  await expect(notice(page, "success")).toHaveCount(0);

  // A pointer resting on it pauses the timer.
  await page.goto("/en/shop/cart?status=updated");
  await notice(page, "success").hover();
  await fastAnimations(page);
  await page.waitForTimeout(300);
  await expect(notice(page, "success")).toBeVisible();
  await page.mouse.move(5, 600);
  await expect(notice(page, "success")).toHaveCount(0);

  // Reduced motion fades instead of sliding but keeps the reading time.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/shop/cart?status=updated");
  await expect(notice(page, "success")).toBeVisible();
  await expect(notice(page, "success")).toHaveCSS("translate", "none");
  await fastAnimations(page);
  await expect(notice(page, "success")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.goto("/en/shop/cart?status=failed");
  await expect(noticeText(page, "error")).toHaveText(
    "Your cart could not be updated. Please try again.",
  );
  await expect(notice(page, "error")).toBeFocused();
  expect((await heading.boundingBox())!.y).toBe(top);
  await fastAnimations(page);
  // 300 ms at 100× is 30 s.
  await page.waitForTimeout(300);
  await expect(notice(page, "error")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(notice(page, "error")).toHaveCount(0);
  await expect(page.locator("#main")).toBeFocused();
});

test.describe("at 375px with an error notice open", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("a server-checked checkout focuses its first invalid field below the notice", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 375, height: 667 },
      extraHTTPHeaders: { "x-forwarded-for": buyerAddress() },
    });
    const page = await context.newPage();
    await addToCart(page, "/shop/beside-me", "1", { js: false });
    await page.goto("/shop/checkout");
    await fillCheckout(page, "reader@example");
    await page.locator("#postalCode").press("Enter");
    await expect(notice(page, "error")).toBeVisible();
    await expect(page.locator("#email")).toBeFocused();
    await expectFocusedVisible(page);
    await context.close();
  });

  test("the cart keeps every focused control clear of the notice and the bottom bar", async ({
    page,
  }) => {
    await addToCart(page, "/en/shop/beside-me");
    await page.goto("/en/shop/cart?status=failed");
    await expect(notice(page, "error")).toBeFocused();
    await expectFocusNeverObscured(page, ".site-footer nav a >> nth=-1");
  });
});

test("keyboard focus on the close link moves to the close button on hydration", async ({
  page,
}) => {
  let release = () => {};
  const loaded = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/_astro/PageNotification.*.js", async (route) => {
    await loaded;
    await route.continue();
  });
  await page.goto("/en/shop/cart?status=failed", {
    waitUntil: "domcontentloaded",
  });
  await notice(page, "error")
    .getByRole("link", { name: "Close message" })
    .focus();
  release();
  await expect(
    notice(page, "error").getByRole("button", { name: "Close message" }),
  ).toBeFocused();
});

test("touch: a tap on a success notice does not stop its timer", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 700 },
  });
  const page = await context.newPage();
  await page.goto("/en/shop/cart?status=updated");
  await page.locator(".notice-text").tap();
  await fastAnimations(page);
  await expect(notice(page, "success")).toHaveCount(0);
  await context.close();
});

test("the bottom bar never covers a focused checkout field", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await addToCart(page, "/shop/beside-me");
  await page.goto("/shop/checkout");
  // The bar's resting position, even if it has tucked away while scrolling.
  const barTop = await page.evaluate(
    () =>
      innerHeight -
      document.querySelector<HTMLElement>(".site-header nav")!.offsetHeight,
  );
  await page.locator("#email").focus();
  for (const id of [
    "#firstName",
    "#lastName",
    "#addressLine1",
    ".more summary",
    "#postalCode",
    "#city",
  ]) {
    await page.keyboard.press("Tab");
    await expect(page.locator(id)).toBeFocused();
    // Focus scrolls smoothly; wait for it to settle.
    await expect
      .poll(
        async () => {
          const field = (await page.locator(id).boundingBox())!;
          return field.y + field.height;
        },
        { message: id },
      )
      .toBeLessThanOrEqual(barTop);
  }
});

test("Arabic checkout completes the order once and clears the cart", async ({
  page,
  context,
}) => {
  const errors = collectErrors(page);
  await stubStripe(page, "redirect");
  await page.setViewportSize({ width: 360, height: 800 });
  await addToCart(page, "/ar/shop/passing-words", "2");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".shop-totals")).toContainText("٢٤٫٠٠");
  await expectAccessible(page);
  await page.goto("/ar/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, "arabic@example.org");
  await page.getByRole("button", { name: "اطلب مع الالتزام بالدفع" }).click();
  await expect(page).toHaveURL(/\/ar\/shop\/checkout\/complete$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "شكراً لطلبك!",
  );
  const { paymentIntentID, orderCode } =
    await initiatedFor("arabic@example.org");
  const code = `${orderCode.slice(0, 4)}-${orderCode.slice(4)}`;
  await expect(page.locator(".order-code-value")).toHaveText(code);
  expect((await context.cookies()).map(({ name }) => name)).toEqual([
    "poetry-order",
  ]);
  await page.reload();
  await expect(page.locator(".order-code-value")).toHaveText(code);
  // The summary keeps its side and the book; only the text mirrors.
  await expect(page.locator(".summary-lines")).toContainText("كلمات عابرة");
  const { confirm } = await (await fetch(`${cmsURL}/shop-log`)).json();
  expect(
    confirm.filter(
      (entry: { paymentIntentID: string }) =>
        entry.paymentIntentID === paymentIntentID,
    ),
  ).toHaveLength(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("a failed payment keeps the cart and leads back to checkout", async ({
  page,
  context,
}) => {
  const declinedEmail = uniqueEmail("declined");
  await stubStripe(page, "decline");
  await addToCart(page, "/en/shop/beside-me");
  await page.goto("/en/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, declinedEmail);
  await page
    .getByRole("button", { name: "Order with obligation to pay" })
    .click();
  await expect(noticeText(page, "error")).toHaveText("Your card was declined.");
  const { paymentIntentID } = await initiatedFor(declinedEmail);

  // Stripe's own redirect says succeeded; the PaymentIntent, asked again, decides.
  await page.goto(
    `/en/shop/checkout/complete?payment_intent=${paymentIntentID}&redirect_status=succeeded`,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Payment not completed",
  );
  // No notice: it would cover the heading and the summary toggle on a phone.
  await expect(notice(page, "error")).toHaveCount(0);
  await expect(page.locator(".complete .ui-text")).toHaveText(
    "Your cart is still saved, so you can try again.",
  );
  await expect(page.locator(".summary-lines")).toContainText("Sei neben mir");
  await page.setViewportSize({ width: 375, height: 667 });
  await expectFocusNeverObscured(page, ".site-footer nav a >> nth=-1");
  await page.setViewportSize({ width: 1280, height: 720 });
  expect((await context.cookies()).map(({ name }) => name).sort()).toEqual([
    "poetry-cart",
    "poetry-cart-count",
    "poetry-checkout",
  ]);
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/en\/shop\/checkout$/);
  await expect(page.locator("#email")).toHaveValue(declinedEmail);
});

test("a payment the CMS cannot confirm yet, or a foreign return, keeps the cart", async ({
  page,
  context,
}) => {
  const pendingEmail = uniqueEmail("pending");
  await stubStripe(page, "decline");
  await addToCart(page, "/en/shop/beside-me");
  await page.goto("/en/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, pendingEmail);
  await page
    .getByRole("button", { name: "Order with obligation to pay" })
    .click();
  await expect(noticeText(page, "error")).toHaveText("Your card was declined.");
  const { paymentIntentID } = await initiatedFor(pendingEmail);
  const cookieNames = async () =>
    (await context.cookies()).map(({ name }) => name).sort();

  await page.goto(
    "/en/shop/checkout/complete?payment_intent=pi_foreign&redirect_status=succeeded",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your payment is being checked",
  );
  expect(await cookieNames()).toContain("poetry-checkout");

  // Paid at Stripe, but the CMS has no order yet: the webhook settles it, a reload asks again.
  const returnPath = `/en/shop/checkout/complete?payment_intent=${paymentIntentID}&redirect_status=succeeded`;
  await page.goto(returnPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your payment is being checked",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Please do not pay again." }),
  ).toBeVisible();
  // Stripe has the money, so the code from payment start is shown already.
  const { orderCode } = await initiatedFor(pendingEmail);
  await expect(page.locator(".order-code-value")).toHaveText(
    `${orderCode.slice(0, 4)}-${orderCode.slice(4)}`,
  );
  expect(await cookieNames()).toEqual([
    "poetry-cart",
    "poetry-cart-count",
    "poetry-checkout",
  ]);
  await page.reload();
  const { confirm } = await (await fetch(`${cmsURL}/shop-log`)).json();
  expect(
    confirm.filter(
      (entry: { paymentIntentID: string }) =>
        entry.paymentIntentID === paymentIntentID,
    ).length,
  ).toBeGreaterThanOrEqual(2);
});

test("a paid order shows its code, payment, address and next steps, and links to its status", async ({
  page,
  context,
}) => {
  const paidEmail = uniqueEmail("paid");
  const errors = collectErrors(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await stubStripe(page, "redirect");
  await addToCart(page, "/shop/beside-me", "2");
  await page.goto("/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, paidEmail);
  await page
    .getByRole("button", { name: "Zahlungspflichtig bestellen" })
    .click();
  await expect(page).toHaveURL(/\/shop\/checkout\/complete$/);
  const { orderCode } = await initiatedFor(paidEmail);
  const code = `${orderCode.slice(0, 4)}-${orderCode.slice(4)}`;

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Danke für deine Bestellung!",
  );
  await expect(page.locator(".order-code-value")).toHaveText(code);
  const facts = page.locator(".order-facts");
  await expect(facts).toContainText(`Bestätigung an${paidEmail}`);
  await expect(facts).toContainText("ZahlungVisa •••• 4242");
  await expect(facts).toContainText("Amira Haddad");
  await expect(facts).toContainText("10999 Berlin");
  await expect(page.locator(".order-steps li")).toHaveText([
    /^Bezahlt am \d{1,2}\. \S+ \d{4}$/,
    "Wir packen deine Bücher1–2 Werktage",
    "Versand mit der PostLieferung in 2–4 Werktagen",
  ]);
  await expect(
    page.locator('.order-steps [aria-current="step"]'),
  ).toContainText("Wir packen");
  await expect(page.locator(".summary-lines")).toContainText("Sei neben mir");
  await expect(page.locator(".shop-totals")).toContainText("44,00");
  // The order cookie holds no contact, lives 15 minutes and only on this page.
  const receipt = (await context.cookies()).find(
    ({ name }) => name === "poetry-order",
  )!;
  expect(receipt.path).toBe("/shop/checkout/complete");
  expect(receipt.expires * 1000 - Date.now()).toBeLessThanOrEqual(
    15 * 60 * 1000,
  );
  const stored = decodeURIComponent(receipt.value);
  for (const personal of [paidEmail, "Haddad", "10999"])
    expect(stored).not.toContain(personal);
  // Stripe's parameters, with the client secret, have left the address bar.
  expect(new URL(page.url()).search).toBe("");
  await page.reload();
  await expect(page.locator(".order-code-value")).toHaveText(code);
  await expect(facts).toHaveText("ZahlungVisa •••• 4242");
  await expect(page.locator(".order-steps li")).toHaveCount(3);

  await hydrated(page, ".order-code");
  await page.getByRole("button", { name: "Kopieren" }).click();
  await expect(page.getByRole("button", { name: "Kopiert" })).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Bestellcode kopiert." }),
  ).toHaveCount(1);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await expectAccessible(page);
  expect(errors).toEqual([]);

  await page.getByRole("link", { name: "Status jederzeit abrufen" }).click();
  await expect(page).toHaveURL(`/bestellstatus?code=${orderCode}`);
  await expect(page.locator("#code")).toHaveValue(code);
  await expect(page.getByText("Aus deinem Link übernommen.")).toBeVisible();
  await page.locator("#email").fill(paidEmail);
  await page.getByRole("button", { name: "Status anzeigen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bezahlt, wird gepackt",
  );
});

test("a SEPA debit still processing shows its code and the debit, and clears the cart", async ({
  page,
  context,
}) => {
  const sepaEmail = uniqueEmail("sepa");
  await stubStripe(page, "redirect");
  await page.setViewportSize({ width: 375, height: 812 });
  await addToCart(page, "/en/shop/beside-me");
  await page.goto("/en/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, sepaEmail);
  await page
    .getByRole("button", { name: "Order with obligation to pay" })
    .click();
  await expect(page).toHaveURL(/\/en\/shop\/checkout\/complete$/);
  const { orderCode } = await initiatedFor(sepaEmail);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Thank you for your order!",
  );
  await expect(page.locator(".order-code-value")).toHaveText(
    `${orderCode.slice(0, 4)}-${orderCode.slice(4)}`,
  );
  await expect(page.locator(".order-facts-detail")).toHaveText(
    "IBAN •••• 3000",
  );
  await expect(page.locator(".order-facts")).toContainText("SEPA Direct Debit");
  await expect(page.locator(".order-steps li")).toHaveText([
    /^Order received on /,
    "Direct debit in progressabout 6 working days",
    "We pack your books1–2 working days",
    "Sent by postDelivery in 2–4 working days",
  ]);
  expect((await context.cookies()).map(({ name }) => name)).toEqual([
    "poetry-order",
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expectAccessible(page);

  await page.goto("/en/shop/checkout");
  await expect(page).toHaveURL(/\/en\/shop\/cart$/);
});

test("the confirmation without a return or an order goes to the shop", async ({
  page,
  context,
}) => {
  await page.goto("/en/shop/checkout/complete");
  await expect(page).toHaveURL(/\/en\/shop$/);
  // An order cookie from before codes existed holds only the order ID.
  await context.addCookies([
    {
      name: "poetry-order",
      value: "1001",
      url: new URL("/en/shop/checkout/complete", page.url()).href,
    },
  ]);
  await page.goto("/en/shop/checkout/complete");
  await expect(page).toHaveURL(/\/en\/shop$/);
});

test("out-of-stock responses from the CMS keep the address and point back to the cart", async ({
  page,
}) => {
  await stubStripe(page, "decline");
  await addToCart(page, "/en/shop/german-only");
  await page.goto("/en/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, "stock@example.org");
  await page
    .getByRole("button", { name: "Order with obligation to pay" })
    .click();
  await expect(notice(page, "error")).toContainText(
    "no longer available in this quantity",
  );
  expect((await stripeStub(page)).confirmed).toHaveLength(0);
  await expect(page.locator("#city")).toHaveValue("Berlin");
  await expect(
    notice(page, "error").getByRole("link", { name: "Edit cart" }),
  ).toHaveAttribute("href", "/en/shop/cart");
});

test("unavailable cart lines block checkout until they are changed", async ({
  page,
}) => {
  await page.goto("/shop");
  // Only one copy of book 300 is left; the detail page would cap the quantity.
  await page.evaluate(() =>
    fetch("/shop/cart", {
      method: "POST",
      body: new URLSearchParams({
        action: "add",
        product: "300",
        quantity: "2",
      }),
    }),
  );
  await page.goto("/shop/cart");
  await expect(page.locator(".cart-line-error")).toHaveText(
    "Dieses Buch ist in dieser Menge nicht verfügbar. Bitte verringere die Menge oder entferne es.",
  );
  await expect(
    page.getByRole("button", { name: "Ein Exemplar mehr" }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Zur Kasse" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(
    page.getByRole("link", { name: "Zur Kasse" }),
  ).not.toHaveAttribute("href");
  await expect(
    page.getByText("Bitte passe die markierten Bücher an"),
  ).toBeVisible();
  await page.goto("/shop/checkout");
  await expect(page).toHaveURL(/\/shop\/cart$/);

  // The drawer allows any decrease, even one that stays above the stock.
  await page.evaluate(() =>
    fetch("/shop/cart", {
      method: "POST",
      body: new URLSearchParams({
        action: "add",
        product: "300",
        quantity: "1",
      }),
    }),
  );
  await page.goto("/shop");
  await hydrated(page, ".cart-drawer");
  await page.locator(".cart-fab").click();
  await line(page, "Extra 300")
    .getByRole("button", { name: "Ein Exemplar weniger" })
    .click();
  await expect(line(page, "Extra 300").locator("output")).toHaveText("2");
  await expect(page.locator("#cart-status")).toContainText("Menge 2");
  await page.getByRole("button", { name: "Warenkorb schließen" }).click();
  await page.goto("/shop/cart");
  await page.getByRole("button", { name: "Ein Exemplar weniger" }).click();
  await expect(page.getByRole("link", { name: "Zur Kasse" })).toHaveAttribute(
    "href",
    "/shop/checkout",
  );
});

test("unsaved shop settings keep the shop visible but disable checkout", async ({
  page,
}) => {
  await addToCart(page, "/uk/shop/beside-me");
  await expect(page.locator(".shop-totals div")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Оформити замовлення" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText("Онлайн-оплата зараз недоступна.", { exact: false }),
  ).toBeVisible();
  await page.goto("/uk/shop/checkout");
  await expect(
    page.getByText("Онлайн-оплата зараз недоступна.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("form.checkout-form")).toHaveCount(0);
});

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("checkout splits summary and form, with the legal facts where the law wants them", async ({
  page,
}) => {
  await stubStripe(page, "decline");
  await addToCart(page, "/shop/beside-me");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/shop/checkout");
  await hydrated(page, ".checkout-form");
  const summary = page.locator(".checkout-summary");
  const main = page.locator(".checkout-main");
  // Wide: the grey summary sits left and stays open; the button has the total right above it.
  expect((await summary.boundingBox())!.x).toBeLessThan(
    (await main.boundingBox())!.x,
  );
  await expect(
    page.getByRole("heading", { name: "Deine Bestellung" }),
  ).toBeVisible();
  await expect(page.locator(".summary-toggle")).toBeHidden();
  await expect(summary).toContainText("Sei neben mir");
  await expect(summary.locator(".shop-totals")).toContainText("24,00 €");
  await expect(summary).toContainText("§ 19 UStG");
  const facts = page.locator(".order-facts");
  await expect(facts.locator(".order-book")).toBeHidden();
  await expect(facts.locator(".order-total")).toHaveText(
    /Gesamtsumme\s*24,00\s€/,
  );
  const button = page.getByRole("button", {
    name: "Zahlungspflichtig bestellen",
  });
  const total = (await facts.locator(".order-total").boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  expect(buttonBox.y - (total.y + total.height)).toBeLessThan(40);
  await expect(button).toHaveText("Zahlungspflichtig bestellen");
  // Easy to read: at least 17 px bold and 52 px tall, at every width.
  const readable = async () => {
    const style = await button.evaluate((element) => {
      const { fontSize, fontWeight } = getComputedStyle(element);
      return {
        size: parseFloat(fontSize),
        weight: Number(fontWeight),
        height: element.getBoundingClientRect().height,
      };
    });
    expect(style.size).toBeGreaterThanOrEqual(17);
    expect(style.weight).toBeGreaterThanOrEqual(700);
    expect(style.height).toBeGreaterThanOrEqual(52);
  };
  await readable();
  // Germany is shown as the only delivery country, not offered as a choice.
  await expect(page.locator(".country")).toContainText("Deutschland");
  await expect(page.locator(".country")).toContainText("einziges Lieferland");
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.locator(".legal")).toContainText("innerhalb von 14 Tagen");
  // Delivery area and payment methods open the checkout; terms, withdrawal and privacy sit by the button.
  await expect(main.locator(".shop-facts")).toContainText(
    "Lieferung nur innerhalb Deutschlands",
  );
  await expect(main.locator(".shop-facts")).toContainText(
    "Zahlungsarten: Karte, Apple Pay, Google Pay, Wero, SEPA-Lastschrift",
  );
  const legal = page.locator(".legal");
  await expect(legal.getByRole("link", { name: "AGB" })).toHaveAttribute(
    "href",
    "/agb",
  );
  await expect(
    legal.getByRole("link", {
      name: "Widerrufsbelehrung und Muster-Widerrufsformular",
    }),
  ).toHaveAttribute("href", "/agb");
  await expect(
    legal.getByRole("link", { name: "Datenschutz" }),
  ).toHaveAttribute("href", /datenschutz/);
  await expect(
    page.getByRole("link", { name: /Warenkorb (ändern|bearbeiten)/ }),
  ).toHaveCount(0);
  // The wallet buttons lead, then "oder" and the form.
  await expect(page.locator(".express-buttons")).toHaveText("Wallet buttons");
  await expect(page.locator(".express-or")).toHaveText("oder");
  const { created } = await stripeStub(page);
  expect(created.expressCheckout).toMatchObject({
    buttonType: { applePay: "plain" },
    emailRequired: true,
    shippingAddressRequired: true,
    allowedShippingCountries: ["DE"],
    shippingRates: [{ amount: 400 }],
  });
  expect(await noSideScroll(page)).toBe(true);
  await expectAccessible(page);

  // Narrow: a bar with the total opens the full summary; the books stand above the button.
  await page.setViewportSize({ width: 375, height: 800 });
  const toggle = page.locator(".summary-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText("Details anzeigen");
  await expect(toggle).toContainText("24,00 €");
  await expect(
    page.getByRole("heading", { name: "Deine Bestellung" }),
  ).toBeHidden();
  await toggle.click();
  await expect(toggle).toContainText("Details ausblenden");
  await expect(summary.locator(".summary-lines")).toContainText(
    "Sei neben mir",
  );
  await expect(facts.locator(".order-book")).toContainText("Sei neben mir");
  await expect(facts.locator(".order-book")).toContainText("× 1");
  await expect(facts.locator(".order-shipping")).toContainText(
    "Versand (Deutschland)",
  );
  await expect(facts.locator(".order-note")).toContainText("§ 19 UStG");
  // The price note appears once per screen.
  await expect(summary.locator(".shop-note")).toBeHidden();
  await readable();
  expect(await noSideScroll(page)).toBe(true);
  await expectAccessible(page);
});

test("Arabic checkout mirrors its text but keeps the summary on the left", async ({
  page,
}) => {
  await stubStripe(page, "decline");
  await addToCart(page, "/ar/shop/beside-me");
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ar/shop/checkout");
    await hydrated(page, ".checkout-form");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".checkout-main")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".legal")).toContainText("١٤");
    if (width === 1280)
      expect(
        (await page.locator(".checkout-summary").boundingBox())!.x,
      ).toBeLessThan((await page.locator(".checkout-main").boundingBox())!.x);
    expect(await noSideScroll(page)).toBe(true);
  }
  await expectAccessible(page);
});

async function stubAddresses(page: Page) {
  await page.route("**/api/address?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        suggestions: [
          {
            line1: "Hermannstraße 12",
            postalCode: "12049",
            city: "Berlin",
            area: "Neukölln",
          },
          {
            line1: "Hermannstraße 12",
            postalCode: "20095",
            city: "Hamburg",
            area: null,
          },
        ],
      }),
    }),
  );
}

test("the street field suggests addresses: keyboard picks, Escape closes only the list", async ({
  page,
}) => {
  await stubStripe(page, "decline");
  await stubAddresses(page);
  await addToCart(page, "/shop/beside-me");
  await page.goto("/shop/checkout");
  await hydrated(page, ".checkout-form");
  const street = page.getByRole("combobox", { name: "Straße und Hausnummer" });
  const gap = async () =>
    (await page.locator("#postalCode").boundingBox())!.y -
    (await street.boundingBox())!.y;
  const closedGap = await gap();
  await street.pressSequentially("He");
  await expect(street).toHaveAttribute("aria-expanded", "false");
  await street.pressSequentially("rmannstr 12");
  const list = page.getByRole("listbox", { name: "Adressvorschläge" });
  await expect(list.getByRole("option")).toHaveCount(2);
  await expect(street).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("© OpenStreetMap-Mitwirkende")).toBeVisible();
  // The list overlays the form instead of pushing it down.
  expect(await gap()).toBe(closedGap);
  await street.press("ArrowDown");
  await street.press("ArrowDown");
  await street.press("ArrowDown");
  const first = list.getByRole("option").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(street).toHaveAttribute(
    "aria-activedescendant",
    (await first.getAttribute("id"))!,
  );
  await street.press("Escape");
  await expect(list).toBeHidden();
  await expect(street).toBeFocused();
  await expect(street).toHaveValue("Hermannstr 12");
  await street.press("ArrowDown");
  await street.press("Enter");
  await expect(street).toHaveValue("Hermannstraße 12");
  await expect(page.locator("#postalCode")).toHaveValue("12049");
  await expect(page.locator("#city")).toHaveValue("Berlin");
  await expect(list).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Übernommen" }),
  ).toHaveText("Übernommen: Hermannstraße 12, 12049 Berlin.");
});

test("a late address answer after Escape, leaving or new typing never reopens the list", async ({
  page,
}) => {
  await stubStripe(page, "decline");
  // Photon answers slowly: every search waits until the test lets it go.
  const pending: (() => Promise<void>)[] = [];
  await page.route("**/api/address?**", (route) => {
    pending.push(() =>
      route
        .fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            suggestions: [
              {
                line1: "Weserstraße 12",
                postalCode: "12047",
                city: "Berlin",
                area: "Neukölln",
              },
            ],
          }),
        })
        // The page aborted the request.
        .catch(() => {}),
    );
  });
  const answerAll = async () => {
    await Promise.all(pending.splice(0).map((answer) => answer()));
    await page.waitForTimeout(100);
  };
  await addToCart(page, "/shop/beside-me");
  await page.goto("/shop/checkout");
  await hydrated(page, ".checkout-form");
  const street = page.getByRole("combobox", { name: "Straße und Hausnummer" });
  const list = page.getByRole("listbox", { name: "Adressvorschläge" });

  await street.pressSequentially("Weserstraße 12");
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await street.press("Escape");
  await answerAll();
  await expect(list).toBeHidden();
  await expect(street).toHaveAttribute("aria-expanded", "false");

  await street.press("Backspace");
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await page.locator("#postalCode").focus();
  await street.focus();
  await answerAll();
  await expect(list).toBeHidden();

  // Only the answer to the latest typing opens the list.
  await street.pressSequentially("2");
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await answerAll();
  await expect(list.getByRole("option")).toHaveCount(1);
});

test.describe("on a touch screen", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 800 },
  });

  test("a tap picks an address suggestion", async ({ page }) => {
    await stubStripe(page, "decline");
    await stubAddresses(page);
    await page.goto("/shop");
    await page.evaluate(() =>
      fetch("/shop/cart", {
        method: "POST",
        body: new URLSearchParams({
          action: "add",
          product: "101",
          quantity: "1",
        }),
      }),
    );
    await page.goto("/shop/checkout");
    await hydrated(page, ".checkout-form");
    const street = page.locator("#addressLine1");
    await street.tap();
    await street.pressSequentially("Hermann");
    await page.getByRole("option", { name: /20095 Hamburg/ }).tap();
    await expect(page.locator("#postalCode")).toHaveValue("20095");
    await expect(page.locator("#city")).toHaveValue("Hamburg");
    await expect(street).toBeFocused();
    expect(await noSideScroll(page)).toBe(true);
  });
});

test("the address route asks Photon for German houses and streets and stays quiet when it fails", async ({
  request,
}) => {
  // Its own client address, so other workers' address searches do not count against it.
  const headers = {
    "sec-fetch-site": "same-origin",
    "x-forwarded-for": buyerAddress(),
  };
  const ask = (q: string) =>
    request.get(`/api/address?q=${encodeURIComponent(q)}`, { headers });
  // Only our own pages may ask: a cross-site or header-less request gets nothing.
  for (const site of ["cross-site", undefined]) {
    const refused = await request.get("/api/address?q=Hermannstr", {
      headers: site
        ? { ...headers, "sec-fetch-site": site }
        : { "x-forwarded-for": headers["x-forwarded-for"] },
    });
    expect(refused.status()).toBe(403);
  }
  expect(await (await ask("He")).json()).toEqual({ suggestions: [] });
  // A fresh house number per run, so the route's cache does not answer for Photon.
  const number = String(Date.now() % 100000);
  const response = await ask(`Hermannstr ${number}`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    suggestions: [
      {
        line1: "Hermannstraße 12",
        postalCode: "12049",
        city: "Berlin",
        area: "Neukölln",
      },
      {
        line1: `Hermannstraße ${number}`,
        postalCode: "20095",
        city: "Hamburg",
        area: null,
      },
    ],
  });
  const { photon } = await (await fetch(`${cmsURL}/shop-log`)).json();
  expect(photon.at(-1)).toMatchObject({
    query: {
      q: `Hermannstr ${number}`,
      countrycode: "DE",
      layer: "house,street",
      lang: "de",
      limit: "5",
    },
    userAgent: expect.stringContaining("PoetryProject"),
  });
  // Cached: the same question does not reach Photon again.
  await ask(`hermannstr ${number}`);
  expect(
    (await (await fetch(`${cmsURL}/shop-log`)).json()).photon,
  ).toHaveLength(photon.length);
  const failed = await ask("Fehlerweg 1");
  expect(failed.status()).toBe(502);
  expect(await failed.json()).toEqual({ suggestions: [] });
});

test("the wallet buttons start the same payment with the wallet's contact", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await stubStripe(page, "redirect");
  await addToCart(page, "/shop/beside-me");
  await page.goto("/shop/checkout");
  await hydrated(page, ".checkout-form");
  await expect(page.locator(".express-buttons")).toHaveText("Wallet buttons");
  const wallet = {
    billingDetails: { email: "wallet@example.org", name: "Card Holder" },
    shippingAddress: {
      name: "Amira Haddad",
      address: {
        line1: "Oranienstraße 1",
        line2: "",
        city: "Berlin",
        postal_code: "10999",
        country: "DE",
      },
    },
  };
  const confirmWallet = (contact: unknown) =>
    // Confirming may navigate away, so the call is not awaited inside the page.
    page.evaluate((value) => {
      setTimeout(() =>
        (
          window as unknown as { stripeStub: { confirm: (c: unknown) => void } }
        ).stripeStub.confirm(value),
      );
    }, contact);
  // An address without postcode is refused in the wallet sheet.
  await confirmWallet({
    ...wallet,
    shippingAddress: {
      ...wallet.shippingAddress,
      address: { ...wallet.shippingAddress.address, postal_code: "" },
    },
  });
  await expect
    .poll(async () => (await stripeStub(page)).failed)
    .toEqual([expect.objectContaining({ reason: "invalid_shipping_address" })]);
  // A single name is the last name.
  await confirmWallet({
    ...wallet,
    shippingAddress: { ...wallet.shippingAddress, name: "Amira" },
  });
  await expect(page).toHaveURL(/\/shop\/checkout\/complete$/);
  const started = await initiatedFor("wallet@example.org");
  expect(started).toMatchObject({
    body: {
      shippingAddress: {
        lastName: "Amira",
        addressLine1: "Oranienstraße 1",
        postalCode: "10999",
        city: "Berlin",
        country: "DE",
      },
    },
  });
  expect(started.body.shippingAddress.firstName).toBeUndefined();
  expect(errors).toEqual([]);
});

async function openCheckout(page: Page, path = "/shop/checkout") {
  await addToCart(page, "/shop/beside-me");
  await page.goto(path);
  await hydrated(page, ".checkout-form");
}

/**
 * Layout shifts inside the page content since load, as CLS sums them. The header is left out:
 * its controls widen once on hydration on every page, which is not the checkout's doing.
 */
const layoutShift = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        type Shift = PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources: { node?: Node | null }[];
        };
        const main = document.getElementById("main")!;
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Shift[])
            if (
              !entry.hadRecentInput &&
              entry.sources.some(({ node }) => node && main.contains(node))
            )
              total += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 300);
      }),
  );

test("the wallet row never moves the form: without a wallet, or one reported after the buyer started", async ({
  page,
}) => {
  await stubStripe(page, "decline");
  await page.addInitScript(() => {
    (window as unknown as { stubWallets: string }).stubWallets = "none";
  });
  await openCheckout(page);
  await expect(page.locator(".payment-slot")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await expect(page.locator(".express")).toBeHidden();
  expect(await layoutShift(page)).toBe(0);

  await page.addInitScript(() => {
    (window as unknown as { stubWallets: string }).stubWallets = "late";
  });
  await page.reload();
  await hydrated(page, ".checkout-form");
  await page.locator("#email").click();
  await page.waitForTimeout(1800);
  await expect(page.locator(".express")).toBeHidden();
  expect(await layoutShift(page)).toBe(0);
});

test("an incomplete Payment Element or a press while Stripe loads starts no payment", async ({
  page,
}) => {
  let started = 0;
  await page.route("**/api/checkout?**", (route) => {
    started++;
    return route.continue();
  });
  await stubStripe(page, "decline");
  // Stripe.js arrives only when released, so the first press happens while it loads.
  // (Registered after the stub, so it runs first and then hands over.)
  let release = () => {};
  const loading = new Promise<void>((resolve) => (release = resolve));
  await page.route("https://js.stripe.com/**", async (route) => {
    await loading;
    await route.fallback();
  });
  await openCheckout(page);
  await fillCheckout(page, "incomplete@example.org");
  const pay = page.getByRole("button", { name: "Zahlungspflichtig bestellen" });
  await pay.click();
  await expect(noticeText(page, "error")).toHaveText(
    "Zahlungsformular wird geladen …",
  );
  release();
  await expect(page.locator(".payment-slot")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await page.evaluate(() => {
    (
      window as unknown as { stripeStub: { incomplete: boolean } }
    ).stripeStub.incomplete = true;
  });
  await pay.click();
  await expect(pay).toBeEnabled();
  expect(started).toBe(0);
  expect((await stripeStub(page)).confirmed).toHaveLength(0);
});

test("a cart changed after the page loaded is shown again before anyone pays", async ({
  page,
}) => {
  await stubStripe(page, "decline");
  await openCheckout(page);
  await fillCheckout(page, "changed@example.org");
  await page.locator("#firstName").fill("");
  // Another tab adds a book.
  await page.evaluate(() =>
    fetch("/shop/cart", {
      method: "POST",
      body: new URLSearchParams({
        action: "add",
        product: "102",
        quantity: "1",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Zahlungspflichtig bestellen" })
    .click();
  await expect(noticeText(page, "error")).toHaveText(
    "Dein Warenkorb hat sich geändert. Bitte prüfe die Bestellung und bestelle dann erneut.",
  );
  await expect(notice(page, "error")).toBeFocused();
  await expect(page.locator(".summary-lines li")).toHaveCount(2);
  await expect(page.locator("#city")).toHaveValue("Berlin");
  await expect(page.locator("#email")).toHaveValue("changed@example.org");
  // The page was sent again, so nothing reached Stripe or the CMS.
  expect(await initiatedFor("changed@example.org")).toBeUndefined();
});

test("form and wallet never start two payments at once", async ({ page }) => {
  await stubStripe(page, "decline");
  await openCheckout(page);
  await fillCheckout(page, "together@example.org");
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/checkout?**", async (route) => {
    await held;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Zahlungspflichtig bestellen" })
    .click();
  await expect(page.locator(".checkout-form")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  const click = await page.evaluate(() =>
    (
      window as unknown as { stripeStub: { click: () => Promise<string> } }
    ).stripeStub.click(),
  );
  expect(click).toBe("rejected");
  await page.evaluate(() =>
    (
      window as unknown as { stripeStub: { confirm: (c: unknown) => void } }
    ).stripeStub.confirm({
      billingDetails: { email: "wallet-too@example.org" },
      shippingAddress: {
        name: "Amira Haddad",
        address: {
          line1: "Oranienstraße 1",
          city: "Berlin",
          postal_code: "10999",
          country: "DE",
        },
      },
    }),
  );
  await expect
    .poll(async () => (await stripeStub(page)).failed)
    .toHaveLength(1);
  release();
  await expect(noticeText(page, "error")).toHaveText("Your card was declined.");
  expect(await initiatedFor("wallet-too@example.org")).toBeUndefined();
  // Idle again, a wallet press opens the sheet.
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { stripeStub: { click: () => Promise<string> } }
      ).stripeStub.click(),
    ),
  ).toBe("resolved");
});

test("refusals from the CMS: a payment in progress, or a cart that already has an order", async ({
  page,
  context,
}) => {
  await stubStripe(page, "decline");
  await openCheckout(page);
  await fillCheckout(page, "busy@example.org");
  const pay = page.getByRole("button", { name: "Zahlungspflichtig bestellen" });
  await pay.click();
  await expect(noticeText(page, "error")).toHaveText(
    "Zahlung läuft bereits. Bitte bezahle nicht noch einmal.",
  );
  expect((await stripeStub(page)).confirmed).toHaveLength(0);

  await page.locator("#email").fill("ordered@example.org");
  await pay.click();
  await expect(page).toHaveURL(/\/shop\/cart\?status=completed$/);
  await expect(noticeText(page, "success")).toHaveText(
    "Dieser Warenkorb ist abgeschlossen. Falls du schon bezahlt hast, ist deine Bestellung eingegangen.",
  );
  expect(
    (await context.cookies()).some(({ name }) => name.startsWith("poetry-c")),
  ).toBe(false);
});

test("opening the company fields moves focus into them", async ({ page }) => {
  await stubStripe(page, "decline");
  await openCheckout(page);
  await page.getByText("Firma oder Adresszusatz hinzufügen").click();
  await expect(page.locator("#company")).toBeFocused();
});
