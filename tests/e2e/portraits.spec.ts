import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"]) {
  test(`${locale} homepage cards without a portrait use a local avatar`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const remoteAvatars: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("dicebear.com"))
        remoteAvatars.push(request.url());
    });
    await page.goto(`/${locale}`);
    const card = page.locator(".author-grid article").filter({
      has: page.getByRole("link", {
        name: "Prototype Collective",
        exact: true,
      }),
    });
    const source = await card.locator("img").getAttribute("src");
    expect(source).toMatch(/^data:image\/svg\+xml/);
    await expect(card.locator("img")).toHaveAttribute("alt", "");
    const overview = page.waitForResponse((response) =>
      response.url().endsWith(`/${locale}/authors`),
    );
    await card
      .getByRole("link", { name: "Prototype Collective", exact: true })
      .click();
    expect((await overview).status()).toBe(200);
    await page.goto(`/${locale}/authors`);
    const avatars = await page
      .locator(".author-grid img")
      .evaluateAll((images) =>
        images.map((image) => (image as HTMLImageElement).src),
      );
    expect(new Set(avatars).size).toBe(avatars.length);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(remoteAvatars).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("avatars.png") });
  });
}
