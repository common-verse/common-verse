import { expect, test } from "@playwright/test";

for (const locale of ["de", "ar"] as const) {
  const base = locale === "de" ? "/veranstaltungen" : "/ar/events";
  test(`${locale} events open with keyboard on narrow screens`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(base);
    await expect(
      page.locator(".hero-track article, .events-section article"),
    ).toHaveCount(7);
    const link = page.locator(`a.event-row-link[href="${base}/test"]`);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${base}/test`);
    await expect(page.locator("aside time")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("events work without JavaScript and missing translations stay omitted", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto("/fa/events");
  await expect(
    page.locator(".hero-track article, .events-section article"),
  ).toHaveCount(1);
  await expect(page.locator('a[href="/fa/events/reading"]')).toHaveCount(0);
  await page.locator(".hero-track a").click();
  await expect(page.locator("aside time")).toHaveCount(1);
  await context.close();
});

test("event details render the current fields and rich text", async ({
  page,
}) => {
  await page.goto("/en/events/reading");
  await expect(page.locator(".prose strong")).toBeVisible();
  const inlineImage = page.locator(".event-content-image img");
  await inlineImage.scrollIntoViewIfNeeded();
  await expect(inlineImage).toHaveAttribute(
    "alt",
    "Layered colourful paper shapes",
  );
  await expect(inlineImage).toHaveAttribute(
    "src",
    /\/api\/media\/file\/inline.svg$/,
  );
  await expect
    .poll(() =>
      inlineImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".event-content-image figcaption")).toHaveText(
    "The Poetry Project",
  );
  await expect(page.locator("aside")).toContainText(
    "The Poetry Project, Berlin",
  );
  await expect(page.locator("aside time")).toHaveCount(1);
  await expect(page.locator(".image-credit")).toHaveText("Event photographer");
  await expect(
    page
      .locator("aside")
      .getByRole("link", { name: "Register now", exact: true }),
  ).toHaveAttribute("href", "https://example.org/register");
  await expect(page.locator(".back-link")).toHaveAttribute(
    "href",
    "/en/events",
  );
  const event = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts
        .map((script) => JSON.parse(script.textContent!))
        .find((value) => value["@type"] === "Event"),
    );
  expect(event).not.toHaveProperty("offers");
  expect(event).not.toHaveProperty("endDate");
  await page.goto("/en/events/test");
  await expect(page.locator("aside")).not.toContainText("€");
  await expect(page.locator(".prose p")).toBeVisible();
});

test("unsafe registration links are omitted", async ({ page }) => {
  await page.goto("/en/events/unsafe-registration");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Register now", exact: true }),
  ).toHaveCount(0);
});

for (const locale of ["de", "ar"]) {
  test(`${locale} event layout reflows with readable details`, async ({
    page,
  }, testInfo) => {
    await page.goto(
      locale === "de" ? "/veranstaltungen/reading" : "/ar/events/reading",
    );
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator("aside")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`event-${width}.png`),
        fullPage: true,
      });
    }
    await page.locator(".back-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".hero-track img")).toHaveCount(5);
    await expect(
      page.locator(".events-section img, #past-events img"),
    ).toHaveCount(0);
  });
}

test("bare registration domains produce the registration call to action", async ({
  page,
}) => {
  await page.goto("/en/events/bare-registration");
  const ctas = page.getByRole("link", { name: "Register now", exact: true });
  await expect(ctas).toHaveCount(1);
  for (const cta of await ctas.all())
    await expect(cta).toHaveAttribute("href", "https://google.de/");
  await page
    .locator("aside")
    .getByRole("link", { name: "Register now", exact: true })
    .focus();
  await expect(page.locator("aside a")).toBeFocused();
});

for (const locale of ["de", "ar"]) {
  test(`${locale} event details stay visible while scrolling on desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      locale === "de" ? "/veranstaltungen/reading" : "/ar/events/reading",
    );
    const facts = page.locator(".event-facts");
    const initial = (await facts.boundingBox())!.y;
    await page.evaluate(() =>
      window.scrollBy({ top: 650, behavior: "instant" }),
    );
    await expect
      .poll(async () => (await facts.boundingBox())!.y)
      .toBeLessThan(initial);
    const rect = (await facts.boundingBox())!;
    const header = (await page.locator(".site-header").boundingBox())!;
    expect(rect.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(rect.y).toBeCloseTo(128, 0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(900);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(facts).toHaveCSS("position", "static");
  });
}

