import paraglideConfig from "./paraglide.config.mjs";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

// Behind a reverse proxy that sets X-Forwarded-For, TRUST_PROXY=true at build time lets Astro
// read the buyer's IP from it (for rate limits) on requests for the site's own host.
// Without it every request counts as the proxy's address; never set it without such a proxy.
const trustedHost =
  process.env.TRUST_PROXY === "true" && process.env.PUBLIC_SITE_URL
    ? new URL(process.env.PUBLIC_SITE_URL).hostname
    : null;

export default defineConfig({
  output: "server",
  security: trustedHost
    ? { allowedDomains: [{ hostname: trustedHost }] }
    : undefined,
  adapter: node({ mode: "standalone" }),
  integrations: [
    svelte(),
    {
      name: "separate-vite-caches",
      hooks: {
        "astro:config:setup": ({ command, updateConfig }) => {
          updateConfig({ vite: { cacheDir: `node_modules/.vite-${command}` } });
        },
      },
    },
  ],
  server: { port: 4321 },
  env: {
    schema: {
      PUBLIC_STRIPE_PUBLISHABLE_KEY: envField.string({
        context: "server",
        access: "public",
        optional: true,
      }),
      PLACE_SEARCH_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
  vite: {
    envDir: "../../",
    plugins: [tailwindcss(), paraglideVitePlugin(paraglideConfig)],
  },
});
