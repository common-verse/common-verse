import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const cmsURL = `http://127.0.0.1:${process.env.PLAYWRIGHT_CMS_PORT ?? "3001"}`;

// A stand-in for Stripe.js: the Payment Element iframe is Stripe's to test.
function stubStripe(page: Page, outcome: "redirect" | "decline") {
  return page.route("https://js.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.Stripe = Object.assign(function () {
        let secret = ''
        return {
          elements(options) {
            secret = options.clientSecret
            return { create: () => ({ on(event, callback) { if (event === 'ready') setTimeout(callback) }, mount(element) { element.textContent = 'Payment element' } }) }
          },
          async confirmPayment({ confirmParams }) {
            if (${JSON.stringify(outcome)} === 'decline') return { error: { type: 'card_error', message: 'Your card was declined.' } }
            location.href = confirmParams.return_url + '?payment_intent=' + secret.split('_secret')[0] + '&redirect_status=succeeded'
            return new Promise(() => {})
          },
        }
      }, { version: 'endive' })`,
    }),
  );
}

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
  await expect(page.locator(".order-lines")).toContainText("× 2");
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
  await email.fill("reader@example.org");

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

  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();
  await expect(page.locator("#firstName")).toBeFocused();
  await expect(page.locator("#firstName")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#lastName-error")).toHaveText(
    "Bitte fülle dieses Feld aus.",
  );
  await expect(page.locator("#company")).not.toHaveAttribute("aria-invalid");
  await expect(notice(page, "error")).toHaveCount(0);
  expect(await initiatedFor("reader@example.org")).toBeUndefined();
  // Contrast is checked once the 160 ms fade has ended.
  await expect(page.locator("#city-error")).toHaveCSS("opacity", "1");
  await expectAccessible(page);

  await fillCheckout(page);
  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();
  await expect(page.getByRole("heading", { name: "Zahlung" })).toBeVisible();
  await expect(page).toHaveURL(/\/shop\/checkout$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Zahlung" })).toBeVisible();
  const { initiate } = await (await fetch(`${cmsURL}/shop-log`)).json();
  expect(
    initiate.filter(
      (entry: { body: { customerEmail: string } }) =>
        entry.body.customerEmail === "reader@example.org",
    ),
  ).toHaveLength(1);
  // Totals come from current prices, not the stale stored subtotal.
  await expect(page.locator(".shop-totals")).toContainText("24,00 €");
  await expect(page.locator(".ship-to")).toContainText("10999 Berlin");
  const pay = page.getByRole("button", { name: "Zahlungspflichtig bestellen" });
  await expect(pay).toBeEnabled();
  const started = await initiatedFor("reader@example.org");
  expect(started).toMatchObject({
    cookie: null,
    body: {
      customerEmail: "reader@example.org",
      shippingAddress: {
        country: "DE",
        postalCode: "10999",
        firstName: "Amira",
      },
    },
  });
  expect(started.body.secret).toMatch(/^secret/);
  expect(await page.content()).not.toContain(started.body.secret);
  await expectAccessible(page);

  await pay.click();
  await expect(noticeText(page, "error")).toHaveText("Your card was declined.");
  await expect(notice(page, "error").locator("..")).toHaveAttribute(
    "aria-live",
    "assertive",
  );
  await expect(pay).toBeFocused();
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

test("one press of the checkout button sends the form once", async ({
  page,
}) => {
  await addToCart(page, "/shop/beside-me");
  await page.goto("/shop/checkout");
  await hydrated(page, ".checkout-form");
  await fillCheckout(page, "twice@example.org");
  // Count submissions the form lets through, without leaving the page.
  await page.evaluate(() => {
    const counted = window as unknown as { sent: number };
    counted.sent = 0;
    addEventListener("submit", (event) => {
      if (!event.defaultPrevented) counted.sent++;
      event.preventDefault();
    });
  });
  const submit = page.getByRole("button", { name: "Weiter zur Zahlung" });
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(page.locator(".checkout-form")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await submit.click({ force: true });
  await page.locator("#city").press("Enter");
  expect(
    await page.evaluate(() => (window as unknown as { sent: number }).sent),
  ).toBe(1);
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
    "#company",
    "#addressLine1",
    "#addressLine2",
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
  await fillCheckout(page, "arabic@example.org");
  await page.getByRole("button", { name: "المتابعة إلى الدفع" }).click();
  await page.getByRole("button", { name: "اطلب مع الالتزام بالدفع" }).click();
  await expect(page).toHaveURL(/\/ar\/shop\/checkout\/complete$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "شكراً لطلبك",
  );
  await expect(page.getByText("1001")).toBeVisible();
  expect((await context.cookies()).map(({ name }) => name)).toEqual([
    "poetry-order",
  ]);
  await page.reload();
  await expect(page.getByText("1001")).toBeVisible();
  const { paymentIntentID } = await initiatedFor("arabic@example.org");
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

test("unconfirmed and failed payments show calm messages", async ({
  page,
  context,
}) => {
  await addToCart(page, "/en/shop/beside-me");
  await page.goto("/en/shop/checkout");
  await fillCheckout(page, "pending@example.org");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
  const paymentIntent = (await initiatedFor("pending@example.org"))
    .paymentIntentID;

  await page.goto(
    `/en/shop/checkout/complete?payment_intent=${paymentIntent}&redirect_status=failed`,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Payment not completed",
  );
  expect(
    (await context.cookies()).some(({ name }) => name === "poetry-cart"),
  ).toBe(true);

  await page.goto(
    "/en/shop/checkout/complete?payment_intent=pi_foreign&redirect_status=succeeded",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your payment is being checked",
  );
  expect(
    (await context.cookies()).some(({ name }) => name === "poetry-cart"),
  ).toBe(true);

  await page.goto(
    `/en/shop/checkout/complete?payment_intent=${paymentIntent}&redirect_status=succeeded`,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your payment is being checked",
  );
  await expect(page.getByRole("status")).toContainText(
    "Please do not pay again.",
  );
  expect(
    (await context.cookies()).some(({ name }) => name.startsWith("poetry-c")),
  ).toBe(false);

  await page.goto("/en/shop/checkout");
  await expect(page).toHaveURL(/\/en\/shop\/cart$/);
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
});

test("out-of-stock responses from the CMS keep the address and point back to the cart", async ({
  page,
}) => {
  await addToCart(page, "/en/shop/german-only");
  await page.goto("/en/shop/checkout");
  await fillCheckout(page, "stock@example.org");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(notice(page, "error")).toContainText(
    "no longer available in this quantity",
  );
  await expect(notice(page, "error")).toBeFocused();
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
