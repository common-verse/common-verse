import type { APIRoute } from "astro";
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from "astro:env/server";
import { defaultLocale, isLocale, localizedPath } from "@poetry/i18n";
import { rateLimiter } from "../../lib/address";
import { getCart, getShopSettings, initiatePayment } from "../../lib/cms";
import {
  decodeCheckout,
  parseCheckout,
  type CheckoutAccess,
} from "../../lib/checkout";
import {
  cartCookie,
  cartCountCookie,
  checkoutCookie,
  checkoutKey,
  cookieOptions,
  decodeCart,
  isLineAvailable,
  shippingRate,
} from "../../lib/shop";
import * as m from "../../paraglide/messages.js";

// Each start creates a Stripe customer, a PaymentIntent and a transaction; a buyer needs a few.
const allowed = rateLimiter(10, 60 * 1000);

export type CheckoutRefusal =
  | "invalid"
  | "cart_changed"
  | "in_progress"
  | "completed"
  | "failed";

/**
 * Starts the payment for the checkout form and the wallet buttons: the browser sends the
 * contact and the checkout key it showed; this route checks both and asks the CMS for a
 * PaymentIntent.
 */
export const POST: APIRoute = async ({
  cookies,
  request,
  url,
  clientAddress,
}) => {
  // JSON only: a cross-site page cannot send it without a CORS preflight, which this route never allows.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response(null, { status: 415 });
  const rawLocale = url.searchParams.get("locale") ?? undefined;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const options = { locale };
  const send = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  const refuse = (
    code: CheckoutRefusal,
    text: string,
    extra: { link?: { href: string; label: string }; redirect?: string } = {},
  ) =>
    send({ error: { code, text, ...extra } }, code === "invalid" ? 422 : 409);
  if (!allowed(clientAddress))
    return send(
      { error: { code: "failed", text: m.shop_start_error({}, options) } },
      429,
    );

  const body: unknown = await request.json().catch(() => null);
  const data = new Map(
    Object.entries(body && typeof body === "object" ? body : {}),
  );
  const result = parseCheckout(data);
  if (!result.ok) return refuse("invalid", m.shop_error_summary({}, options));

  const access = decodeCart(cookies.get(cartCookie)?.value);
  const cartPath = localizedPath(locale, "shop/cart");
  const editCart = { href: cartPath, label: m.shop_edit_cart({}, options) };
  // An ordered (or vanished) cart cannot be paid again: clear the checkout and show the cart.
  const completed = () => {
    for (const name of [cartCookie, cartCountCookie, checkoutCookie])
      cookies.delete(name, { path: "/" });
    return refuse("completed", m.shop_status_completed({}, options), {
      redirect: `${cartPath}?status=completed`,
    });
  };
  try {
    const [cart, settings] = await Promise.all([
      access ? getCart(access, locale) : null,
      getShopSettings(locale),
    ]);
    if (!access || !cart) return completed();
    const items = cart.items ?? [];
    if (!items.length || !items.every(isLineAvailable))
      return refuse("failed", m.shop_out_of_stock({}, options), {
        link: editCart,
      });
    const shipping = shippingRate(settings);
    if (shipping === null || !PUBLIC_STRIPE_PUBLISHABLE_KEY)
      return refuse("failed", m.shop_payments_unavailable({}, options));
    // The buyer pays only the books, prices and shipping the page showed.
    const key = checkoutKey(items, shipping);
    if (data.get("cart") !== key)
      return refuse("cart_changed", m.shop_cart_changed({}, options));

    const saved = decodeCheckout(cookies.get(checkoutCookie)?.value);
    // A retry with the same cart and contact (a declined card) confirms the same PaymentIntent.
    if (
      saved?.cart === key &&
      saved.email === result.email &&
      JSON.stringify(saved.address) === JSON.stringify(result.address)
    )
      return send({ clientSecret: saved.clientSecret });

    const started = await initiatePayment(access, result.email, result.address);
    if ("error" in started) {
      if (started.error === "OutOfStock")
        return refuse("failed", m.shop_out_of_stock({}, options), {
          link: editCart,
        });
      // The earlier payment and its code stay; the cookie is kept for the confirmation page.
      if (started.error === "in_progress")
        return refuse("in_progress", m.shop_payment_in_progress({}, options));
      if (started.error === "completed") return completed();
      return refuse("failed", m.shop_start_error({}, options));
    }
    const checkout: CheckoutAccess = {
      ...started,
      email: result.email,
      address: result.address,
      cart: key,
    };
    cookies.set(
      checkoutCookie,
      JSON.stringify(checkout),
      cookieOptions(import.meta.env.PROD, 60 * 60 * 24),
    );
    return send({ clientSecret: started.clientSecret });
  } catch (error) {
    console.error(error);
    return refuse("failed", m.shop_start_error({}, options));
  }
};
