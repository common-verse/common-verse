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
  // Not fill(): it selects before focusing, and the code field puts a focused caret after the code.
  await page.locator("#code").focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(code);
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
  await expect(page.locator("#code")).toHaveValue("PA1D0002");
  await expect(page.locator("#email")).toHaveValue("someone@example.org");

  // Keyboard only: Shift+Tab from the message back to the email, then to the code;
  // the eighth character sends the form, since the email is valid.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#code")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  const sent = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await page.keyboard.type("zzzz-zzzz");
  await sent;
  await expect(page.locator("#code")).toHaveValue("ZZZZZZZZ");
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

test.describe("the code field", () => {
  const code = (page: Page) => page.locator("#code");
  const cells = (page: Page) => page.locator(".code-cell");
  const hydrated = (page: Page) =>
    expect(page.locator("astro-island:has(#code)")).not.toHaveAttribute("ssr");
  const open = async (page: Page, path = "/bestellstatus") => {
    await page.goto(path);
    await hydrated(page);
  };
  const paste = (page: Page, text: string) =>
    code(page).evaluate((input, text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      input.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
  const selection = (page: Page) =>
    code(page).evaluate((input: HTMLInputElement) => [
      input.selectionStart,
      input.selectionEnd,
    ]);
  /** Every element in the code field that draws an outline. */
  const rings = (page: Page) =>
    page.locator(".code-box").evaluate((box) =>
      [box, ...Array.from(box.querySelectorAll("*"))]
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
        })
        .map((element) =>
          element.matches(".code-cell")
            ? `cell ${Array.from(box.querySelectorAll(".code-cell")).indexOf(element)}`
            : element.className.split(" ")[0] || element.tagName,
        ),
    );

  test("typing reads O, I and L as 0 and 1, skips other characters and moves on to the email", async ({
    page,
  }) => {
    await open(page);
    await code(page).click();
    await page.keyboard.type("k7-qu d");
    await expect(code(page)).toHaveValue("K7QD");
    await page.keyboard.type("o1l");
    await expect(code(page)).toHaveValue("K7QD011");
    await expect(cells(page)).toHaveText([
      "K",
      "7",
      "Q",
      "D",
      "0",
      "1",
      "1",
      "",
    ]);
    await expect(page.locator("#email")).not.toBeFocused();
    await page.keyboard.type("I");
    await expect(code(page)).toHaveValue("K7QD0111");
    await expect(page.locator("#email")).toBeFocused();
    // One text field for assistive technology; the cells are drawn for the eye.
    await expect(
      page.getByRole("textbox", { name: "Bestellcode" }),
    ).toHaveCount(1);
    await expect(page.locator(".code-cells")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("a pasted link, sentence or spaced code fills all cells; a part goes in at the caret", async ({
    page,
  }) => {
    await open(page);
    for (const text of [
      "https://thepoetryproject.de/bestellstatus?code=sh1p0003",
      "Bestellcode: SH1P-0003",
      "sh1p 0003",
    ]) {
      await code(page).focus();
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.press("Backspace");
      await paste(page, text);
      await expect(code(page)).toHaveValue("SH1P0003");
    }
    await code(page).focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("sh");
    await paste(page, "1p-o");
    await expect(code(page)).toHaveValue("SH1P0");
    await expect(page.locator(".code-cell[data-caret]")).toHaveCount(1);
    await expect.poll(() => selection(page)).toEqual([5, 5]);
  });

  test("arrows move one cell, typing replaces the marked character, Backspace deletes it", async ({
    page,
  }) => {
    await open(page);
    await code(page).focus();
    await page.keyboard.type("K7QD");
    await expect.poll(() => selection(page)).toEqual([4, 4]);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => selection(page)).toEqual([2, 3]);
    await expect(page.locator(".code-cell[data-active]")).toHaveText("Q");
    await page.keyboard.type("x");
    await expect(code(page)).toHaveValue("K7XD");
    await expect.poll(() => selection(page)).toEqual([3, 4]);
    // A character a code cannot hold keeps the marked one.
    await page.keyboard.type("u");
    await expect(code(page)).toHaveValue("K7XD");
    await page.keyboard.press("Backspace");
    await expect(code(page)).toHaveValue("K7X");
    await page.keyboard.press("Home");
    await expect.poll(() => selection(page)).toEqual([0, 1]);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => selection(page)).toEqual([1, 2]);
    await page.keyboard.press("End");
    await expect.poll(() => selection(page)).toEqual([3, 3]);
    await page.keyboard.press("Backspace");
    await expect(code(page)).toHaveValue("K7");
    // A click on a cell puts the caret there, at most after the last character.
    // The invisible field lies over the cells and takes the click.
    await cells(page).nth(0).click({ force: true });
    await expect.poll(() => selection(page)).toEqual([0, 1]);
    await cells(page).nth(6).click({ force: true });
    await expect.poll(() => selection(page)).toEqual([2, 2]);
  });

  test("one tab stop and one focus ring: the active cell, or the whole code while it is selected", async ({
    page,
  }) => {
    await open(page);
    await page.locator("label[for=code]").click();
    await expect(code(page)).toBeFocused();
    await expect.poll(() => rings(page)).toEqual(["cell 0"]);
    await page.keyboard.type("K7");
    await expect.poll(() => rings(page)).toEqual(["cell 2"]);
    await page.keyboard.press("ControlOrMeta+a");
    await expect.poll(() => rings(page)).toEqual(["code-input"]);
    await page.keyboard.press("Tab");
    await expect(page.locator("#email")).toBeFocused();
    await expect.poll(() => rings(page)).toEqual([]);
    // Tab selects the whole code, as in any text field: typing replaces it.
    await page.keyboard.press("Shift+Tab");
    await expect(code(page)).toBeFocused();
    await expect.poll(() => selection(page)).toEqual([0, 2]);
    await expect.poll(() => rings(page)).toEqual(["code-input"]);
  });

  test("the eighth character sends the form when the email is already valid", async ({
    page,
  }) => {
    await open(page);
    await page.locator("#email").fill(email);
    await code(page).click();
    await page.keyboard.type("pa1d000");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bestellstatus",
    );
    await page.keyboard.type("2");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bezahlt, wird gepackt",
    );
  });

  test("otherwise the email is next, and leaving it or Enter sends the form once", async ({
    page,
  }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await open(page);
    await code(page).click();
    await page.keyboard.type("SH1P0003");
    await expect(page.locator("#email")).toBeFocused();
    await page.keyboard.type(email);
    // Back to the code to check it does not send the form.
    await page.keyboard.press("Shift+Tab");
    await expect(code(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#email")).toBeFocused();
    expect(posts).toEqual([]);
    // Leaving by pressing the button sends once, not once for the blur and once for the press,
    // even when the press takes as long as a person's and the answer longer.
    await page.route("**/bestellstatus", async (route) => {
      if (route.request().method() === "POST")
        await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await page.getByRole("button", { name: "Status anzeigen" }).hover();
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Versendet",
    );
    expect(posts).toHaveLength(1);

    await open(page);
    await code(page).click();
    await page.keyboard.type("SH1P0003");
    await page.keyboard.type(email);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Versendet",
    );
  });

  test("a code from the link focuses the email; leaving it sends the form", async ({
    page,
  }) => {
    await open(page, "/bestellstatus?code=sh1p0003");
    await expect(page.locator("#email")).toBeFocused();
    await expect(code(page)).toHaveValue("SH1P0003");
    await page.keyboard.type(email);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Versendet",
    );
  });

  test("after „not found“ leaving the email does not send the same pair again", async ({
    page,
  }) => {
    await open(page);
    await lookUp(page, "PA1D-0002", "someone@example.org");
    await expect(page.locator("#status-problem")).toBeFocused();
    await hydrated(page);
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await page.locator("#email").focus();
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    expect(posts).toEqual([]);
  });

  test("hydration moves nothing: the plain field without JavaScript has the cells' size", async ({
    browser,
  }) => {
    for (const width of [320, 1280]) {
      const boxes = [];
      for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({
          javaScriptEnabled,
          viewport: { width, height: 900 },
        });
        const page = await context.newPage();
        await page.goto("/bestellstatus?code=SH1P0003");
        if (javaScriptEnabled) await hydrated(page);
        else {
          await expect(code(page)).toHaveValue("SH1P-0003");
          await expect(page.locator(".code-cells")).toBeHidden();
        }
        boxes.push([
          await code(page).boundingBox(),
          await page
            .getByRole("button", { name: "Status anzeigen" })
            .boundingBox(),
        ]);
        await context.close();
      }
      expect(boxes[1]).toEqual(boxes[0]);
    }
  });

  test("cells keep 48 × 56 px when there is room and shrink only as far as 320 px needs", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page);
    const sizes = await cells(page).evaluateAll((all) =>
      all.map((cell) => {
        const { width, height } = cell.getBoundingClientRect();
        return [Math.round(width), height];
      }),
    );
    expect(sizes).toEqual(Array(8).fill([49, 56]));
    const field = (await page.locator("#email").boundingBox())!;
    const input = (await code(page).boundingBox())!;
    expect(input.width).toBeLessThan(field.width);
    expect(input.x).toBe(field.x);

    await page.setViewportSize({ width: 320, height: 700 });
    expect(await noSideScroll(page)).toBe(true);
    const narrow = (await cells(page).first().boundingBox())!;
    expect(narrow.width).toBeGreaterThanOrEqual(30);
    expect(narrow.height).toBe(48);
    const narrowField = (await page.locator("#email").boundingBox())!;
    const narrowInput = (await code(page).boundingBox())!;
    expect(narrowInput.x + narrowInput.width).toBeLessThanOrEqual(
      narrowField.x + narrowField.width + 0.5,
    );
  });

  test("Arabic keeps the code left-to-right, the field at the start of the line", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, "/ar/order-status");
    await code(page).click();
    await page.keyboard.type("K7");
    const [k, seven] = await Promise.all([
      cells(page).nth(0).boundingBox(),
      cells(page).nth(1).boundingBox(),
    ]);
    expect(k!.x).toBeLessThan(seven!.x);
    const field = (await page.locator("#email").boundingBox())!;
    const input = (await code(page).boundingBox())!;
    expect(input.x + input.width).toBeCloseTo(field.x + field.width, 0);
    await expectAccessible(page);
  });
});
