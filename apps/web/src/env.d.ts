/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_CMS_URL?: string;
  readonly PUBLIC_SITE_URL?: string;
  /** Commit of this build; CI sets it for deployed environments. */
  readonly PUBLIC_COMMIT_SHA?: string;
  readonly PREVIEW_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
