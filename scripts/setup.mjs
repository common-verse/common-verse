import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const root = fileURLToPath(new URL("../", import.meta.url));

export function run(
  command,
  args,
  cwd = root,
  { managed = false, signal } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: managed ? ["ignore", "inherit", "inherit"] : "inherit",
      detached: managed && process.platform !== "win32",
    });
    let interrupted = false;
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        const killer = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          { stdio: "ignore" },
        );
        killer.on("error", () => child.kill());
      } else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") reject(error);
        }
      }
    };
    const interrupt = () => {
      interrupted = true;
      stop();
    };
    const cleanup = () => {
      if (managed) {
        process.off("SIGINT", interrupt);
        process.off("SIGTERM", interrupt);
        signal?.removeEventListener("abort", interrupt);
        stop();
      }
    };
    if (managed) {
      process.on("SIGINT", interrupt);
      process.on("SIGTERM", interrupt);
      signal?.addEventListener("abort", interrupt, { once: true });
    }
    child.once("error", (error) => {
      cleanup();
      reject(new Error(`Cannot run ${command}: ${error.message}`));
    });
    child.once("exit", (code, exitSignal) => {
      cleanup();
      if (code === 0 || interrupted) resolve();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} failed (${exitSignal ?? code}).`,
          ),
        );
    });
  });
}

export function runPnpm(args, cwd = root) {
  const cli = process.env.npm_execpath;
  if (!cli) throw new Error("Run through pnpm: pnpm dev or pnpm dev:setup.");
  return /\.[cm]?js$/.test(cli)
    ? run(process.execPath, [cli, ...args], cwd)
    : run(cli, args, cwd);
}

export async function ensureEnvironment(cwd = root, environment = process.env) {
  if (environment.NODE_ENV === "production")
    throw new Error("Development setup cannot run in production.");
  const filename = path.join(cwd, ".env");
  let exists = true;
  try {
    await readFile(filename);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    exists = false;
  }
  if (!exists) {
    const template = await readFile(path.join(cwd, ".env.example"), "utf8");
    const content = template.replace(/replace-with-[\w-]+/g, () =>
      randomBytes(32).toString("hex"),
    );
    try {
      await writeFile(filename, content, { flag: "wx", mode: 0o600 });
      console.log("Created root .env with independent local secrets.");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const env = { ...parseEnv(await readFile(filename, "utf8")), ...environment };
  if (env.NODE_ENV === "production")
    throw new Error("Development setup cannot run in production.");
  for (const key of [
    "DATABASE_URL",
    "PAYLOAD_SECRET",
    "PREVIEW_SECRET",
    "ORDER_LOOKUP_SECRET",
  ]) {
    if (!env[key] || env[key].startsWith("replace-with-"))
      throw new Error(
        `Set ${key} in the root .env; existing values are preserved.`,
      );
  }
  return env;
}

export function usesComposeDatabase(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "postgresql:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    (url.port || "5432") === "5432" &&
    url.pathname === "/poetry" &&
    url.username === "poetry" &&
    url.password === "poetry" &&
    !url.search
  );
}

export function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is unavailable. Stop the existing service before pnpm dev.`,
        ),
      ),
    );
    server.listen(port, () => server.close(resolve));
  });
}

export function options(args) {
  for (const arg of args)
    if (!["--external-db", "--no-seed"].includes(arg))
      throw new Error(
        `Unknown option: ${arg}. Supported: --external-db, --no-seed.`,
      );
  return {
    externalDatabase: args.includes("--external-db"),
    seed: !args.includes("--no-seed"),
  };
}

export async function setup({
  cwd = root,
  environment = process.env,
  externalDatabase = false,
  seed = true,
  pnpm = (args) => runPnpm(args, cwd),
  docker = (args) => run("docker", args, cwd),
} = {}) {
  const env = await ensureEnvironment(cwd, environment);
  if (!externalDatabase && !usesComposeDatabase(env.DATABASE_URL))
    throw new Error(
      "DATABASE_URL differs from Compose. Use --external-db; automatic seeding is disabled there.",
    );
  console.log("Checking locked workspace dependencies…");
  await pnpm(["install", "--frozen-lockfile"]);
  await pnpm(["--filter", "@poetry/cms-ui", "compile"]);
  await pnpm(["--filter", "@poetry/web", "compile:ui"]);
  if (!externalDatabase) {
    console.log(
      "Starting PostgreSQL and waiting for health (Docker must be running)…",
    );
    await docker([
      "compose",
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "60",
      "postgres",
    ]);
    if (seed) await pnpm(["--filter", "@poetry/cms", "seed", "--if-empty"]);
  }
  await pnpm(["--filter", "@poetry/cms", "generate:types"]);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await setup(options(process.argv.slice(2)));
  } catch (error) {
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
