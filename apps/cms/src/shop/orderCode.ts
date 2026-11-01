import { label } from "@poetry/cms-ui";
import { randomInt } from "node:crypto";
import type { PayloadRequest, TextField } from "payload";

// Crockford base32: no I, L, O or U, so codes survive being read aloud or retyped.
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const generateCode = () =>
  Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join(
    "",
  );

/** Accepts what buyers type: any case, hyphens, spaces, and O, I or L for 0 and 1. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code) ? code : null;
}

type Collection = "orders" | "transactions";

// Checked before writing: a unique violation would abort the plugin's database transaction.
// Orders copy their transaction's code, so a code must be free in both collections.
async function uniqueCode(req: PayloadRequest) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const where = { code: { equals: code } };
    const counts = await Promise.all([
      req.payload.count({ collection: "orders", where, req }),
      req.payload.count({ collection: "transactions", where, req }),
    ]);
    if (counts.every(({ totalDocs }) => !totalDocs)) return code;
  }
  throw new Error("Could not generate a unique order code.");
}

/** The public order code: set once on payment start and copied to the order. */
export const codeField = (collection: Collection): TextField => ({
  name: "code",
  type: "text",
  label: label("order_code"),
  unique: true,
  admin: { position: "sidebar", readOnly: true },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (operation !== "create") return originalDoc?.code;
        const [transaction] =
          (collection === "orders" && data?.transactions) || [];
        if (transaction != null) {
          const { code } = await req.payload.findByID({
            collection: "transactions",
            id: typeof transaction === "object" ? transaction.id : transaction,
            depth: 0,
            select: { code: true },
            req,
          });
          if (code) return code;
        }
        return uniqueCode(req);
      },
    ],
  },
});
