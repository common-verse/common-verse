import { expect, test } from "@playwright/test";

for (const [contentLocale, editorLanguage, notice, direction] of [
  ["ar", "en", "Draft preview", "ltr"],
  ["en", "ar", "معاينة المسودة", "rtl"],
]) {
  for (const suffix of ["", "/events/live-preview", "/poems/test-poem"]) {
    test(`${contentLocale}${suffix} preview notice follows the ${editorLanguage} editor language`, async ({
      page,
    }) => {
      await page.goto(
        `/${contentLocale}${suffix}?previewSecret=test-preview&editorLanguage=${editorLanguage}`,
      );
      const banner = page.locator(`[data-slot="banner"]:not([data-update-banner])`);
      await expect(banner).toHaveText(notice);
      await expect(banner).toHaveAttribute("lang", editorLanguage);
      await expect(banner).toHaveAttribute("dir", direction);
      await expect(page.locator("html")).toHaveAttribute("lang", contentLocale);
      await page.reload();
      await expect(banner).toHaveText(notice);
    });
  }
}

test("preview notice falls back to English without a supported editor language", async ({
  page,
}) => {
  for (const editorQuery of [
    "",
    "&editorLanguage=unknown",
    "&editorLanguage=ku",
  ]) {
    await page.goto(`/ar?previewSecret=test-preview${editorQuery}`);
    await expect(page.locator(`[data-slot="banner"]:not([data-update-banner])`)).toHaveText("Draft preview");
    await expect(page.locator(`[data-slot="banner"]:not([data-update-banner])`)).toHaveAttribute("lang", "en");
  }
  await page.goto("/ar?editorLanguage=en");
  await expect(page.locator(`[data-slot="banner"]:not([data-update-banner])`)).toHaveCount(0);
});

for (const locale of ["en", "ar"]) {
  for (const path of [
    `/${locale}`,
    `/${locale}/events/live-preview`,
    `/${locale}/poems/test-poem`,
  ]) {
    test(`${path} draft preview refreshes after a CMS save`, async ({
      page,
    }) => {
      const cmsURL = `http://127.0.0.1:${process.env.PLAYWRIGHT_CMS_PORT ?? "3001"}`;
      await page.goto(
        `${cmsURL}/preview-host?path=${encodeURIComponent(path)}`,
      );
      await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
      const frame = page
        .frames()
        .find((entry) => entry.url().includes("previewSecret="))!;
      await expect(frame.locator("html")).toHaveAttribute(
        "dir",
        locale === "ar" ? "rtl" : "ltr",
      );
      await expect(frame.getByRole("heading", { level: 1 })).toBeVisible();
      if (path.includes("events")) {
        await page.request.post(`${cmsURL}/preview-update?locale=${locale}`);
      }
      const refreshed = frame.waitForNavigation();
      await page.locator("iframe").evaluate((iframe: HTMLIFrameElement) => {
        iframe.contentWindow?.postMessage(
          { type: "payload-document-event" },
          "*",
        );
      });
      const response = await refreshed;
      expect(response?.headers()["cache-control"]).toBe("no-store");
      expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
      if (path.includes("events")) {
        await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
          "Updated workshop draft",
        );
      }
    });
  }
}

test("homepage preview reflects a saved section reorder", async ({ page }) => {
  const cmsURL = `http://127.0.0.1:${process.env.PLAYWRIGHT_CMS_PORT ?? "3001"}`;
  await page.goto(`${cmsURL}/preview-host?path=/fa`);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const frame = page
    .frames()
    .find((entry) => entry.url().includes("previewSecret="))!;
  const before = await frame
    .locator(".home-section")
    .evaluateAll((sections) => sections.map((section) => section.className));
  await page.request.post(
    `${cmsURL}/preview-update?document=homepage&locale=fa`,
  );
  const refreshed = frame.waitForNavigation();
  await page.locator("iframe").evaluate((iframe: HTMLIFrameElement) => {
    iframe.contentWindow?.postMessage({ type: "payload-document-event" }, "*");
  });
  await refreshed;
  const after = await frame
    .locator(".home-section")
    .evaluateAll((sections) => sections.map((section) => section.className));
  expect(after).toEqual(before.toReversed());
  await expect(frame.locator("html")).toHaveAttribute("dir", "rtl");
});
