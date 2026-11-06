import { expect, test } from "@playwright/test";

const commit = "0123456789abcdef0123456789abcdef01234567";

test("footer shows the deployed commit", async ({ page }) => {
  await page.goto("/en");
  await expect(
    page.locator(".site-footer").getByRole("link", { name: "dev · 0123456" }),
  ).toHaveAttribute(
    "href",
    `https://github.com/common-verse/common-verse/commit/${commit}`,
  );
  const response = await page.request.get("/api/version");
  expect(await response.json()).toEqual({ version: commit });
});

for (const locale of ["en", "ar"] as const) {
  test(`${locale} banner offers a reload once a new version is deployed`, async ({
    page,
  }) => {
    let version = commit;
    await page.route("**/api/version", (route) =>
      route.fulfill({ json: { version } }),
    );
    await page.clock.install();
    await page.goto(`/${locale}`);
    const banner = page.getByRole("status").filter({ has: page.getByRole("button") });

    await page.clock.fastForward(60_000);
    await expect(banner).toBeHidden();

    version = "fedcba9876543210fedcba9876543210fedcba98";
    await page.clock.fastForward(60_000);
    await expect(banner).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      locale === "ar" ? "rtl" : "ltr",
    );

    // Stays right below the sticky header while scrolling.
    await page.evaluate(() => scrollTo({ top: 2000, behavior: "instant" }));
    await expect
      .poll(async () => {
        const header = (await page.locator(".site-header").boundingBox())!;
        // The banner covers the header's 1px bottom border.
        return Math.abs((await banner.boundingBox())!.y - (header.y + header.height));
      })
      .toBeLessThanOrEqual(1);

    await expect(banner.getByRole("button")).toHaveAccessibleName(
      locale === "ar" ? /.+/ : "Reload",
    );
    await banner.getByRole("button").click();
    await page.waitForLoadState("load");
    await expect(banner).toBeHidden();
  });
}
