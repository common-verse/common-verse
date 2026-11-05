// Dev only: creates the shared test accounts from the server's .env. The
// regular seeds deliberately never create credentials (docs/demo-data.md).
import { getPayload } from "payload";
import config from "../src/payload.config";

const accounts = [
  {
    role: "admin",
    name: "Dev Admin",
    email: process.env.DEV_ADMIN_EMAIL,
    password: process.env.DEV_ADMIN_PASSWORD,
  },
  {
    role: "editor",
    name: "Dev Editor",
    email: process.env.DEV_EDITOR_EMAIL,
    password: process.env.DEV_EDITOR_PASSWORD,
  },
] as const;

const payload = await getPayload({ config });
try {
  for (const { role, name, email, password } of accounts) {
    if (!email || !password) throw new Error(`Missing ${role} credentials.`);
    const { totalDocs } = await payload.count({
      collection: "users",
      where: { email: { equals: email } },
      overrideAccess: true,
    });
    if (totalDocs === 0)
      await payload.create({
        collection: "users",
        data: { email, password, name, role },
        overrideAccess: true,
      });
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await payload.destroy();
}
process.exit(process.exitCode ?? 0);
