import { plainTextToRichText } from "../../apps/cms/src/utilities/plainTextToRichText.ts";
import http from "node:http";
import { homepageContent } from "../../apps/cms/scripts/seed/homepage-content.ts";

const events = {
  de: [
    "Poesie über Grenzen",
    "Ein offener Workshop über Sprache, Erinnerung und Begegnung.",
  ],
  en: [
    "Poetry Across Borders",
    "An open workshop about language, memory, and connection.",
  ],
  ar: ["الشعر عبر الحدود", "ورشة مفتوحة حول اللغة والذاكرة والتواصل."],
  fa: ["شعر فراتر از مرزها", "کارگاهی آزاد دربارهٔ زبان، خاطره و پیوند."],
  uk: [
    "Поезія без кордонів",
    "Відкрита майстерня про мову, пам’ять і зв’язок.",
  ],
  ku: [
    "Helbest li Ser Sînoran",
    "Atolyeyeke vekirî li ser ziman, bîranîn û têkilî.",
  ],
};

const media = {
  id: 1,
  alt: "Layered colourful paper shapes",
  url: "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 2 1%22%3E%3Crect width=%222%22 height=%221%22 fill=%22%237f2f3b%22/%3E%3C/svg%3E",
  width: 1200,
  height: 600,
};

function event(locale, preview) {
  const [title, description] = events[locale] ?? events.de;
  return {
    id: 1,
    title: preview ? `${title} — draft` : title,
    slug: "test",
    description,
    content: plainTextToRichText(description),
    image: media,
    startDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    location: {
      coordinates: [13.405, 52.52],
      address: "The Poetry Project, Berlin",
    },
    registrationUrl: "https://example.org/register",
    _status: preview ? "draft" : "published",
  };
}

function extraFeaturedEvents(locale) {
  return Array.from({ length: 4 }, (_, index) => ({
    ...event(locale, false),
    id: 30 + index,
    slug: `featured-${index + 1}`,
    title: locale === "fa" ? null : `Featured ${index + 1} ${locale}`,
    startDate: new Date(Date.now() + index * 3 * 86_400_000).toISOString(),
  }));
}

const poem = {
  id: 2,
  slug: "test-poem",
  title: "صبح مشترک",
  originalLanguage: "fa",
  originalText: "صبح از میان پنجره‌های ما می‌گذرد",
  author: { id: 3, name: "Prototype Collective" },
  translations: [
    {
      language: "de",
      title: "Gemeinsamer Morgen",
      text: "Der Morgen zieht durch unsere Fenster",
      translator: "Prototype translation",
    },
    {
      language: "en",
      title: "A Shared Morning",
      text: "Morning passes through our windows",
      translator: "Prototype translation",
    },
  ],
  _status: "published",
};

const authors = [poem.author, { id: 4, name: "Workshop Collective" }];
const recentPoems = Array.from({ length: 5 }, (_, index) => ({
  ...poem,
  id: 20 + index,
  slug: `recent-${index}`,
  title: `Recent poem ${index}`,
  originalLanguage: "en",
  originalText: `Recent verse ${index}`,
  translations: [],
}));

function homepage(locale, preview) {
  const content = structuredClone(
    homepageContent[locale] ?? homepageContent.de,
  );
  const feature =
    locale === "de"
      ? { kind: "event", event: event(locale, false) }
      : locale === "fa"
        ? {
            kind: "announcement",
            announcement: {
              title: "خبر تازه",
              text: "با هم می‌نویسیم",
              linkLabel: "بیشتر بخوانید",
              linkUrl: "/events",
            },
          }
        : { kind: "poem", poem };
  Object.assign(feature, content.feature, { kind: feature.kind });
  const sections = content.sections.map((section) => ({
    ...section,
    ...(section.blockType === "authors" ? { authors: authors } : {}),
  }));
  sections.push(
    {
      blockType: "featured",
      enabled: true,
      heading: "Featured poet",
      description: "A voice from our project",
      item: {
        relationTo: "authors",
        value: {
          ...authors[0],
          biography: "The biography comes from the poet profile.",
          portrait: media,
        },
      },
    },
    {
      blockType: "featured",
      enabled: true,
      heading: "Featured programme",
      item: { relationTo: "events", value: event(locale, false) },
    },
    {
      blockType: "featured",
      enabled: true,
      heading: "Featured poetry",
      item: { relationTo: "poems", value: { ...poem, media: [media] } },
    },
    {
      blockType: "poems",
      enabled: true,
      heading: "Selected poems",
      selectionMode: "manual",
      poems: [recentPoems[4], recentPoems[1]],
    },
    {
      blockType: "poems",
      enabled: true,
      heading: "Empty selection",
      selectionMode: "manual",
      poems: [],
    },
  );
  sections.push({
    blockType: "newsletter",
    enabled: false,
    heading: "Hidden section",
  });
  if (["ar", "ku"].includes(locale)) {
    feature.heading = null;
    feature.description = null;
    sections.find(
      (section) => section.blockType === "introduction",
    ).description = null;
    const participation = sections.find(
      (section) => section.blockType === "participation",
    );
    participation.links = [];
    sections.find((section) => section.blockType === "newsletter").heading =
      null;
  }
  if (preview) {
    feature.heading = "Draft homepage";
    sections.splice(0, 2, sections[1], sections[0]);
  }
  return { feature, sections, _status: preview ? "draft" : "published" };
}

