import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const locale of ["de", "ar"] as const) {
  test(`${locale} theme choices work on mobile and survive navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(locale === "de" ? "/" : "/ar");
    const name = locale === "de" ? "Darstellung" : "المظهر";
    const dark = locale === "de" ? "Dunkel" : "داكن";
    const light = locale === "de" ? "Hell" : "فاتح";
    const system = locale === "de" ? "System" : "النظام";
    const trigger = page.getByRole("button", { name: new RegExp(`^${name}:`) });
    await trigger.press("Enter");
    await page.getByRole("radio", { name: dark, exact: true }).check();
    await expect(trigger).toHaveAccessibleName(`${name}: ${dark}`);
    await expect(trigger).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const background = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.reload();
    await expect(trigger).toHaveAccessibleName(`${name}: ${dark}`);
    await trigger.click();
    await expect(
      page.getByRole("radio", { name: dark, exact: true }),
    ).toBeChecked();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("radio", { name: light, exact: true }).check();
    // Wait for the closing popover to unmount before auditing the new theme.
    await expect(page.locator("[data-popover-content]")).toHaveCount(0);
    expect(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).not.toBe(background);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await trigger.click();
    await page.getByRole("radio", { name: system, exact: true }).check();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      background,
    );
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("body")).not.toHaveCSS(
      "background-color",
      background,
    );
    await page.goto("/en/events/test");
    await expect(
      page.getByRole("button", { name: "Appearance: System" }),
    ).toBeVisible();
  });
}

test.describe("server-rendered brand and slate themes", () => {
  test.use({ javaScriptEnabled: false });

  for (const locale of ["de", "ar"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} ${theme} renders the saved palette and readable token pairs without JavaScript`, async ({
        page,
        context,
        baseURL,
      }) => {
        await context.addCookies([
          { name: "poetry-theme", value: theme, url: baseURL! },
        ]);
        // An explicit choice must override the device preference on first render.
        await page.emulateMedia({
          colorScheme: theme === "light" ? "dark" : "light",
        });
        await page.goto(locale === "de" ? "/" : "/ar");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          locale === "ar" ? "rtl" : "ltr",
        );
        const results = await page.evaluate(() => {
          const pairs: [string, string, number][] = [
            ["foreground", "background", 4.5],
            ["card-foreground", "card", 4.5],
            ["popover-foreground", "popover", 4.5],
            ["primary-foreground", "primary", 4.5],
            ["primary-foreground", "primary-hover", 4.5],
            ["primary-text", "background", 4.5],
            ["primary-text", "card", 4.5],
            ["secondary-foreground", "secondary", 4.5],
            ["secondary-text", "background", 4.5],
            ["secondary-text", "card", 4.5],
            ["muted-foreground", "background", 4.5],
            ["muted-foreground", "card", 4.5],
            ["muted-foreground", "muted", 4.5],
            ["accent-foreground", "accent", 4.5],
            ["header-foreground", "header-background", 4.5],
            ["header-foreground", "header-control-background", 4.5],
            ["header-foreground", "header-control-hover", 4.5],
            ["newsletter-foreground", "newsletter-background", 4.5],
            ["input", "background", 3],
            ["input", "card", 3],
            ["header-control-border", "header-control-background", 3],
            ["header-control-border", "header-control-hover", 3],
            ["ring", "background", 3],
            ["ring", "card", 3],
            ["ring", "header-background", 3],
          ];
          for (const status of ["success", "warning", "error", "info"]) {
            pairs.push([`${status}-foreground`, status, 4.5]);
            pairs.push([status, `${status}-subtle`, 4.5]);
          }
          const probe = document.createElement("span");
          document.body.append(probe);
          // Computed colours may be RGB, OKLCH, or color(). Sample sRGB pixels
          // rather than treating every serialisation as three RGB channels.
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d", { colorSpace: "srgb" })!;
          const pageBackground = getComputedStyle(
            document.body,
          ).backgroundColor;
          const rgb = (color: string, layers = [pageBackground]) => {
            if (!CSS.supports("color", color))
              throw new Error(`Invalid colour: ${color}`);
            ctx.clearRect(0, 0, 1, 1);
            for (const layer of [...layers, color]) {
              ctx.fillStyle = layer;
              ctx.fillRect(0, 0, 1, 1);
            }
            const pixel = Array.from(ctx.getImageData(0, 0, 1, 1).data);
            if (pixel[3] !== 255)
              throw new Error(`Non-opaque colour: ${color}`);
            return pixel.slice(0, 3);
          };
          const luminance = (color: string, layers?: string[]) => {
            const channels = rgb(color, layers);
            const linear = channels.map((channel) => {
              const value = channel / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            });
            return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
          };
          const results = pairs.map(([foreground, background, minimum]) => {
            probe.style.color = `var(--${foreground})`;
            probe.style.backgroundColor = `var(--${background})`;
            const style = getComputedStyle(probe);
            const a = luminance(style.color);
            const b = luminance(style.backgroundColor);
            return {
              pair: `${foreground} on ${background}`,
              ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
              minimum,
            };
          });
          probe.style.backgroundColor = "var(--card)";
          const card = getComputedStyle(probe).backgroundColor;
          const nested = [1, 2, 3].map((depth) => {
            const layers = [pageBackground, ...Array<string>(depth).fill(card)];
            const b = luminance(card, layers.slice(0, -1));
            return {
              luminance: b,
              pairs: ["foreground", "muted-foreground", "primary-text"].map(
                (token) => {
                  probe.style.color = `var(--${token})`;
                  const a = luminance(getComputedStyle(probe).color, layers);
                  return {
                    token,
                    ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                  };
                },
              ),
            };
          });
          const alpha = (color: string) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            return ctx.getImageData(0, 0, 1, 1).data[3] / 255;
          };
          const cardAlpha = alpha(card);
          probe.style.color = "var(--shadow-color)";
          const shadowAlpha = alpha(getComputedStyle(probe).color);
          const backgroundLuminance = luminance(pageBackground);
          probe.style.color = "var(--primary)";
          const primary = rgb(getComputedStyle(probe).color);
          probe.style.color = "var(--primary-base)";
          const primaryBase = rgb(getComputedStyle(probe).color);
          probe.style.color = "var(--primary-foreground)";
          const primaryForeground = rgb(getComputedStyle(probe).color);
          probe.style.color = "var(--black)";
          const black = rgb(getComputedStyle(probe).color);
          probe.style.color = "var(--header-background)";
          const headerColor = getComputedStyle(probe).color;
          const header = rgb(headerColor);
          const headerAlpha = alpha(headerColor);
          probe.remove();
          return {
            pairs: results,
            backgroundLuminance,
            primary,
            primaryBase,
            primaryForeground,
            black,
            header,
            headerAlpha,
            nested,
            cardAlpha,
            shadowAlpha,
          };
        });
        if (theme === "light") {
          // Neutral header chrome leaves the brand colour for actions and accents.
          expect(Math.min(...results.header)).toBeGreaterThan(240);
          expect(results.backgroundLuminance).toBeGreaterThan(0.85);
          expect(results.cardAlpha).toBe(1);
          expect(results.shadowAlpha).toBeGreaterThan(0);
        } else {
          expect(results.backgroundLuminance).toBeLessThan(0.03);
          expect(results.cardAlpha).toBeGreaterThan(0);
          expect(results.cardAlpha).toBeLessThan(0.1);
          expect(results.shadowAlpha).toBe(0);
          expect(results.nested[1].luminance).toBeGreaterThan(
            results.nested[0].luminance,
          );
          expect(results.nested[2].luminance).toBeGreaterThan(
            results.nested[1].luminance,
          );
        }
        for (const [depth, surface] of results.nested.entries()) {
          for (const pair of surface.pairs) {
            expect(
              pair.ratio,
              `${pair.token} on nested card ${depth + 1}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
        expect(results.primaryBase).toEqual([255, 3, 61]);
        expect(results.primary).toEqual(results.primaryBase);
        expect(results.primaryForeground).toEqual(results.black);
        expect(results.headerAlpha).toBe(1);
        for (const result of results.pairs) {
          expect(result.ratio, result.pair).toBeGreaterThanOrEqual(
            result.minimum,
          );
        }
        // axe injects scripts into frames; the interactive tests audit the DOM.
        // This context specifically checks CSS and SSR with scripting disabled.
        await page.screenshot({
          path: `/tmp/poetry-gold-${locale}-${theme}.png`,
          fullPage: true,
        });
        const ramp = await page.evaluate(() => {
          const root = document.documentElement;
          const probe = document.createElement("span");
          document.body.append(probe);
          const colours = () =>
            [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => {
              probe.style.color = `var(--slate-${shade})`;
              return getComputedStyle(probe).color;
            });
          const before = colours();
          root.style.setProperty("--slate", "#37684a");
          const after = colours();
          root.style.removeProperty("--slate");
          probe.remove();
          return { before, after };
        });
        ramp.before.forEach((colour, index) => {
          expect(ramp.after[index]).not.toBe(colour);
        });
      });
    }
  }
});
