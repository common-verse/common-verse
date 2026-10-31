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

async function addToCart(page: Page, path: string, quantity = "1") {
  await page.goto(path);
  await page.locator("#quantity").selectOption(quantity);
  await page.locator(".add-form button").click();
}

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

test("cart adds, updates and removes books by keyboard with httpOnly cookies", async ({
  page,
  context,
}) => {
  await page.goto("/shop/beside-me");
  await page.locator("#quantity").selectOption("2");
  await page.locator("#quantity").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".add-form button")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/shop\/cart\?status=added$/);
  await expect(page.getByRole("status")).toHaveText(
    "Das Buch liegt jetzt in deinem Warenkorb.",
  );
  await expect(page.locator(".shop-totals")).toContainText("40,00 €");
  await expect(page.locator(".shop-totals")).toContainText("4,00 €");
  await expect(page.locator(".shop-totals")).toContainText("44,00 €");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );

  const cookie = (await context.cookies()).find(
    ({ name }) => name === "poetry-cart",
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "poetry-cart",
  );

  await addToCart(page, "/shop/beside-me");
  await expect(page.locator(".cart-line")).toHaveCount(1);
  await expect(page.locator(".cart-line select")).toHaveValue("3");

  await page.locator(".cart-line select").selectOption("5");
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Dein Warenkorb wurde aktualisiert.",
  );
  await expect(page.locator(".cart-line-total")).toHaveText("100,00 €");

  await addToCart(page, "/shop/passing-words");
  await expect(page.locator(".cart-line")).toHaveCount(2);
  await page
    .locator(".cart-line", { hasText: "Sei neben mir" })
    .getByRole("button", { name: "Entfernen" })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Das Buch wurde aus deinem Warenkorb entfernt.",
  );
  await expect(page.locator(".cart-line")).toHaveCount(1);
  await expectAccessible(page);
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
    expect(await post(product)).toBe("?status=added");
  expect(await post("207")).toBe("?status=limit");
  expect(await post("101", "10")).toBe("?status=invalid");
  await page.goto("/shop/cart?status=limit");
  await expect(page.getByRole("status")).toHaveText(
    "Pro Bestellung passen bis zu 7 verschiedene Bücher in den Warenkorb.",
  );
  await expect(page.locator(".cart-line")).toHaveCount(7);
});

test("checkout validates on the server and starts payment without forwarding cookies", async ({
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

  await page
    .locator(".checkout-form")
    .evaluate((form: HTMLFormElement) => (form.noValidate = true));
  await page.locator("#email").fill("reader@");
  await page.locator("#postalCode").fill("1099");
  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Bitte prüfe die markierten Felder.",
  );
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#email-error")).toHaveText(
    "Bitte gib eine gültige E-Mail-Adresse ein.",
  );
  await expect(page.locator("#postalCode-error")).toHaveText(
    "Bitte gib eine fünfstellige Postleitzahl ein.",
  );
  await expect(page.locator("#lastName-error")).toHaveText(
    "Bitte fülle dieses Feld aus.",
  );
  await expect(page.locator("#company")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#postalCode")).toHaveValue("1099");
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
  await expect(page.getByRole("alert")).toHaveText("Your card was declined.");
  await expect(page.getByRole("alert")).toBeFocused();
  expect(errors).toEqual([]);
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
  await expect(page.getByRole("alert")).toContainText(
    "no longer available in this quantity",
  );
  await expect(page.locator("#city")).toHaveValue("Berlin");
  await expect(
    page.getByRole("alert").getByRole("link", { name: "Edit cart" }),
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
  await expect(page.locator(".cart-hint")).toHaveText(
    "Dieses Buch ist in dieser Menge nicht verfügbar. Bitte verringere die Menge oder entferne es.",
  );
  await expect(page.locator(".cart-line option")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Zur Kasse" })).toHaveCount(0);
  await expect(
    page.getByText("Bitte passe die markierten Bücher an"),
  ).toBeVisible();
  await page.goto("/shop/checkout");
  await expect(page).toHaveURL(/\/shop\/cart$/);

  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(page.getByRole("link", { name: "Zur Kasse" })).toBeVisible();
});

test("unsaved shop settings keep the shop visible but disable checkout", async ({
  page,
}) => {
  await addToCart(page, "/uk/shop/beside-me");
  await expect(page.locator(".shop-totals div")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Оформити замовлення" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Онлайн-оплата зараз недоступна.", { exact: false }),
  ).toBeVisible();
  await page.goto("/uk/shop/checkout");
  await expect(page.getByRole("alert")).toContainText(
    "Онлайн-оплата зараз недоступна.",
  );
  await expect(page.locator("form.checkout-form")).toHaveCount(0);
});