const previewTitles = new Map();
const reversedHomepageLocales = new Set();

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3001");
  response.setHeader("content-type", "application/json; charset=utf-8");
  if (url.pathname === "/api/media/file/inline.svg") {
    response.setHeader("content-type", "image/svg+xml");
    return response.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#26465a"/></svg>',
    );
  }
  if (url.pathname === "/health")
    return response.end(JSON.stringify({ ok: true }));

  if (url.pathname === "/preview-update" && request.method === "POST") {
    if (url.searchParams.get("document") === "homepage") {
      reversedHomepageLocales.add(url.searchParams.get("locale"));
    } else {
      previewTitles.set(
        url.searchParams.get("locale"),
        "Updated workshop draft",
      );
    }
    return response.end(JSON.stringify({ ok: true }));
  }

  if (url.pathname === "/preview-host") {
    const previewURL = new URL(
      `${url.searchParams.get("path") ?? "/en"}?previewSecret=test-preview`,
      process.env.MOCK_WEB_ORIGIN ?? "http://127.0.0.1:4321",
    );
    response.setHeader("content-type", "text/html; charset=utf-8");
    return response.end(
      `<script>window.addEventListener('message', (event) => { if (event.data?.ready) document.body.dataset.ready = 'true' })</script><iframe title="Content preview" src="${previewURL.href}"></iframe>`,
    );
  }

  const isPreview = url.pathname.endsWith("/preview");
  if (isPreview && request.headers["x-preview-secret"] !== "test-preview") {
    response.statusCode = 401;
    return response.end(JSON.stringify({ error: "Unauthorized" }));
  }

  const locale = url.searchParams.get("locale") ?? "de";
  const fixedPage = url.pathname.match(
    /^\/api\/globals\/(about|contact|privacy|legal)\/(public|preview)$/,
  )?.[1];
  if (fixedPage) {
    if (fixedPage === "privacy" && locale === "fa" && !isPreview)
      return response.end("null");
    const content = plainTextToRichText(
      `Fixture content for ${fixedPage} in ${locale}.\n\nSecond paragraph.`,
    );
    content.root.children[0].children[0].format = 1;
    content.root.children.push({
      ...plainTextToRichText("More information").root.children[0],
      type: "heading",
      tag: "h2",
    });
    return response.end(
      JSON.stringify({
        title: `${fixedPage} ${locale}${isPreview ? " — draft" : ""}`,
        content,
        description: `Fixture description for ${fixedPage} in ${locale}.`,
        _status: isPreview ? "draft" : "published",
      }),
    );
  }
  if (url.pathname.startsWith("/api/globals/events-page/")) {
    return response.end(
      JSON.stringify({
        heading:
          locale === "fa"
            ? null
            : `Events programme ${locale}${isPreview ? " — draft" : ""}`,
        introduction:
          locale === "fa"
            ? null
            : `Editorial introduction ${locale}${isPreview ? " — draft" : ""}`,
        additionalFeaturedEvents: extraFeaturedEvents(locale),
        featuredEvent: {
          ...event(locale, false),
          id: 20,
          slug: "reading",
          title: locale === "fa" ? null : `Reading ${locale}`,
        },
        _status: isPreview ? "draft" : "published",
      }),
    );
  }
  if (url.pathname.startsWith("/api/globals/homepage/")) {
    const document = homepage(locale, isPreview);
    if (isPreview && reversedHomepageLocales.has(locale))
      document.sections.reverse();
    return response.end(JSON.stringify(document));
  }
  if (url.pathname === "/api/authors") {
    return response.end(
      JSON.stringify({ docs: authors, totalDocs: authors.length }),
    );
  }
  if (url.pathname.startsWith("/api/authors/")) {
    const author = authors.find(
      (entry) => String(entry.id) === url.pathname.split("/").at(-1),
    );
    if (author) return response.end(JSON.stringify(author));
    response.statusCode = 404;
    return response.end(JSON.stringify({ error: "Not found" }));
  }
  if (url.pathname.startsWith("/api/articles")) {
    const slug = isPreview
      ? url.searchParams.get("slug")
      : url.searchParams.get("where[slug][equals]");
    if (slug === "missing" || locale === "fa")
      return response.end(JSON.stringify({ docs: [], totalDocs: 0 }));
    return response.end(
      JSON.stringify({
        docs: [
          {
            id: 1,
            slug: "project-news",
            title: `Article ${locale}${isPreview ? " — draft" : ""}`,
            description: `Article summary ${locale}`,
            content: plainTextToRichText(`Article content ${locale}`),
            publishedAt: "2026-10-10T12:00:00Z",
            _status: isPreview ? "draft" : "published",
          },
        ],
        totalDocs: 1,
      }),
    );
  }
  if (url.pathname.startsWith("/api/events")) {
    const requestedSlug = isPreview
      ? url.searchParams.get("slug")
      : url.searchParams.get("where[slug][equals]");
    const document = event(locale, isPreview);
    if (
      isPreview &&
      requestedSlug === "live-preview" &&
      previewTitles.has(locale)
    ) {
      document.title = previewTitles.get(locale);
    }
    if (!requestedSlug && url.searchParams.get("limit") === "100") {
      const reading = {
        ...document,
        id: 20,
        slug: "reading",
        title: locale === "fa" ? null : `Reading ${locale}`,
      };
      return response.end(
        JSON.stringify({
          docs: [
            document,
            reading,
            ...extraFeaturedEvents(locale),
            {
              ...document,
              id: 22,
              slug: "next-workshop",
              title: locale === "fa" ? null : `Workshop ${locale}`,
              startDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
              image: {
                ...media,
                url: "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 2 1%22%3E%3Crect width=%222%22 height=%221%22 fill=%22white%22/%3E%3C/svg%3E",
              },
            },
            {
              ...document,
              id: 21,
              slug: "past",
              title: `Past event ${locale}`,
              startDate: new Date(Date.now() - 7 * 86_400_000).toISOString(),
            },
          ],
          totalDocs: 8,
          hasNextPage: false,
        }),
      );
    }
    if (requestedSlug === "reading") {
      document.id = 20;
      document.image = { ...media, credit: "Event photographer" };
      document.content.root.children[0].children[0].format = 1;
      document.content.root.children.push({
        type: "upload",
        version: 3,
        relationTo: "media",
        fields: null,
        value: {
          ...media,
          url: "/api/media/file/inline.svg",
          mimeType: "image/svg+xml",
          credit: "The Poetry Project",
        },
      });
      document.title = `Reading ${locale}`;
      document.slug = "reading";
    }
    if (requestedSlug === "bare-registration")
      document.registrationUrl = " google.de ";
    if (requestedSlug === "unsafe-registration")
      document.registrationUrl = "javascript:alert(1)";
    if (requestedSlug === "partial" && locale === "fa") document.title = null;
    return response.end(JSON.stringify({ docs: [document], totalDocs: 1 }));
  }
  if (url.pathname.startsWith("/api/poems")) {
    if (url.searchParams.get("sort") === "-createdAt")
      return response.end(
        JSON.stringify({ docs: recentPoems, totalDocs: recentPoems.length }),
      );
    const author = url.searchParams.get("where[author][equals]");
    if (author === "4") {
      if (url.searchParams.get("page") === "2") {
        return response.end(
          JSON.stringify({
            docs: [
              {
                ...poem,
                id: 6,
                slug: "next-page-poem",
                title: "A poem on the next page",
                author: authors[1],
              },
            ],
            totalDocs: 2,
            hasNextPage: false,
          }),
        );
      }
      return response.end(
        JSON.stringify({
          docs: [
            {
              ...poem,
              id: 5,
              slug: "later-poem",
              title: "A later poem",
              originalLanguage: "en",
              originalText: "A voice beyond the first archive page",
              author: authors[1],
              translations: [],
            },
          ],
          totalDocs: 1,
          hasNextPage: url.searchParams.get("limit") !== "1",
        }),
      );
    }
    return response.end(JSON.stringify({ docs: [poem], totalDocs: 1 }));
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(Number(process.env.MOCK_CMS_PORT ?? 3001), "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
