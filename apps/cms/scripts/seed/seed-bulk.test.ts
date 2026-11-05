import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Payload } from "payload";
import { afterEach, describe, expect, it, vi } from "vitest";
import { locales } from "@poetry/i18n";
import { assertBulkSeedEnvironment, bulkCounts, seedBulk } from "./seed-bulk";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://poetry:poetry@localhost:5432/poetry",
  );
  const directory = await mkdtemp(path.join(tmpdir(), "poetry-bulk-"));
  directories.push(directory);
  type RecordData = { id: number; [key: string]: unknown };
  const records: Record<string, RecordData[]> = {};
  const payload = {
    collections: { media: { config: { upload: { staticDir: directory } } } },
    db: {
      beginTransaction: vi.fn().mockResolvedValue("bulk-transaction"),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    },
    logger: { info: vi.fn() },
    find: vi.fn(async ({ collection, where }) => {
      const [field, condition] = Object.entries(where)[0] as [
        string,
        { equals: unknown },
      ];
      return {
        docs: (records[collection] ?? []).filter(
          (record) =>
            field
              .split(".")
              .reduce<unknown>(
                (value, key) => (value as Record<string, unknown>)?.[key],
                record,
              ) === condition.equals,
        ),
      };
    }),
    create: vi.fn(async ({ collection, data, file }) => {
      const docs = (records[collection] ??= []);
      const doc = { ...data, id: docs.length + 1 };
      docs.push(doc);
      if (file) await writeFile(path.join(directory, file.name), file.data);
      return doc;
    }),
    update: vi.fn(async () => ({})),
  };
  return {
    directory,
    payload,
    records,
    run: () => seedBulk(payload as unknown as Payload),
  };
}

describe("optional bulk demo seed", () => {
  it("creates substantial multilingual content, preserving records on repeat runs", async () => {
    const f = await fixture();
    expect(await f.run()).toEqual(bulkCounts);
    expect(
      f.records.events.filter((event) => event._status === "draft"),
    ).toHaveLength(20);
    for (const event of f.records.events) {
      expect(Number.isFinite(Date.parse(event.startDate as string))).toBe(true);
      expect(event.endDate).toBeUndefined();
      expect(event.content).toHaveProperty("root");
      for (const removed of ["kind", "price", "seo"])
        expect(event).not.toHaveProperty(removed);
    }
    for (const [args] of [
      ...f.payload.find.mock.calls,
      ...f.payload.create.mock.calls,
      ...f.payload.update.mock.calls,
    ])
      expect(
        (args as { req: { transactionID: string } }).req.transactionID,
      ).toBe("bulk-transaction");
    expect(f.records.users).toBeUndefined();
    const updates = f.payload.update.mock.calls.length;
    // A renamed event remains identifiable by slug, including when it is a draft.
    f.records.events[0].title = "Editor revision";
    expect(await f.run()).toEqual({ events: 0, media: 0 });
    expect(f.records.events[0].title).toBe("Editor revision");
    expect(f.payload.update.mock.calls).toHaveLength(updates);
    expect(f.payload.db.commitTransaction).toHaveBeenCalledTimes(2);
    expect(f.payload.db.rollbackTransaction).not.toHaveBeenCalled();
  });
  it("generates the same values and dates on a fresh run", async () => {
    const first = await fixture();
    const second = await fixture();
    await first.run();
    await second.run();
    expect(second.records).toEqual(first.records);
  });
  it("rolls back failures and removes only this attempt's uploads", async () => {
    const f = await fixture();
    await writeFile(path.join(f.directory, "editor.svg"), "preserve");
    f.payload.update.mockRejectedValueOnce(new Error("Translation failed"));
    await expect(f.run()).rejects.toThrow("Translation failed");
    expect(f.payload.db.rollbackTransaction).toHaveBeenCalledWith(
      "bulk-transaction",
    );
    expect(f.payload.db.commitTransaction).not.toHaveBeenCalled();
    expect(await readdir(f.directory)).toEqual(["editor.svg"]);
  });
  it("rejects production and external databases before writing", async () => {
    const f = await fixture();
    vi.stubEnv("NODE_ENV", "production");
    expect(assertBulkSeedEnvironment).toThrow("disabled in production");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:password@remote.example/poetry",
    );
    await expect(f.run()).rejects.toThrow("local poetry database");
    expect(f.payload.db.beginTransaction).not.toHaveBeenCalled();
  });
});
