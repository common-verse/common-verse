import type { APIRoute } from "astro";
import { defaultLocale, isLocale } from "@poetry/i18n";
import {
  applyChange,
  isSuccess,
  loadCart,
  statusMessage,
  type CartChange,
} from "../../lib/cart-actions";

// The cart drawer's backend: the browser never talks to the CMS or sees the cart secret.
const headers = {
  "content-type": "application/json",
  "cache-control": "no-store",
};
const localeOf = (url: URL) => {
  const locale = url.searchParams.get("locale") ?? undefined;
  return isLocale(locale) ? locale : defaultLocale;
};

export const GET: APIRoute = async ({ cookies, url }) => {
  const { view } = await loadCart(cookies, localeOf(url));
  return new Response(JSON.stringify({ view }), { headers });
};

export const POST: APIRoute = async ({ cookies, request, url }) => {
  // JSON only: a cross-site page cannot send it without a CORS preflight, which this route never allows.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response(null, { status: 415 });
  const locale = localeOf(url);
  const body: unknown = await request.json().catch(() => null);
  const change: CartChange = body && typeof body === "object" ? body : {};
  const { status, removed } = await applyChange(cookies, locale, change).catch(
    (error) => {
      console.error(error);
      return { status: "failed" as const, removed: undefined };
    },
  );
  const { view } = await loadCart(cookies, locale);
  return new Response(
    JSON.stringify({
      status,
      removed,
      view,
      message: isSuccess(status) ? undefined : statusMessage(status, locale),
    }),
    { headers },
  );
};
