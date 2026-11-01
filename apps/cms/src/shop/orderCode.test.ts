import type { FieldHook } from "payload";
import { expect, it, vi } from "vitest";
import { codeField, generateCode, normalizeCode } from "./orderCode";

const crockford = /^[0-9A-HJKMNP-TV-Z]{8}$/;

it("generates 8 Crockford base32 characters", () => {
  const codes = Array.from({ length: 500 }, generateCode);
  for (const code of codes) expect(code).toMatch(crockford);
  expect(new Set(codes.join("")).size).toBe(32);
});

it.each([
  ["K7QD-93FA", "K7QD93FA"],
  [" k7qd 93fa ", "K7QD93FA"],
  ["OIL0-ABCD", "0110ABCD"],
])("normalizes %j", (input, code) => {
  expect(normalizeCode(input)).toBe(code);
});

it.each([["K7QD93F"], ["K7QD93FAB"], ["K7QD93FU"], ["K7QD_93F"], [42], [null]])(
  "rejects %j",
  (input) => expect(normalizeCode(input)).toBeNull(),
);

function hook(
  collection: "orders" | "transactions",
  {
    taken = 0,
    takenIn = "transactions",
    transactionCode = "TX5CODE1" as string | null,
  } = {},
) {
  const field = codeField(collection);
  // The first `taken` codes already exist in `takenIn`.
  const count = vi.fn(async (args: { collection: string }) => ({
    totalDocs: args.collection === takenIn && taken-- > 0 ? 1 : 0,
  }));
  const findByID = vi.fn(async () => ({ code: transactionCode }));
  const run = (args: Record<string, unknown>) =>
    (field.hooks!.beforeChange![0] as FieldHook)({
      req: { payload: { count, findByID } },
      ...args,
    } as never);
  return { count, findByID, run };
}

it("gives a new transaction a free code", async () => {
  const { run } = hook("transactions");
  await expect(run({ operation: "create", data: {} })).resolves.toMatch(
    crockford,
  );
});

it("keeps the code on update", async () => {
  const { run } = hook("orders");
  await expect(
    run({
      operation: "update",
      value: "CHANGED1",
      originalDoc: { code: "K7QD93FA" },
    }),
  ).resolves.toBe("K7QD93FA");
});

it("copies the code from the order's transaction", async () => {
  const { findByID, run } = hook("orders");
  await expect(
    run({ operation: "create", data: { transactions: [5] } }),
  ).resolves.toBe("TX5CODE1");
  expect(findByID).toHaveBeenCalledWith(
    expect.objectContaining({ collection: "transactions", id: 5 }),
  );
});

it("generates an order code when the transaction has none", async () => {
  const { run } = hook("orders", { transactionCode: null });
  await expect(
    run({ operation: "create", data: { transactions: [{ id: 5 }] } }),
  ).resolves.toMatch(crockford);
});

it.each(["orders", "transactions"])(
  "retries codes already used by %s and gives up after five",
  async (takenIn) => {
    const attempts = (count: ReturnType<typeof hook>["count"]) =>
      count.mock.calls.filter(([args]) => args.collection === takenIn).length;
    const retry = hook("orders", { transactionCode: null, taken: 2, takenIn });
    await expect(retry.run({ operation: "create", data: {} })).resolves.toMatch(
      crockford,
    );
    expect(attempts(retry.count)).toBe(3);
    const full = hook("transactions", { taken: 6, takenIn });
    await expect(full.run({ operation: "create", data: {} })).rejects.toThrow(
      "unique",
    );
    expect(attempts(full.count)).toBe(5);
  },
);
