import path from "node:path";
import { fileURLToPath } from "node:url";
import "./env";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { label } from "@poetry/cms-ui";
import { mcpPlugin } from "@payloadcms/plugin-mcp";
import { ar } from "@payloadcms/translations/languages/ar";
import { de } from "@payloadcms/translations/languages/de";
import { en } from "@payloadcms/translations/languages/en";
import { fa } from "@payloadcms/translations/languages/fa";
import { uk } from "@payloadcms/translations/languages/uk";
import { buildConfig } from "payload";
import sharp from "sharp";

import { administrator } from "./collections/access";
import { Articles } from "./collections/Articles";
import { Authors } from "./collections/Authors";
import { Media } from "./collections/Media";
import { Pages } from "./collections/Pages";
import { Poems } from "./collections/Poems";
import { Users } from "./collections/Users";
import { Locations } from "./collections/Locations";
import { Events } from "./collections/Events";
import { contentFields } from "./components/contentFields";
import { FixedPages } from "./globals/FixedPages";
import { Homepage } from "./globals/Homepage";
import { EventsPage } from "./globals/EventsPage";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    components: { Nav: "./components/Nav#Nav" },
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: " · The Poetry Project" },
  },
  collections: [
    Articles,
    Events,
    Locations,
    Poems,
    Authors,
    Media,
    Users,
    Pages,
  ].map((collection) => ({
    ...collection,
    fields: contentFields(collection.fields),
    admin: {
      ...collection.admin,
      components: {
        ...collection.admin?.components,
        edit: {
          ...collection.admin?.components?.edit,
          beforeDocumentControls: [
            "./components/CollectionLabels#CollectionLabels",
          ],
        },
      },
    },
  })),
  globals: [Homepage, EventsPage, ...FixedPages].map((global) => ({
    ...global,
    fields: contentFields(global.fields),
    admin: {
      ...global.admin,
      components: {
        elements: {
          beforeDocumentControls: [
            "./components/CollectionLabels#CollectionLabels",
          ],
        },
      },
    },
  })),
  plugins: [
    mcpPlugin({
      overrideApiKeyCollection: (collection) => ({
        ...collection,
        admin: {
          ...collection.admin,
          group: label("administration"),
          hidden: ({ user }) => user?.role !== "admin",
        },
        access: {
          ...collection.access,
          create: administrator,
          read: administrator,
          update: administrator,
          delete: administrator,
        },
      }),
      collections: {
        media: {
          description:
            "Images and their localized accessible alternative text.",
          enabled: { find: true, create: true, update: true, delete: false },
        },
        authors: {
          description: "Poet and author profiles used by published poetry.",
          enabled: { find: true, create: true, update: true, delete: false },
        },
        events: {
          description: "Localized workshop drafts and published event content.",
          enabled: { find: true, create: true, update: true, delete: false },
        },
        poems: {
          description:
            "Poem originals with optional explicit translation records.",
          enabled: { find: true, create: true, update: true, delete: false },
        },
      },
    }),
  ],
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    migrationDir: path.resolve(dirname, "migrations"),
  }),
  editor: lexicalEditor(),
  localization: {
    locales: [
      { code: "de", label: "Deutsch" },
      { code: "en", label: "English" },
      { code: "ar", label: "العربية", rtl: true },
      { code: "fa", label: "فارسی", rtl: true },
      { code: "uk", label: "Українська" },
      { code: "ku", label: "Kurdî (Kurmancî)" },
    ],
    defaultLocale: "de",
    fallback: false,
  },
  i18n: { fallbackLanguage: "en", supportedLanguages: { de, en, ar, fa, uk } },
  secret: process.env.PAYLOAD_SECRET ?? "",
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL ?? "http://localhost:3001",
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
