import type { Locale } from "@poetry/i18n";

export interface MediaReference {
  id: number | string;
  alt: string;
  credit?: string | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface LocationValue {
  coordinates: [number, number];
  address?: string | null;
}

export interface Event extends LocaleSlugs {
  id: number | string;
  title: string;
  description?: string | null;
  content?: FixedPage["content"];
  image?: MediaReference | number | string | null;
  startDate: string;
  location?: LocationValue | null;
  registrationUrl?: string | null;
  _status?: "draft" | "published";
}

export interface EventsPage {
  heading?: string | null;
  introduction?: string | null;
  featuredEvent?: Event | number | string | null;
  additionalFeaturedEvents?: (Event | number | string)[] | null;
  _status?: "draft" | "published";
}

export interface LegacyPoemTranslation {
  language: Locale | "other";
  languageLabel?: string | null;
  title: string;
  text: string;
  translator?: string | null;
}

export interface LegacyPoem {
  id: number | string;
  slug: string;
  title: string;
  originalLanguage: Locale | "other";
  originalLanguageLabel?: string | null;
  originalText: string;
  author?: LegacyAuthor | number | string | null;
  media?: (MediaReference | number | string)[] | null;
  translations?: LegacyPoemTranslation[] | null;
  _status?: "draft" | "published";
}

export interface LegacyAuthor {
  id: number | string;
  name: string;
  biography?: string | null;
  portrait?: MediaReference | number | string | null;
}

/** `slugDe` serves the German site, `slugEn` every other locale (`slugField`). */
export interface LocaleSlugs {
  slugDe: string;
  slugEn: string;
}

export interface City {
  id: number;
  /** Non-localized group with one name per site locale. */
  names: Record<Locale, string>;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

export interface Author extends LocaleSlugs {
  id: number;
  name?: string | null;
  portrait?: MediaReference | number | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
  city?: City | number | null;
  biography?: string | null;
  awards: { id?: string | null; name: string; year: number }[];
  _status?: "draft" | "published";
}

export interface Poem extends LocaleSlugs {
  id: number;
  title?: string | null;
  content?: string | null;
  originalLanguage: Locale;
  translator?: string | null;
  description?: string | null;
  year?: number | null;
  snippet?: string | null;
  author: Author | number;
  _status?: "draft" | "published";
}

export interface HomepageLink {
  title?: string | null;
  description?: string | null;
  url: string;
}

export interface HomepageSection {
  id?: string;
  blockType:
    | "featured"
    | "poems"
    | "introduction"
    | "authors"
    | "events"
    | "participation"
    | "newsletter";
  enabled?: boolean | null;
  heading?: string | null;
  description?: string | null;
  image?: MediaReference | number | string | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
  selectionMode?: "auto" | "manual" | null;
  item?:
    | { relationTo: "poems"; value: LegacyPoem | number | string | null }
    | { relationTo: "authors"; value: LegacyAuthor | number | string | null }
    | { relationTo: "events"; value: Event | number | string | null }
    | null;
  poems?: (LegacyPoem | number | string)[] | null;
  authors?: (LegacyAuthor | number | string)[] | null;
  pinnedEvents?: (Event | number | string)[] | null;
  limit?: number | null;
  links?: HomepageLink[] | null;
}

export interface Homepage {
  feature?: {
    kind?: "poem" | "event" | "announcement";
    heading?: string | null;
    description?: string | null;
    poem?: LegacyPoem | number | string | null;
    event?: Event | number | string | null;
    announcement?: {
      title?: string | null;
      text?: string | null;
      image?: MediaReference | number | string | null;
      linkLabel?: string | null;
      linkUrl?: string | null;
    } | null;
  } | null;
  sections?: HomepageSection[] | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    image?: MediaReference | number | string | null;
  } | null;
  _status?: "draft" | "published";
}

export interface PayloadListResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export interface FixedPage {
  title?: string | null;
  content?:
    | import("@payloadcms/richtext-lexical/lexical").SerializedEditorState
    | null;
  description?: string | null;
  _status?: "draft" | "published";
}

export interface Article {
  id: number | string;
  title: string;
  slug: string;
  description?: string | null;
  content?: FixedPage["content"];
  image?: MediaReference | number | string | null;
  publishedAt?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    noIndex?: boolean | null;
  } | null;
  _status?: "draft" | "published";
}

export interface Product {
  id: number | string;
  title: string;
  titleLanguage?: string | null;
  slug: string;
  image?: MediaReference | number | string | null;
  description?: FixedPage["content"];
  /** Cents; the ecommerce plugin treats 0 as missing. */
  priceInEUR?: number | null;
  /** Empty means unlimited; 0 or less is sold out. */
  inventory?: number | null;
  isbn?: string | null;
  pages?: number | null;
  publisher?: string | null;
  year?: number | null;
}

export interface ShopSettings {
  /** Flat Germany shipping rate in cents. */
  shippingRate: number;
  priceNote?: string | null;
}

/** Buyer-facing order states; the website translates them. */
export type OrderLookupStatus =
  | "payment_processing"
  | "paid"
  | "shipped"
  | "cancelled"
  | "payment_failed";

/** `POST /api/orders/lookup` response. Never contains name or address. */
export interface OrderLookup {
  /** 8 Crockford base32 characters without hyphen; display as `K7QD-93FA`. */
  code: string;
  status: OrderLookupStatus;
  createdAt: string;
  /** `title` is null when the book was deleted. */
  items: { title: string | null; quantity: number }[];
  /** Cents, including shipping. */
  amount: number | null;
  currency: string | null;
}