for (const locale of ["en", "ar"]) {
  test(`${locale} programme features an event and exposes an accessible archive`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${locale}/events`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `Events programme ${locale}`,
    );
    await expect(page.locator(".hero-introduction")).toContainText(
      `Editorial introduction ${locale}`,
    );
    await expect(page.locator(".hero-slide h2").first()).toHaveText(
      `Reading ${locale}`,
    );
    await expect(page.locator(".hero-status")).not.toBeEmpty();
    await expect(page.locator(".events-section article")).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath("events-desktop.png"),
      fullPage: true,
    });
    const summary = page.locator("#past-events summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#past-events")).toHaveAttribute("open", "");
    await expect(page.locator("#past-events h3")).toHaveText(
      `Past event ${locale}`,
    );
    await expect(page.locator("#past-events .event-status")).toHaveCount(0);
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const scan = await new AxeBuilder({ page }).include("#main").analyze();
    expect(scan.violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath("events-mobile.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.addStyleTag({ content: "html { font-size: 200% }" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".hero-slide h2").first()).toBeVisible();
  });
}

test("events page copy is previewable only with the runtime secret", async ({
  page,
}) => {
  const invalid = await page.goto("/en/events?previewSecret=wrong");
  expect(invalid?.status()).toBe(401);
  await page.goto("/en/events?previewSecret=test-preview&editorLanguage=uk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Events programme en — draft",
  );
  await expect(page.locator(`[data-slot="banner"]:not([data-update-banner])`)).toHaveAttribute("lang", "uk");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
  await page.goto("/en/events");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Events programme en",
  );
});

for (const theme of ["light", "dark"]) {
  test(`${theme} event programme stays readable without JavaScript`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
    });
    await context.addCookies([
      { name: "poetry-theme", value: theme, url: baseURL! },
    ]);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/events");
    const contrast = await page
      .locator(".hero-copy")
      .first()
      .evaluate((caption) => {
        const probe = document.createElement("span");
        probe.style.backgroundColor = "var(--background)";
        document.body.append(probe);
        const scrim = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { colorSpace: "srgb" })!;
        const luminance = (color: string) => {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const channels = Array.from(ctx.getImageData(0, 0, 1, 1).data)
            .slice(0, 3)
            .map((channel) => {
              const value = channel / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const text = luminance(getComputedStyle(caption).color);
        const background = luminance(scrim);
        return (
          (Math.max(text, background) + 0.05) /
          (Math.min(text, background) + 0.05)
        );
      });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    const cards = page.locator(".events-section article");
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    await expect(page.locator(".events-section img")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`events-${theme}.png`),
      fullPage: true,
    });
    await context.close();
  });
}

for (const locale of ["en", "ar"]) {
  test(`${locale} hero supports five manual features with keyboard controls`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}/events`);
    const track = page.locator(".hero-track");
    await expect(track.locator("article")).toHaveCount(5);
    const controls = page.locator(".hero-controls");
    const previous = controls.getByRole("button").first();
    const next = controls.getByRole("button").last();
    await expect(previous).toBeDisabled();
    // Previous sits at the reading start and its arrow points back in Arabic too.
    const rtl = locale === "ar";
    const [previousBox, nextBox] = [
      (await previous.boundingBox())!,
      (await next.boundingBox())!,
    ];
    expect(rtl ? previousBox.x > nextBox.x : previousBox.x < nextBox.x).toBe(
      true,
    );
    const flipped = rtl ? "matrix(-1, 0, 0, 1, 0, 0)" : "none";
    await expect(previous.locator("svg")).toHaveCSS("transform", flipped);
    await expect(next.locator("svg")).toHaveCSS("transform", flipped);
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".hero-position")).toContainText("2");
    await expect(previous).toBeEnabled();
    await expect(track.locator("article").nth(1)).toBeInViewport();
    await previous.focus();
    await page.keyboard.press("Enter");
    await expect(previous).toBeDisabled();
    for (let i = 0; i < 4; i++) await next.click();
    await expect(next).toBeDisabled();
    await expect(page.locator(".hero-position")).toContainText("5");
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(page.locator(".events-section img")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const locale of ["de", "en", "ar", "fa", "uk", "ku"]) {
  test(`${locale} event weekday and time follow locale formatting`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(locale === "de" ? "/veranstaltungen" : `/${locale}/events`);
    const rtl = ["ar", "fa"].includes(locale);
    const introduction = (await page
      .locator(".hero-introduction")
      .boundingBox())!;
    const feature = (await page.locator(".hero-track").boundingBox())!;
    // The introduction comes first in reading order, the featured event after it.
    if (rtl)
      expect(introduction.x).toBeGreaterThanOrEqual(feature.x + feature.width);
    else
      expect(feature.x).toBeGreaterThanOrEqual(
        introduction.x + introduction.width,
      );
    await expect(page.locator(".hero-introduction")).toHaveCSS(
      "direction",
      rtl ? "rtl" : "ltr",
    );
    const counter = page.locator(".hero-position bdi");
    if (await counter.count()) {
      // Counts keep Latin digits in every locale.
      await expect(counter).toHaveText("1/5");
      await expect(counter).toHaveCSS("direction", "ltr");
      const counterParts = counter.locator("span");
      expect((await counterParts.first().boundingBox())!.x).toBeLessThan(
        (await counterParts.last().boundingBox())!.x,
      );
    }
    await page.setViewportSize({ width: 320, height: 844 });
    const mobileIntroduction = await page
      .locator(".hero-introduction")
      .boundingBox();
    const mobileFeature = await page.locator(".hero-track").boundingBox();
    expect(mobileFeature!.y).toBeGreaterThanOrEqual(
      mobileIntroduction!.y + mobileIntroduction!.height,
    );
    const facts = page.locator(".hero-copy .event-date").first();
    const date = await facts.getAttribute("datetime");
    const expected = await page.evaluate(
      ({ locale, date }) => {
        // Latin digits in every locale.
        const time = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Berlin",
        }).format(new Date(date!));
        return locale === "de" ? `${time} Uhr` : time;
      },
      { locale, date },
    );
    await expect(facts.locator(".date-time")).toHaveText(expected);
    expect(
      await facts
        .locator(".date-time")
        .evaluate(
          (el) =>
            el.getBoundingClientRect().height <=
            parseFloat(getComputedStyle(el).lineHeight) + 1,
        ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const locale of ["en", "ar"]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`${locale} event navigation transitions respect ${reducedMotion} motion`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({
        width: reducedMotion === "reduce" ? 320 : 1280,
        height: 900,
      });
      await page.addInitScript(() => {
        addEventListener("pagereveal", (event) => {
          const transition = (
            event as Event & { viewTransition?: { ready: Promise<void> } }
          ).viewTransition;
          const state = {
            path: location.pathname,
            animated: Boolean(transition),
            ready: false,
          };
          const save = () =>
            sessionStorage.setItem("event-transition", JSON.stringify(state));
          save();
          transition?.ready
            .then(() => {
              state.ready = true;
              sessionStorage.setItem(
                "event-transition-motion",
                JSON.stringify(
                  document
                    .getAnimations()
                    .filter(
                      (animation) =>
                        "animationName" in animation &&
                        animation.animationName === "event-content-in",
                    )
                    .map((animation) => animation.effect?.getTiming()),
                ),
              );
              const heading = document.querySelector(".event-heading h1");
              if (heading) {
                sessionStorage.setItem(
                  "event-transition-content",
                  JSON.stringify(
                    ["event-back-link", "event-detail-content"].map((name) => {
                      const style = getComputedStyle(
                        document.documentElement,
                        `::view-transition-new(${name})`,
                      );
                      return {
                        name,
                        animation: style.animationName,
                        delay: style.animationDelay,
                        duration: style.animationDuration,
                        opacity: style.opacity,
                        transform: style.transform,
                      };
                    }),
                  ),
                );
                const name = getComputedStyle(heading).viewTransitionName;
                sessionStorage.setItem(
                  "event-transition-text",
                  JSON.stringify({
                    oldOpacity: getComputedStyle(
                      document.documentElement,
                      `::view-transition-old(${name})`,
                    ).opacity,
                    newAnimation: getComputedStyle(
                      document.documentElement,
                      `::view-transition-new(${name})`,
                    ).animationName,
                    duration: getComputedStyle(
                      document.documentElement,
                      `::view-transition-group(${name})`,
                    ).animationDuration,
                  }),
                );
              }
              save();
            })
            .catch(() => {});
        });
      });
      const base = `/${locale}/events`;
      await page.goto(base);
      const link = page.locator(`.event-row-link[href="${base}/test"]`);
      const name = await link
        .locator("h3")
        .evaluate((el) => getComputedStyle(el).viewTransitionName);
      const summaryLayout = await link
        .locator(".event-summary")
        .evaluate((el) => ({
          titleWidth: el.querySelector("h3")!.getBoundingClientRect().width,
          titleHeight: el.querySelector("h3")!.getBoundingClientRect().height,
          titleFont: getComputedStyle(el.querySelector("h3")!).fontSize,
          descriptionWidth: el.querySelector("p")!.getBoundingClientRect()
            .width,
          descriptionHeight: el.querySelector("p")!.getBoundingClientRect()
            .height,
          descriptionFont: getComputedStyle(el.querySelector("p")!).fontSize,
        }));
      const descriptionName = await link
        .locator(".event-row-copy p")
        .evaluate((el) => getComputedStyle(el).viewTransitionName);
      await link.click();
      await expect(page).toHaveURL(`${base}/test`);
      await expect(page.locator(".event-heading h1")).toHaveCSS(
        "font-weight",
        "500",
      );
      const detailLayout = await page
        .locator(".event-heading")
        .evaluate((el) => ({
          titleWidth: el.querySelector("h1")!.getBoundingClientRect().width,
          titleHeight: el.querySelector("h1")!.getBoundingClientRect().height,
          titleFont: getComputedStyle(el.querySelector("h1")!).fontSize,
          descriptionWidth: el.querySelector("p")!.getBoundingClientRect()
            .width,
          descriptionHeight: el.querySelector("p")!.getBoundingClientRect()
            .height,
          descriptionFont: getComputedStyle(el.querySelector("p")!).fontSize,
        }));
      for (const [part, scale] of [
        ["title", 0.56],
        ["description", 0.75],
      ] as const) {
        expect(parseFloat(summaryLayout[`${part}Font`])).toBeLessThan(
          parseFloat(detailLayout[`${part}Font`]),
        );
        expect(
          summaryLayout[`${part}Width`] / detailLayout[`${part}Width`],
        ).toBeCloseTo(scale, 2);
        expect(
          summaryLayout[`${part}Height`] / detailLayout[`${part}Height`],
        ).toBeCloseTo(scale, 2);
      }
      await expect(page.locator(".event-heading .lede")).toHaveCSS(
        "view-transition-name",
        descriptionName,
      );
      await expect(page.locator(".event-heading h1")).toHaveCSS(
        "view-transition-name",
        name,
      );
      await expect
        .poll(() =>
          page.evaluate(() =>
            JSON.parse(sessionStorage.getItem("event-transition") ?? "null"),
          ),
        )
        .toEqual({
          path: `${base}/test`,
          animated: reducedMotion === "no-preference",
          ready: reducedMotion === "no-preference",
        });
      if (reducedMotion === "no-preference") {
        const motions = await page.evaluate(() =>
          JSON.parse(sessionStorage.getItem("event-transition-motion") ?? "[]"),
        );
        expect(motions.length).toBeGreaterThan(0);
        expect(
          await page.evaluate(() =>
            JSON.parse(
              sessionStorage.getItem("event-transition-text") ?? "null",
            ),
          ),
        ).toEqual({
          oldOpacity: "0",
          newAnimation: "none",
          duration: "0.2s",
        });
        for (const motion of motions) {
          expect(motion.delay).toBeCloseTo(150, 3);
          expect(motion.duration).toBeCloseTo(160, 3);
        }
        const content = await page.evaluate(() =>
          JSON.parse(
            sessionStorage.getItem("event-transition-content") ?? "[]",
          ),
        );
        expect(content).toHaveLength(2);
        for (const layer of content) {
          expect(layer.animation).toBe("event-content-in");
          expect(layer.delay).toBe("0.15s");
          expect(layer.duration).toBe("0.16s");
          expect(layer.opacity).toBe("0");
          expect(layer.transform).not.toBe("none");
        }
      }
      await page.goBack();
      await expect(page).toHaveURL(base);
      await expect
        .poll(() =>
          page.evaluate(() =>
            JSON.parse(sessionStorage.getItem("event-transition") ?? "null"),
          ),
        )
        .toEqual({
          path: base,
          animated: reducedMotion === "no-preference",
          ready: reducedMotion === "no-preference",
        });
      const featuredImage = page.locator(".hero-slide img").first();
      const imageName = await featuredImage.evaluate(
        (el) => getComputedStyle(el).viewTransitionName,
      );
      expect(imageName).toMatch(/^event-image-/);
      await page.locator(".hero-copy h2 a").first().click();
      await expect(page.locator(".event-story .editorial-image img")).toHaveCSS(
        "view-transition-name",
        imageName,
      );
      await page.locator(".back-link").click();
      await expect(page).toHaveURL(base);
      await expect(page.locator(".hero-slide img").first()).toHaveCSS(
        "view-transition-name",
        imageName,
      );
      await expect(page.locator(".hero-controls button").last()).toBeEnabled();
    });
  }
}
