import { berlinDayStart } from "./event-date";
import { locales, type Locale, type FixedPageKey } from "@poetry/i18n";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import type {
  Author,
  FixedPage,
  Homepage,
  PayloadListResponse,
  Poem,
  Article,
  Event,
  EventsPage,
} from "@poetry/types";

const cmsUrl = import.meta.env.PUBLIC_CMS_URL ?? "http://localhost:3001";

type Collection = "events" | "poems" | "authors" | "articles";

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
): Promise<T | null> {
  const preview = Boolean(previewSecret);
  const path = preview ? `/api/${collection}/preview` : `/api/${collection}`;
  const url = new URL(path, cmsUrl);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fallback-locale", "none");
  url.searchParams.set("depth", "2");
  if (preview) url.searchParams.set("slug", slug);
  else url.searchParams.set("where[slug][equals]", slug);
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
) => fetchDocument<Event>("events", slug, locale, previewSecret);

export const getPoem = (slug: string, locale: Locale, previewSecret?: string) =>
  fetchDocument<Poem>("poems", slug, locale, previewSecret);

export const getEvents = (locale: Locale) =>
  fetchCollection<Event>("events", locale);

export const getPoems = (locale: Locale) =>
  fetchCollection<Poem>("poems", locale);

export const getAuthors = (locale: Locale) =>
  fetchCollection<Author>("authors", locale);

/** Query a poet directly so their work is not lost beyond the archive's first page. */
export async function getAuthorPoems(
  id: string,
  locale: Locale,
  limit?: number,
): Promise<Poem[]> {
  const poems: Poem[] = [];
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
    const data = (await response.json()) as PayloadListResponse<Poem>;
    poems.push(...data.docs);
    hasNextPage = !limit && data.hasNextPage;
    page += 1;
  } while (hasNextPage);
  return poems;
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
): Promise<Author | null> {
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
  slug: string,
  previewSecret?: string,
): Promise<Locale[]> {
  const localized = await Promise.all(
    locales.map(async (locale) => ({
      locale,
      event: await getEvent(slug, locale, previewSecret),
    })),
  );
  return localized
    .filter(({ event }) => Boolean(event?.title))
    .map(({ locale }) => locale);
}

export async function getRecentPoems(locale: Locale): Promise<Poem[]> {
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
  const data = (await response.json()) as PayloadListResponse<Poem>;
  return data.docs;
}

/** Walk newest profiles until four have published work, including beyond the first page. */
export async function getActiveAuthors(
  locale: Locale,
): Promise<{ authors: Author[]; poems: Poem[] }> {
  const authors: Author[] = [];
  const poems: Poem[] = [];
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
    const data = (await response.json()) as PayloadListResponse<Author>;
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
