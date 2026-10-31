import { defineMiddleware } from "astro:middleware";
import {
  defaultLocale,
  fixedPageKeys,
  isLocale,
  localizedPath,
  unlocalizedPath,
} from "@poetry/i18n";

/** Render canonical German URLs internally; normalize main-page aliases. */
export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;
  const prefix = pathname.split("/")[1];
  const locale = isLocale(prefix) ? prefix : defaultLocale;
  const identity = unlocalizedPath(pathname);
  const mainPage =
    identity === "/" ||
    fixedPageKeys.some((page) => identity === `/${page}`) ||
    /^\/(events|poems|authors|articles|shop)$/.test(identity);
  const knownPage =
    mainPage ||
    /^\/(events|poems|authors|articles|shop)\/[^/]+\/?$/.test(identity) ||
    identity === "/shop/checkout/complete";
  const canonicalPath = localizedPath(locale, identity);
  if (knownPage && pathname !== canonicalPath) {
    if (mainPage) return context.redirect(`${canonicalPath}${search}`, 301);
    return new Response("Not found", { status: 404 });
  }
  if (locale === defaultLocale && knownPage) {
    return next(
      new URL(`/de${identity === "/" ? "" : identity}${search}`, context.url),
    );
  }
  return next();
});
