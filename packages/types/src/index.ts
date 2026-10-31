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

export interface Event {
  id: number | string;
  title: string;
  slug: string;
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

export interface PoemTranslation {
  language: Locale | "other";
  languageLabel?: string | null;
  title: string;
  text: string;
  translator?: string | null;
}

export interface Poem {
  id: number | string;
  slug: string;
  title: string;
  originalLanguage: Locale | "other";
  originalLanguageLabel?: string | null;
  originalText: string;
  author?: Author | number | string | null;
  media?: (MediaReference | number | string)[] | null;
  translations?: PoemTranslation[] | null;
  _status?: "draft" | "published";
}

export interface Author {
  id: number | string;
  name: string;
  biography?: string | null;
  portrait?: MediaReference | number | string | null;
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
    | { relationTo: "poems"; value: Poem | number | string | null }
    | { relationTo: "authors"; value: Author | number | string | null }
    | { relationTo: "events"; value: Event | number | string | null }
    | null;
  poems?: (Poem | number | string)[] | null;
  authors?: (Author | number | string)[] | null;
  pinnedEvents?: (Event | number | string)[] | null;
  limit?: number | null;
  links?: HomepageLink[] | null;
}

export interface Homepage {
  feature?: {
    kind?: "poem" | "event" | "announcement";
    heading?: string | null;
    description?: string | null;
    poem?: Poem | number | string | null;
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
