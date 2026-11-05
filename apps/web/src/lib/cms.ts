import { berlinDayStart } from "./event-date";
import { displayName, hasVersion, type AuthorName } from "./poems";
import {
  locales,
  slugLocale,
  type Locale,
  type FixedPageKey,
} from "@poetry/i18n";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import type {
  LegacyAuthor,
  FixedPage,
  Homepage,
  PayloadListResponse,
  LegacyPoem,
  Article,
  Event,
  EventsPage,
  LocalizedSlug,
  Author,
  Poem,
  OrderLookup,
  Product,
  ShopSettings,
} from "@poetry/types";
import type { CartAccess, CartLine } from "./shop";
import type { CheckoutAccess, ShippingAddress } from "./checkout";

export const cmsUrl = import.meta.env.PUBLIC_CMS_URL ?? "http://localhost:3001";

type Collection = "events" | "poems" | "authors" | "articles" | "products";

async function fetchCollection<T>(
  collection: Collection,
  locale: Locale,
): Promise<T[]> {
  const url = new URL(`/api/${collection}`, cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  url.searchParams.set("depth", "2");
  url.searchParams.set("limit", "100");
  url.searchParams.set(
    "sort",
    collection === "articles"
      ? "-publishedAt,-createdAt"
      : collection === "events"
        ? "startDate"
        : collection === "authors"
          ? "-createdAt"
          : "title",
  );
  const documents: T[] = [];
  let page = 1;
  let hasNextPage: boolean;
  do {
    url.searchParams.set("page", String(page));
    const response = await fetch(url.href);
    if (!response.ok)
      throw new Error(`Payload request failed with ${response.status}`);
    const data = (await response.json()) as PayloadListResponse<T>;
    documents.push(...data.docs);
    hasNextPage = collection === "events" && data.hasNextPage;
    page += 1;
  } while (hasNextPage);
  return documents;
}

async function fetchDocument<T>(
  collection: Collection,
  slug: string,
  locale: Locale,
  previewSecret?: string,
  field: "slug" | "slug.de" | "slug.en" | "id" = "slug",
): Promise<T | null> {
  const preview = Boolean(previewSecret);
  const path = preview ? `/api/${collection}/preview` : `/api/${collection}`;
  const url = new URL(path, cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  url.searchParams.set("depth", "2");
  if (preview) url.searchParams.set("slug", slug);
  else url.searchParams.set(`where[${field}][equals]`, slug);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: previewSecret ? { "x-preview-secret": previewSecret } : {},
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Payload request failed with ${response.status}`);
  }
  const data = (await response.json()) as PayloadListResponse<T>;
  return data.docs[0] ?? null;
}

export const getEvent = (
  slug: string,
  locale: Locale,
  previewSecret?: string,
) =>
  fetchDocument<Event>(
    "events",
    slug,
    locale,
    previewSecret,
    `slug.${slugLocale(locale)}`,
  );

export const getPoem = (slug: string, locale: Locale, previewSecret?: string) =>
  fetchDocument<LegacyPoem>("poems", slug, locale, previewSecret);

export const getEvents = (locale: Locale) =>
  fetchCollection<Event>("events", locale);

export const getPoems = (locale: Locale) =>
  fetchCollection<LegacyPoem>("poems", locale);

export const getAuthors = (locale: Locale) =>
  fetchCollection<LegacyAuthor>("authors", locale);

/** Query a poet directly so their work is not lost beyond the archive's first page. */
export async function getAuthorPoems(
  id: string,
  locale: Locale,
  limit?: number,
): Promise<LegacyPoem[]> {
  const poems: LegacyPoem[] = [];
  let page = 1;
  let hasNextPage = false;
  do {
    const url = new URL("/api/poems", cmsUrl);
    url.searchParams.set("locale", locale);
    url.searchParams.set("fallback-locale", "none");
    url.searchParams.set("depth", "2");
    url.searchParams.set("where[author][equals]", id);
    url.searchParams.set("where[_status][equals]", "published");
    url.searchParams.set("sort", "title");
    url.searchParams.set("limit", String(limit ?? 100));
    url.searchParams.set("page", String(page));
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Poet poems request failed with ${response.status}`);
    const data = (await response.json()) as PayloadListResponse<LegacyPoem>;
    poems.push(...data.docs);
    hasNextPage = !limit && data.hasNextPage;
    page += 1;
  } while (hasNextPage);
  return poems;
}

