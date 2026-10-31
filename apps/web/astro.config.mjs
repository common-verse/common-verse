import paraglideConfig from "./paraglide.config.mjs";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  output: "server",
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
    },
  },
  vite: {
    envDir: "../../",
    plugins: [tailwindcss(), paraglideVitePlugin(paraglideConfig)],
  },
});
