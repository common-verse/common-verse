import type { AstroCookies } from "astro";
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from "astro:env/server";
import type { Locale } from "@poetry/i18n";
import {
  changeCart,
  cmsUrl,
  createCart,
  getCart,
  getShopSettings,
} from "./cms";
import {
  cartCookie,
  cartCount,
  cartCountCookie,
  cartView,
  cookieOptions,
  decodeCart,
  encodeCart,
  formatNumber,
  maxCartLines,
  maxQuantity,
  parseIdentifier,
  parseQuantity,
  relationID,
} from "./shop";
import * as m from "../paraglide/messages.js";

export const cartStatuses = [
  "added",
  "updated",
  "removed",
  "limit",
  "invalid",
  "failed",
  // Not a change: checkout found an order for this cart and emptied it.
  "completed",
] as const;
export type CartStatus = (typeof cartStatuses)[number];
export const isSuccess = (status: CartStatus) =>
  status === "added" ||
  status === "updated" ||
  status === "removed" ||
  status === "completed";

export interface CartChange {
  action?: unknown;
  product?: unknown;
  item?: unknown;
  quantity?: unknown;
}
export interface ChangeResult {
  status: CartStatus;
  /** The product and quantity of a removed line, so it can be restored. */
  removed?: { product: string; quantity: number };
}

const text = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : null;

/** Applies one cart change for the cart page form and the cart API. */
export async function applyChange(
  cookies: AstroCookies,
  locale: Locale,
  change: CartChange,
): Promise<ChangeResult> {
  const quantity = parseQuantity(text(change.quantity));
  const access = decodeCart(cookies.get(cartCookie)?.value);
  if (change.action === "add") {
    const product = parseIdentifier(text(change.product));
    if (!product) return { status: "failed" };
    if (!quantity) return { status: "invalid" };
    const cart = access && (await getCart(access, locale));
    if (!access || !cart) {
      cookies.set(
        cartCookie,
        encodeCart(await createCart(product, quantity)),
        cookieOptions(import.meta.env.PROD),
      );
      return { status: "added" };
    }
    const line = cart.items?.find(
      (item) => relationID(item.product) === product,
    );
    if (line) {
      if (line.quantity + quantity > maxQuantity) return { status: "invalid" };
      return {
        status: (await changeCart(access, {
          action: "update-item",
          itemID: line.id,
          quantity: line.quantity + quantity,
        }))
          ? "added"
          : "failed",
      };
    }
    if ((cart.items?.length ?? 0) >= maxCartLines) return { status: "limit" };
    return {
      status: (await changeCart(access, {
        action: "add-item",
        product,
        quantity,
      }))
        ? "added"
        : "failed",
    };
  }
  const itemID = parseIdentifier(text(change.item));
  if (!access || !itemID) return { status: "failed" };
  if (change.action === "update") {
    if (!quantity) return { status: "invalid" };
    return {
      status: (await changeCart(access, {
        action: "update-item",
        itemID,
        quantity,
      }))
        ? "updated"
        : "failed",
    };
  }
  if (change.action === "remove") {
    const line = (await getCart(access, locale))?.items?.find(
      (item) => item.id === itemID,
    );
    const product = relationID(line?.product);
    if (!line || !(await changeCart(access, { action: "remove-item", itemID })))
      return { status: "failed" };
    return {
      status: "removed",
      removed: product ? { product, quantity: line.quantity } : undefined,
    };
  }
  return { status: "failed" };
}

export function statusMessage(status: CartStatus, locale: Locale) {
  const max = formatNumber(maxQuantity, locale);
  return {
    added: m.shop_status_added({}, { locale }),
    updated: m.shop_status_updated({}, { locale }),
    removed: m.shop_status_removed({}, { locale }),
    limit: m.shop_status_limit(
      { count: formatNumber(maxCartLines, locale) },
      { locale },
    ),
    invalid: m.shop_status_invalid(
      { min: formatNumber(1, locale), max },
      { locale },
    ),
    failed: m.shop_status_failed({}, { locale }),
    completed: m.shop_status_completed({}, { locale }),
  }[status];
}

/** Reads the cart for display and keeps the count cookie in step with it. */
export async function loadCart(cookies: AstroCookies, locale: Locale) {
  const access = decodeCart(cookies.get(cartCookie)?.value);
  const [cart, settings] = await Promise.all([
    access ? getCart(access, locale) : null,
    getShopSettings(locale),
  ]);
  if (cookies.has(cartCookie) && !cart)
    cookies.delete(cartCookie, { path: "/" });
  const items = cart?.items ?? [];
  const count = cartCount(items);
  if (count)
    cookies.set(
      cartCountCookie,
      String(count),
      cookieOptions(import.meta.env.PROD),
    );
  else if (cookies.has(cartCountCookie))
    cookies.delete(cartCountCookie, { path: "/" });
  return {
    items,
    settings,
    view: cartView(
      items,
      settings,
      Boolean(PUBLIC_STRIPE_PUBLISHABLE_KEY),
      cmsUrl,
    ),
  };
}
