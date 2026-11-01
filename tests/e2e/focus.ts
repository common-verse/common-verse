import { expect, type Page } from "@playwright/test";

/** The focused element shows whole (top, centre, bottom), not under the header, a notice or the bottom bar. */
export const expectFocusedVisible = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused || focused === document.body) return "visible";
        const { x, y, width, height } = focused.getBoundingClientRect();
        for (const pointY of [y + 2, y + height / 2, y + height - 2]) {
          const top = document.elementFromPoint(x + width / 2, pointY);
          if (!top || !(focused.contains(top) || top.contains(focused))) {
            const name = (element: Element | null) =>
              element
                ? `<${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.classList.length ? `.${Array.from(element.classList).join(".")}` : ""}>`
                : "nothing";
            return `${name(focused)} "${focused.textContent?.trim().slice(0, 30)}" under ${name(top)} at y=${Math.round(pointY)} (viewport ${innerHeight}, scrollY ${Math.round(scrollY)} of ${document.documentElement.scrollHeight - innerHeight})`;
          }
        }
        return "visible";
      }),
    )
    .toBe("visible");

/** Tabs until `last` has focus, checking every focused element on the way. */
export async function expectFocusNeverObscured(page: Page, last: string) {
  for (let press = 0; press < 60; press++) {
    await page.keyboard.press("Tab");
    await expectFocusedVisible(page);
    if (
      await page
        .locator(last)
        .evaluate((element) => element === document.activeElement)
    )
      return;
  }
  throw new Error(`${last} never got focus`);
}
