import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, connect } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { ensureEnvironment, setup, checkPort, options } from "./setup.mjs";

async function fixture(t) {
  const cwd = await mkdtemp(path.join(tmpdir(), "poetry-setup-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(
    path.join(cwd, ".env.example"),
    await readFile(new URL("../.env.example", import.meta.url)),
  );
  return cwd;
}
const commands = (cwd) => {
  const calls = [];
  return {
    calls,
    args: {
      cwd,
      environment: {},
      pnpm: async (args) => calls.push(["pnpm", ...args]),
      docker: async (args) => calls.push(["docker", ...args]),
    },
  };
};

test("fresh setup creates independent secrets and preserves the file on restart", async (t) => {
  const cwd = await fixture(t);
  const env = await ensureEnvironment(cwd, {});
  assert.match(env.PAYLOAD_SECRET, /^[a-f0-9]{64}$/);
  assert.match(env.PREVIEW_SECRET, /^[a-f0-9]{64}$/);
  assert.match(env.ORDER_LOOKUP_SECRET, /^[a-f0-9]{64}$/);
  const { PAYLOAD_SECRET, PREVIEW_SECRET, ORDER_LOOKUP_SECRET } = env;
  assert.equal(
    new Set([PAYLOAD_SECRET, PREVIEW_SECRET, ORDER_LOOKUP_SECRET]).size,
    3,
  );
  const first = await readFile(path.join(cwd, ".env"), "utf8");
  await ensureEnvironment(cwd, {});
  assert.equal(await readFile(path.join(cwd, ".env"), "utf8"), first);
  assert.equal(
    (await ensureEnvironment(cwd, { PREVIEW_SECRET: "shell-override" }))
      .PREVIEW_SECRET,
    "shell-override",
  );
});
test("existing incomplete configuration fails without overwriting it", async (t) => {
  const cwd = await fixture(t);
  const content = "DATABASE_URL=postgresql://localhost/custom\n";
  await writeFile(path.join(cwd, ".env"), content);
  await assert.rejects(ensureEnvironment(cwd, {}), /Set PAYLOAD_SECRET/);
  assert.equal(await readFile(path.join(cwd, ".env"), "utf8"), content);
});
test("production setup cannot create local secrets", async (t) => {
  const cwd = await fixture(t);
  await assert.rejects(
    ensureEnvironment(cwd, { NODE_ENV: "production" }),
    /cannot run in production/,
  );
  await assert.rejects(readFile(path.join(cwd, ".env")), { code: "ENOENT" });
  await writeFile(path.join(cwd, ".env"), "NODE_ENV=production\n");
  await assert.rejects(ensureEnvironment(cwd, {}), /cannot run in production/);
});
test("local setup waits for health, conditionally seeds, then generates types", async (t) => {
  const c = commands(await fixture(t));
  await setup(c.args);
  assert.deepEqual(c.calls, [
    ["pnpm", "install", "--frozen-lockfile"],
    ["pnpm", "--filter", "@poetry/cms-ui", "compile"],
    ["pnpm", "--filter", "@poetry/web", "compile:ui"],
    [
      "docker",
      "compose",
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "60",
      "postgres",
    ],
    ["pnpm", "--filter", "@poetry/cms", "seed", "--if-empty"],
    ["pnpm", "--filter", "@poetry/cms", "generate:types"],
  ]);
});
test("external databases and no-seed mode never invoke the seed", async (t) => {
  for (const config of [{ externalDatabase: true }, { seed: false }]) {
    const c = commands(await fixture(t));
    await setup({ ...c.args, ...config });
    assert.equal(
      c.calls.some((args) => args.includes("seed")),
      false,
    );
    assert.equal(
      c.calls.some((args) => args[0] === "docker"),
      !config.externalDatabase,
    );
  }
});
test("custom database requires opt-in before any commands run", async (t) => {
  const c = commands(await fixture(t));
  await ensureEnvironment(c.args.cwd, {});
  const filename = path.join(c.args.cwd, ".env");
  await writeFile(
    filename,
    (await readFile(filename, "utf8")).replace(
      "localhost:5432/poetry",
      "remote.example:5432/production",
    ),
  );
  await assert.rejects(setup(c.args), /--external-db/);
  assert.deepEqual(c.calls, []);
});
test("install and Docker failures stop preparation", async (t) => {
  for (const failing of ["pnpm", "docker"]) {
    const c = commands(await fixture(t));
    const failure = async () => {
      throw new Error(`${failing} failed`);
    };
    await assert.rejects(setup({ ...c.args, [failing]: failure }), /failed/);
    assert.equal(
      c.calls.some(
        (args) => args.includes("seed") || args.includes("generate:types"),
      ),
      false,
    );
  }
});
test("occupied ports and unknown flags produce useful errors", async (t) => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(
    checkPort(server.address().port),
    /Stop the existing service/,
  );
  assert.throws(() => options(["--unknown"]), /Unknown option/);
});
test(
  "managed shutdown terminates child servers and releases their ports",
  { timeout: 15000 },
  async (t) => {
    const cwd = await fixture(t);
    const worker = `const net = require('node:net'); const server = net.createServer(); server.listen(0, () => console.log('PORT=' + server.address().port));`;
    const runner = `import {run} from ${JSON.stringify(new URL("./setup.mjs", import.meta.url).href)}; await run(process.execPath, ['-e', ${JSON.stringify(worker)}], ${JSON.stringify(cwd)}, {managed:true});`;
    const filename = path.join(cwd, "runner.mjs");
    await writeFile(filename, runner);
    const parent = spawn(process.execPath, [filename], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(() => parent.kill("SIGTERM"));
    const exit = new Promise((resolve, reject) => {
      parent.once("error", reject);
      parent.once("exit", resolve);
    });
    const port = await new Promise((resolve, reject) => {
      let output = "";
      parent.stdout.on("data", (chunk) => {
        output += chunk;
        const match = /PORT=(\d+)/.exec(output);
        if (match) resolve(Number(match[1]));
      });
      parent.once("exit", () =>
        reject(new Error("Runner stopped before opening a port")),
      );
    });
    parent.kill("SIGTERM");
    await exit;
    // The manager may exit just before the server finishes handling its signal.
    for (let attempt = 0; attempt < 50; attempt++) {
      const open = await new Promise((resolve) => {
        const socket = connect(port);
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => resolve(false));
      });
      if (!open) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.fail("Child server survived managed shutdown");
  },
);

test(
  "managed abort terminates the server process and its descendants",
  { timeout: 15000 },
  async (t) => {
    const cwd = await fixture(t);
    const grandchild =
      "console.log('GRANDCHILD=' + process.pid); setInterval(() => {}, 1000);";
    const worker = `console.log('CHILD=' + process.pid); require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], {stdio:'inherit'});`;
    const runner = `import {run} from ${JSON.stringify(new URL("./setup.mjs", import.meta.url).href)}; const controller = new AbortController(); process.on('message', () => controller.abort()); await run(process.execPath, ['-e', ${JSON.stringify(worker)}], ${JSON.stringify(cwd)}, {managed:true, signal:controller.signal}); process.disconnect();`;
    const filename = path.join(cwd, "tree.mjs");
    await writeFile(filename, runner);
    const parent = spawn(process.execPath, [filename], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    t.after(() => parent.kill("SIGTERM"));
    const exit = new Promise((resolve, reject) => {
      parent.once("error", reject);
      parent.once("exit", resolve);
    });
    const children = await new Promise((resolve, reject) => {
      let output = "";
      parent.stdout.on("data", (chunk) => {
        output += chunk;
        const child = /CHILD=(\d+)/.exec(output);
        const descendant = /GRANDCHILD=(\d+)/.exec(output);
        if (child && descendant)
          resolve([Number(child[1]), Number(descendant[1])]);
      });
      parent.once("exit", () =>
        reject(new Error("Runner exited before descendants started")),
      );
    });
    parent.send("stop");
    await exit;
    for (let attempt = 0; attempt < 50; attempt++) {
      const alive = children.filter((pid) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch (error) {
          if (error.code === "ESRCH") return false;
          throw error;
        }
      });
      if (!alive.length) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.fail("Descendants survived managed abort");
  },
);