/** All published records matching the `where[…]` query, across every page. */
async function fetchPublished<T>(
  collection: "poems" | "authors",
  locale: Locale,
  query: Record<string, string> = {},
  depth = 1,
): Promise<T[]> {
  const url = new URL(`/api/${collection}`, cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  url.searchParams.set("depth", String(depth));
  url.searchParams.set("limit", "100");
  url.searchParams.set("sort", collection === "poems" ? "-year" : "name");
  url.searchParams.set("where[_status][equals]", "published");
  for (const [field, value] of Object.entries(query))
    url.searchParams.set(field, value);
  const documents: T[] = [];
  let page = 1;
  let hasNextPage: boolean;
  do {
    url.searchParams.set("page", String(page));
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Payload request failed with ${response.status}`);
    const data = (await response.json()) as PayloadListResponse<T>;
    documents.push(...data.docs);
    hasNextPage = data.hasNextPage;
    page += 1;
  } while (hasNextPage);
  return documents;
}

/** Published poems in `locale`, optionally of one author; sort them with `byYear`. */
export const getPublishedPoems = (locale: Locale, author?: number) =>
  fetchPublished<Poem>(
    "poems",
    locale,
    author ? { "where[author][equals]": String(author) } : {},
  );

export const getPublishedAuthors = (locale: Locale) =>
  fetchPublished<Author>("authors", locale);

/**
 * Pairs each poem with its version in `locale`, else its original; poems with
 * neither are left out. Never another language (no editorial fallback).
 */
export async function poemVersions(
  poems: Poem[],
  locale: Locale,
): Promise<{ poem: Poem; language: Locale }[]> {
  const missing = poems.filter(
    (poem) => !hasVersion(poem) && poem.originalLanguage !== locale,
  );
  const languages = [...new Set(missing.map((poem) => poem.originalLanguage))];
  const originals = new Map(
    (
      await Promise.all(
        languages.map((language) =>
          fetchPublished<Poem>(
            "poems",
            language,
            {
              "where[id][in]": missing
                .filter((poem) => poem.originalLanguage === language)
                .map((poem) => poem.id)
                .join(","),
            },
            0,
          ),
        ),
      )
    )
      .flat()
      .map((poem) => [poem.id, poem]),
  );
  return poems.flatMap((poem) => {
    if (hasVersion(poem)) return [{ poem, language: locale }];
    const original = originals.get(poem.id);
    return original
      ? [
          {
            poem: { ...original, author: poem.author },
            language: poem.originalLanguage,
          },
        ]
      : [];
  });
}

/** Display names by author ID: the name in `locale`, else the German name. */
export async function authorNames(
  authors: Author[],
  locale: Locale,
): Promise<Map<number, AuthorName>> {
  const missing = authors.filter((author) => !author.name?.trim());
  const german =
    locale !== "de" && missing.length
      ? await fetchPublished<Author>(
          "authors",
          "de",
          { "where[id][in]": missing.map((author) => author.id).join(",") },
          0,
        )
      : [];
  return new Map(
    authors.map((author) => [
      author.id,
      displayName(
        author.name,
        german.find((entry) => entry.id === author.id)?.name,
        locale,
      ),
    ]),
  );
}

export async function getUpcomingEvents(locale: Locale): Promise<Event[]> {
  const url = new URL("/api/events", cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  url.searchParams.set("depth", "2");
  url.searchParams.set("sort", "startDate");
  url.searchParams.set("limit", "4");
  url.searchParams.set("where[title][exists]", "true");
  url.searchParams.set("where[title][not_equals]", "");
  const now = berlinDayStart();
  url.searchParams.set("where[startDate][greater_than_equal]", now);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Programme request failed with ${response.status}`);
  const data = (await response.json()) as PayloadListResponse<Event>;
  return data.docs;
}

export async function getAuthor(
  id: string,
  locale: Locale,
): Promise<LegacyAuthor | null> {
  const url = new URL(`/api/authors/${encodeURIComponent(id)}`, cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Payload request failed with ${response.status}`);
  return response.json();
}

export async function getHomepage(
  locale: Locale,
  previewSecret?: string,
): Promise<Homepage | null> {
  const url = new URL(
    `/api/globals/homepage/${previewSecret ? "preview" : "public"}`,
    cmsUrl,
  );
  url.searchParams.set("locale", locale);
  const response = await fetch(url, {
    headers: previewSecret ? { "x-preview-secret": previewSecret } : {},
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Homepage request failed with ${response.status}`);
  return response.json();
}

export async function getEventsPage(
  locale: Locale,
  previewSecret?: string,
): Promise<EventsPage | null> {
  const url = new URL(
    `/api/globals/events-page/${previewSecret ? "preview" : "public"}`,
    cmsUrl,
  );
  url.searchParams.set("locale", locale);
  const response = await fetch(url, {
    headers: previewSecret ? { "x-preview-secret": previewSecret } : {},
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Events page request failed with ${response.status}`);
  return response.json();
}

export async function getEventLocales(
  slug: LocalizedSlug,
  previewSecret?: string,
): Promise<Locale[]> {
  const localized = await Promise.all(
    locales.map(async (locale) => ({
      locale,
      event: await getEvent(slug[slugLocale(locale)], locale, previewSecret),
    })),
  );
  return localized
    .filter(({ event }) => Boolean(event?.title))
    .map(({ locale }) => locale);
}

export async function getRecentPoems(locale: Locale): Promise<LegacyPoem[]> {
  const url = new URL("/api/poems", cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  url.searchParams.set("depth", "2");
  url.searchParams.set("where[_status][equals]", "published");
  url.searchParams.set("sort", "-createdAt");
  url.searchParams.set("limit", "4");
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Recent poems request failed with ${response.status}`);
  const data = (await response.json()) as PayloadListResponse<LegacyPoem>;
  return data.docs;
}

/** Walk newest profiles until four have published work, including beyond the first page. */
export async function getActiveAuthors(
  locale: Locale,
): Promise<{ authors: LegacyAuthor[]; poems: LegacyPoem[] }> {
  const authors: LegacyAuthor[] = [];
  const poems: LegacyPoem[] = [];
  let page = 1;
  let hasNextPage: boolean;
  do {
    const url = new URL("/api/authors", cmsUrl);
    url.searchParams.set("locale", locale);
    url.searchParams.set("fallback-locale", "none");
    url.searchParams.set("depth", "1");
    url.searchParams.set("sort", "-createdAt");
    url.searchParams.set("limit", "4");
    url.searchParams.set("page", String(page));
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Active authors request failed with ${response.status}`);
    const data = (await response.json()) as PayloadListResponse<LegacyAuthor>;
    const samples = await Promise.all(
      data.docs.map((author) => getAuthorPoems(String(author.id), locale, 1)),
    );
    data.docs.forEach((author, index) => {
      if (samples[index]?.length && authors.length < 4) {
        authors.push(author);
        poems.push(...samples[index]);
      }
    });
    hasNextPage = data.hasNextPage;
    page += 1;
  } while (hasNextPage && authors.length < 4);
  return { authors, poems };
}

export async function getFixedPage(
  page: FixedPageKey,
  locale: Locale,
  previewSecret?: string,
): Promise<(FixedPage & { contentLocale: Locale }) | null> {
  const url = new URL(
    `/api/globals/${page}/${previewSecret ? "preview" : "public"}`,
    cmsUrl,
  );
  url.searchParams.set("locale", locale);
  const response = await fetch(url, {
    headers: previewSecret ? { "x-preview-secret": previewSecret } : {},
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404)
    throw new Error(`Page request failed with ${response.status}`);
  const document: FixedPage | null =
    response.status === 404 ? null : await response.json();
  if (
    document?.title?.trim() &&
    document.content &&
    convertLexicalToPlaintext({ data: document.content }).trim()
  )
    return { ...document, contentLocale: locale };
  return locale === "en" ? null : getFixedPage(page, "en", previewSecret);
}

function completeArticle(article: Article | null): article is Article {
  return Boolean(
    article?.title?.trim() &&
      article.content &&
      convertLexicalToPlaintext({ data: article.content }).trim(),
  );
}

export const getArticles = async (locale: Locale) =>
  (await fetchCollection<Article>("articles", locale)).filter(completeArticle);
export const getArticle = async (
  slug: string,
  locale: Locale,
  previewSecret?: string,
) => {
  const article = await fetchDocument<Article>(
    "articles",
    slug,
    locale,
    previewSecret,
  );
  return completeArticle(article) ? article : null;
};

export const getProducts = (locale: Locale) =>
  fetchCollection<Product>("products", locale);

export const getProduct = (slug: string, locale: Locale) =>
  fetchDocument<Product>("products", slug, locale);

/** For the no-JavaScript undo row, which knows only the removed product's ID. */
export const getProductByID = (id: string, locale: Locale) =>
  fetchDocument<Product>("products", id, locale, undefined, "id");

export async function getShopSettings(
  locale: Locale,
): Promise<Partial<ShopSettings>> {
  const url = new URL("/api/globals/shop-settings", cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok)
    throw new Error(`Shop settings request failed with ${response.status}`);
  return response.json();
}

export interface CartItem extends CartLine {
  id: string;
}

export interface Cart {
  id: number | string;
  items?: CartItem[] | null;
  purchasedAt?: string | null;
}

// Shop requests never forward visitor cookies: a CMS session would turn an editor into the customer.
const postJSON = (path: string, body: unknown) =>
  fetch(new URL(path, cmsUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

const missingCart = (status: number) => [401, 403, 404].includes(status);

/** Returns null for a missing, foreign or already purchased cart. */
export async function getCart(
  access: CartAccess,
  locale: Locale,
): Promise<Cart | null> {
  const url = new URL(`/api/carts/${encodeURIComponent(access.id)}`, cmsUrl);
  url.searchParams.set("secret", access.secret);
  url.searchParams.set("depth", "2");
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  const response = await fetch(url, { cache: "no-store" });
  if (missingCart(response.status)) return null;
  if (!response.ok)
    throw new Error(`Cart request failed with ${response.status}`);
  const cart = (await response.json()) as Cart;
  return cart.purchasedAt ? null : cart;
}

// Payload's PostgreSQL relationships reject numeric IDs sent as strings.
const relationValue = (id: string) => (/^\d+$/.test(id) ? Number(id) : id);

export async function createCart(
  product: string,
  quantity: number,
): Promise<CartAccess> {
  const response = await postJSON("/api/carts", {
    items: [{ product: relationValue(product), quantity }],
    currency: "EUR",
  });
  if (!response.ok)
    throw new Error(`Cart creation failed with ${response.status}`);
  const { doc } = (await response.json()) as {
    doc: { id: number | string; secret: string };
  };
  return { id: String(doc.id), secret: doc.secret };
}

/** Returns false when the cart or line no longer exists. */
export async function changeCart(
  access: CartAccess,
  change:
    | { action: "add-item"; product: string; quantity: number }
    | { action: "update-item"; itemID: string; quantity: number }
    | { action: "remove-item"; itemID: string },
): Promise<boolean> {
  const { action, ...data } = change;
  const body =
    "product" in data
      ? {
          item: { product: relationValue(data.product) },
          quantity: data.quantity,
        }
      : data;
  const response = await postJSON(
    `/api/carts/${encodeURIComponent(access.id)}/${action}`,
    { ...body, secret: access.secret },
  );
  if (response.status === 404) return false;
  if (!response.ok)
    throw new Error(`Cart update failed with ${response.status}`);
  return true;
}

export type PaymentStart =
  | { clientSecret: string; paymentIntentID: string; orderCode?: string }
  | {
      /** in_progress: an earlier payment of this cart is processing, paid, mid-redirect or starting. */
      error: "OutOfStock" | "in_progress" | "completed" | "failed";
    };

export async function initiatePayment(
  access: CartAccess,
  email: string,
  shippingAddress: ShippingAddress,
): Promise<PaymentStart> {
  const response = await postJSON("/api/payments/stripe/initiate", {
    cartID: access.id,
    secret: access.secret,
    customerEmail: email,
    shippingAddress,
  });
  const data = await response.json().catch(() => null);
  if (response.ok && data?.clientSecret && data?.paymentIntentID)
    return {
      clientSecret: data.clientSecret,
      paymentIntentID: data.paymentIntentID,
      ...(typeof data.orderCode === "string"
        ? { orderCode: data.orderCode }
        : {}),
    };
  if (response.status === 409 && data?.error === "payment_in_progress")
    return { error: "in_progress" };
  if (response.status === 409 && data?.error === "cart_completed")
    return { error: "completed" };
  return {
    error: data?.cause?.code === "OutOfStock" ? "OutOfStock" : "failed",
  };
}

/** Returns the order's code, or null while the payment cannot be settled yet. */
export async function confirmOrder(
  access: CartAccess,
  checkout: Pick<CheckoutAccess, "email" | "paymentIntentID" | "orderCode">,
): Promise<string | null> {
  const response = await postJSON("/api/payments/stripe/confirm-order", {
    cartID: access.id,
    secret: access.secret,
    customerEmail: checkout.email,
    paymentIntentID: checkout.paymentIntentID,
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { orderCode?: string };
  // Orders from before codes existed have none; the code from payment start is the same.
  return typeof data.orderCode === "string"
    ? data.orderCode
    : (checkout.orderCode ?? null);
}

/** A buyer's order by code and email; null when nothing matches. Throws when the CMS fails. */
export async function lookupOrder(
  code: string,
  email: string,
  secret: string,
): Promise<OrderLookup | null> {
  const response = await fetch(new URL("/api/orders/lookup", cmsUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-order-lookup-secret": secret,
    },
    body: JSON.stringify({ code, email }),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Order lookup failed with ${response.status}`);
  return response.json();
}
