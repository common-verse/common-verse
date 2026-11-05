import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { seed } from "./seed";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "poetry-seed-"));
  directories.push(directory);
  const payload = {
    collections: { media: { config: { upload: { staticDir: directory } } } },
    db: {
      beginTransaction: vi.fn().mockResolvedValue("transaction-1"),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    },
    logger: { info: vi.fn() },
    count: vi.fn().mockResolvedValue({ totalDocs: 0 }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn(),
  };
  return {
    directory,
    payload,
    run: (onlyIfEmpty = false) =>
      seed(payload as unknown as Payload, { onlyIfEmpty }),
  };
}

describe("curated prototype seeding", () => {
  it("never changes a populated database in automatic mode", async () => {
    for (const populated of ["authors", "media", "pages", "poems", "events"]) {
      const f = await fixture();
      f.payload.count.mockImplementation(async ({ collection }) => ({
        totalDocs: collection === populated ? 1 : 0,
      }));
      await f.run(true);
      expect(f.payload.create).not.toHaveBeenCalled();
      expect(f.payload.update).not.toHaveBeenCalled();
      expect(f.payload.db.commitTransaction).toHaveBeenCalledWith(
        "transaction-1",
      );
    }
  });
  it("creates the multilingual demo in one transaction without creating users", async () => {
    const f = await fixture();
    await f.run(true);
    const operations = [
      ...f.payload.count.mock.calls,
      ...f.payload.find.mock.calls,
      ...f.payload.create.mock.calls,
      ...f.payload.update.mock.calls,
    ];
    for (const [args] of operations)
      expect(args.req.transactionID).toBe("transaction-1");
    const created = f.payload.create.mock.calls.map(
      ([args]) => args.collection,
    );
    expect(created.slice(0, 2)).toEqual(["media", "events"]);
    expect(new Set(created)).toEqual(
      new Set(["media", "events", "cities", "authors", "poems"]),
    );
    expect(
      f.payload.update.mock.calls
        .filter(([args]) => args.collection === "events")
        .map(([args]) => args.locale),
    ).toEqual(["en", "ar", "fa", "uk", "ku"]);
    expect(f.payload.db.commitTransaction).toHaveBeenCalledOnce();
    expect(f.payload.db.rollbackTransaction).not.toHaveBeenCalled();
  });
  it("rolls back every record and removes only its own failed upload", async () => {
    const f = await fixture();
    await writeFile(path.join(f.directory, "editor-upload.svg"), "preserve me");
    f.payload.create.mockImplementation(async (args) => {
      if (args.collection === "media") {
        await writeFile(path.join(f.directory, args.file.name), args.file.data);
        return { id: 1 };
      }
      throw new Error("Failed workshop write");
    });
    await expect(f.run(true)).rejects.toThrow("Failed workshop write");
    expect(f.payload.db.rollbackTransaction).toHaveBeenCalledWith(
      "transaction-1",
    );
    expect(f.payload.db.commitTransaction).not.toHaveBeenCalled();
    expect(await readdir(f.directory)).toEqual(["editor-upload.svg"]);
    expect(
      await readFile(path.join(f.directory, "editor-upload.svg"), "utf8"),
    ).toBe("preserve me");
    f.payload.create.mockResolvedValue({ id: 2 });
    await f.run(true);
    expect(f.payload.db.commitTransaction).toHaveBeenCalledOnce();
  });
  it("manual repeated seeding leaves existing demo records untouched", async () => {
    const f = await fixture();
    f.payload.find.mockResolvedValue({ docs: [{ id: 1 }] });
    await f.run();
    expect(f.payload.create).not.toHaveBeenCalled();
    expect(f.payload.update).not.toHaveBeenCalled();
  });
});
