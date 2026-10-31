import { expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { fixedPageKeys } from "@poetry/i18n";
import { fixedPagesContent } from "./fixed-pages-content";
import { plainTextToRichText } from "../../src/utilities/plainTextToRichText";
import { seedFixedPages } from "./seed-fixed-pages";

function mockPayload() {
  return {
    db: {
      beginTransaction: vi.fn().mockResolvedValue("transaction"),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    },
    updateGlobal: vi.fn(),
  };
}

it("imports German and English page content with placeholders in one transaction", async () => {
  const payload = mockPayload();
  await seedFixedPages(payload as unknown as Payload);
  expect(payload.updateGlobal).toHaveBeenCalledTimes(fixedPageKeys.length * 2);
  for (const slug of fixedPageKeys) {
    for (const locale of ["de", "en"] as const) {
      expect(payload.updateGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
          slug,
          locale,
          req: { transactionID: "transaction" },
          draft: false,
          data: {
            ...fixedPagesContent[slug][locale],
            content: plainTextToRichText(
              fixedPagesContent[slug][locale].content,
            ),
            _status: "published",
          },
        }),
      );
      expect(JSON.stringify(fixedPagesContent[slug][locale])).not.toMatch(
        /anonym|demo|bisherige Website|previous website|vor Veröffentlichung|before publication/i,
      );
      if (slug !== "about") {
        expect(fixedPagesContent[slug][locale].content).toMatch(/\[[^\]]+\]/);
        expect(fixedPagesContent[slug][locale].content).toContain(
          "@example.invalid",
        );
      }
      expect(fixedPagesContent[slug][locale].content).not.toMatch(
        /thepoetryproject\.de|Max-Beer|Koelbl|Zürcher|35577|76953486/i,
      );
    }
  }
  expect(payload.db.commitTransaction).toHaveBeenCalledWith("transaction");
});

it("rolls back every page if any import fails", async () => {
  const payload = mockPayload();
  payload.updateGlobal.mockRejectedValueOnce(new Error("Database error"));
  await expect(seedFixedPages(payload as unknown as Payload)).rejects.toThrow(
    "Database error",
  );
  expect(payload.db.rollbackTransaction).toHaveBeenCalledWith("transaction");
  expect(payload.db.commitTransaction).not.toHaveBeenCalled();
});
