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

const bothSlugs = (slug) => ({ slugDe: slug, slugEn: slug });

function event(locale, preview) {
  const [title, description] = events[locale] ?? events.de;
  return {
    id: 1,
    title: preview ? `${title} — draft` : title,
    ...bothSlugs("test"),
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
    ...bothSlugs(`featured-${index + 1}`),
    title: locale === "fa" ? null : `Featured ${index + 1} ${locale}`,
    startDate: new Date(Date.now() + index * 3 * 86_400_000).toISOString(),
  }));
}

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
        : { kind: "poem", poem: homepagePoem(201, locale) };
  Object.assign(feature, content.feature, { kind: feature.kind });
  const sections = content.sections.map((section) => ({
    ...section,
    ...(section.blockType === "authors"
      ? { authors: [homepageAuthor(12, locale), homepageAuthor(13, locale)] }
      : {}),
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
          ...homepageAuthor(11, locale),
          biography: "The biography comes from the poet profile.",
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
      item: { relationTo: "poems", value: homepagePoem(201, locale) },
    },
    {
      blockType: "poems",
      enabled: true,
      heading: "Selected poems",
      selectionMode: "manual",
      // The draft stands in for one the public endpoint would not strip.
      poems: [202, 204, 203].map((id) => homepagePoem(id, locale)),
    },
    {
      blockType: "poems",
      enabled: true,
      heading: "Empty selection",
      selectionMode: "manual",
      poems: [],
    },
    {
      blockType: "authors",
      enabled: true,
      heading: "Newest authors",
      selectionMode: "auto",
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

const product = (id, slug, title, titleLanguage, priceInEUR, inventory) => ({
  id,
  slug,
  title,
  titleLanguage,
  priceInEUR,
  inventory,
  image: media,
  isbn: "978-3-95732-607-2",
  pages: 240,
  publisher: "Verbrecher Verlag",
  year: 2024,
});
const products = [
  product(101, "beside-me", "Sei neben mir", "de", 2000, null),
  product(102, "german-only", "Nur auf Deutsch", "de", 1500, 5),
  product(103, "sold-out", "Sold Out Anthology", "en", 0, 0),
  product(104, "passing-words", "كلمات عابرة", "ar", 1000, 3),
];
// IDs from 200 exist only for cart tests and are not listed; from 300 one copy is left.
const findProduct = (id) =>
  products.find((entry) => String(entry.id) === String(id)) ??
  (Number(id) >= 200
    ? product(
        Number(id),
        `extra-${id}`,
        `Extra ${id}`,
        "en",
        500,
        Number(id) >= 300 ? 1 : null,
      )
    : null);
// Payload omits a missing localized description.
const localizedProduct = (entry, locale) =>
  entry.id === 102 && locale !== "de"
    ? entry
    : {
        ...entry,
        description: plainTextToRichText(
          `Book description ${entry.id} ${locale}`,
        ),
      };

const carts = new Map();
const shopLog = { initiate: [], confirm: [], photon: [] };
const readJSON = (request) =>
  new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
  });
const cartResponse = (cart, depth) => ({
  id: cart.id,
  purchasedAt: cart.purchasedAt ?? null,
  // Payload stores the subtotal of the last cart write; prices may have changed since.
  subtotal: 1,
  items: cart.items.map((item) => ({
    ...item,
    product: depth ? findProduct(item.product) : item.product,
  })),
});

// Payment outcomes by buyer email (sepa@ or sepa+anything@, and so on): SEPA keeps processing,
// a declined card needs another method.
const emailIs = (email, name) =>
  new RegExp(`^${name}(\\+[\\w-]+)?@`).test(email ?? "");
const stripeStatus = (email) =>
  emailIs(email, "sepa")
    ? "processing"
    : emailIs(email, "declined")
      ? "requires_payment_method"
      : "succeeded";

const lookupSecret = process.env.MOCK_ORDER_LOOKUP_SECRET ?? "test-lookup";
const normalizeCode = (value) => {
  if (typeof value !== "string") return null;
  const code = value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code) ? code : null;
};
// One order per status for reader@example.org, plus the orders paid or processing in tests.
const lookupItems = [
  { title: "Sei neben mir", quantity: 2 },
  { title: "كلمات عابرة", quantity: 1 },
];
const fixedOrder = (code, status) => ({
  code,
  status,
  email: "reader@example.org",
  createdAt: "2026-10-30T10:00:00.000Z",
  items: lookupItems,
  amount: 5400,
  currency: "eur",
});
const lookupOrders = () => [
  fixedOrder("SEPA0001", "payment_processing"),
  fixedOrder("PA1D0002", "paid"),
  fixedOrder("SH1P0003", "shipped"),
  fixedOrder("CANC0004", "cancelled"),
  fixedOrder("FA170005", "payment_failed"),
  ...shopLog.initiate
    .filter(
      (entry) =>
        entry.confirmed ||
        stripeStatus(entry.body.customerEmail) === "processing",
    )
    .map((entry) => ({
      code: entry.orderCode,
      status: entry.confirmed ? "paid" : "payment_processing",
      email: entry.body.customerEmail,
      createdAt: new Date().toISOString(),
      items: [{ title: "Sei neben mir", quantity: 1 }],
      amount: 2400,
      currency: "eur",
    })),
];

async function handleShop(request, response, url) {
  const send = (status, body) => {
    response.statusCode = status;
    response.end(JSON.stringify(body));
  };
  const body = request.method === "POST" ? await readJSON(request) : {};
  if (url.pathname === "/api/carts" && request.method === "POST") {
    if (body.items.some((item) => typeof item.product !== "number"))
      return send(400, { errors: [] });
    const cart = {
      id: carts.size + 1,
      secret: `secret${carts.size + 1}`.padEnd(40, "0"),
      items: body.items.map((item, index) => ({ id: `line${index}`, ...item })),
    };
    carts.set(String(cart.id), cart);
    return send(201, {
      doc: { ...cartResponse(cart, 0), secret: cart.secret },
    });
  }
  const cartMatch = url.pathname.match(/^\/api\/carts\/(\w+)(?:\/([\w-]+))?$/);
  if (cartMatch) {
    const cart = carts.get(cartMatch[1]);
    const secret = body.secret ?? url.searchParams.get("secret");
    if (!cart || cart.secret !== secret)
      return send(404, { success: false, message: "Not found" });
    const action = cartMatch[2];
    if (!action)
      return send(200, cartResponse(cart, url.searchParams.get("depth")));
    const line = cart.items.find((item) => item.id === body.itemID);
    if (action === "add-item") {
      if (typeof body.item.product !== "number") return send(404, {});
      if (!findProduct(body.item.product)) return send(400, { errors: [] });
      cart.items.push({
        id: `line${cart.items.length}-${Date.now()}`,
        product: Number(body.item.product),
        quantity: body.quantity,
      });
    } else if (!line) return send(404, { success: false });
    else if (action === "update-item") line.quantity = body.quantity;
    else if (action === "remove-item")
      cart.items.splice(cart.items.indexOf(line), 1);
    return send(200, { success: true, cart: cartResponse(cart, 0) });
  }
  if (url.pathname === "/api/payments/stripe/initiate") {
    const entry = { body, cookie: request.headers.cookie ?? null };
    shopLog.initiate.push(entry);
    const cart = carts.get(String(body.cartID));
    if (!cart || cart.secret !== body.secret)
      return send(404, { message: "Cart not found" });
    if (body.customerEmail === "stock@example.org")
      return send(400, { message: {}, cause: { code: "OutOfStock" } });
    // The CMS refuses a second start while a payment of the cart runs, and a cart with an order.
    if (body.customerEmail === "busy@example.org")
      return send(409, { error: "payment_in_progress" });
    if (cart.purchasedAt || body.customerEmail === "ordered@example.org")
      return send(409, { error: "cart_completed" });
    // A single name goes in lastName; firstName may be empty.
    if (!body.shippingAddress?.lastName?.trim())
      return send(400, { message: "A last name is required." });
    const paymentIntentID = `pi_test${shopLog.initiate.length}`;
    cart.paymentIntentID = entry.paymentIntentID = paymentIntentID;
    // Crockford base32 without hyphen, as the CMS stores it.
    const orderCode = `K7QD${String(shopLog.initiate.length).padStart(4, "0")}`;
    entry.orderCode = orderCode;
    return send(200, {
      message: "Payment initiated successfully",
      clientSecret: `${paymentIntentID}_secret_test`,
      paymentIntentID,
      orderCode,
    });
  }
  if (url.pathname === "/api/payments/stripe/confirm-order") {
    shopLog.confirm.push(body);
    const cart = carts.get(String(body.cartID));
    // Stripe has not settled these payments (see stripeStatus), so the CMS refuses.
    if (
      !cart ||
      cart.secret !== body.secret ||
      cart.paymentIntentID !== body.paymentIntentID ||
      stripeStatus(body.customerEmail) !== "succeeded" ||
      emailIs(body.customerEmail, "pending")
    )
      return send(500, { message: "Error confirming order." });
    cart.purchasedAt = new Date().toISOString();
    const started = shopLog.initiate.find(
      (entry) => entry.paymentIntentID === body.paymentIntentID,
    );
    started.confirmed = true;
    return send(200, {
      message: "Payment confirmed.",
      orderID: 1001,
      transactionID: 1,
      orderCode: started.orderCode,
    });
  }
  // Stands in for Stripe's PaymentIntent retrieval with a publishable key and client secret.
  const intentMatch = url.pathname.match(
    /^\/stripe\/v1\/payment_intents\/(\w+)$/,
  );
  if (intentMatch) {
    const started = shopLog.initiate.find(
      (entry) => entry.paymentIntentID === intentMatch[1],
    );
    if (
      !started ||
      url.searchParams.get("client_secret") !==
        `${started.paymentIntentID}_secret_test` ||
      request.headers.authorization !== "Bearer pk_test_playwright" ||
      url.searchParams.get("expand[]") !== "payment_method"
    )
      return send(404, { error: { code: "resource_missing" } });
    const status = stripeStatus(started.body.customerEmail);
    return send(200, {
      id: started.paymentIntentID,
      status,
      payment_method:
        status === "processing"
          ? { type: "sepa_debit", sepa_debit: { last4: "3000" } }
          : { type: "card", card: { brand: "visa", last4: "4242" } },
    });
  }
  if (url.pathname === "/api/orders/lookup") {
    response.setHeader("cache-control", "no-store");
    if (request.headers["x-order-lookup-secret"] !== lookupSecret)
      return send(401, { error: "Unauthorized" });
    const code = normalizeCode(body.code);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const order = code && lookupOrders().find((entry) => entry.code === code);
    if (!order || order.email !== email)
      return send(404, { error: "Not found" });
    const { email: _email, ...visible } = order;
    return send(200, visible);
  }
  return send(404, { error: "Not found" });
}

// Poems, authors and cities, localized per request like Payload.
const latakia = {
  id: 1,
  names: {
    de: "Latakia",
    en: "Latakia",
    ar: "اللاذقية",
    fa: "لاذقیه",
    uk: "Латакія",
    ku: "Lazkiye",
  },
  country: "SY",
};
const authors = [
  {
    id: 11,
    ...bothSlugs("nour-haddad"),
    name: { de: "Nour Haddad", ar: "نور حداد", fa: "نور حداد" },
    country: "SY",
    city: latakia,
    portrait: null,
    biography: {
      de: "Nour Haddad schreibt auf Arabisch und übersetzt mit der Werkstatt.",
      ar: "تكتب نور حداد بالعربية وتترجم قصائدها مع الورشة.",
    },
    awards: [
      { id: "a1", name: "Schreibstipendium Wasserzeichen", year: 2021 },
      { id: "a2", name: "Preis für junge Lyrik", year: 2024 },
    ],
  },
  {
    id: 12,
    ...bothSlugs("samira-taleb"),
    name: { de: "Samira Taleb", ar: "سميرة طالب" },
    country: "SY",
    city: null,
    portrait: media,
    biography: {},
    awards: [],
  },
  {
    id: 13,
    slugDe: "nachtfalter",
    slugEn: "moth",
    name: { de: "Nachtfalter", en: "Moth" },
    country: "AF",
    city: null,
    portrait: null,
    biography: {},
    awards: [],
  }, // A draft: only the preview endpoint returns it.
  {
    id: 14,
    slugDe: "entwurf-autorin",
    slugEn: "draft-author",
    name: { de: "Entwurf Autorin", en: "Draft Author" },
    country: "IR",
    city: null,
    portrait: null,
    biography: {},
    awards: [],
    draft: true,
  },
];
const version = (title, content, extra = {}) => ({ title, content, ...extra });
const poems = [
  {
    id: 201,
    ...bothSlugs("test-poem"),
    originalLanguage: "fa",
    year: 2024,
    author: 11,
    versions: {
      fa: version(
        "صبح مشترک",
        "صبح از میان پنجره‌های ما می‌گذرد\nو نام‌مان را آهسته می‌خواند",
        { description: "شعری دربارهٔ صبح." },
      ),
      de: version(
        "Gemeinsamer Morgen",
        "Der Morgen zieht durch unsere Fenster\nund ruft leise unsere Namen",
        {
          translator: "Prototype translation",
          description: "Ein Gedicht über den Morgen.",
        },
      ),
      en: version(
        "A Shared Morning",
        "Morning passes through our windows\nand softly calls our names",
        { translator: "Prototype translation" },
      ),
    },
  },
  {
    id: 202,
    slugDe: "regeln-des-ankommens",
    slugEn: "rules-of-arrival",
    originalLanguage: "ar",
    year: 2022,
    author: 11,
    versions: {
      ar: version(
        "قواعد الوصول",
        "تعلّمتُ أولًا «أنا»،\nثم «كنتُ»،\n\nثم انتظرتُ طويلًا\nقبل أن أقولَ «هنا».\nفي الدرسِ الأخير",
      ),
    },
  },
  {
    id: 203,
    slugDe: "elbe-februar",
    slugEn: "elbe-february",
    originalLanguage: "de",
    year: null,
    author: 12,
    versions: {
      de: version(
        "Elbe, Februar",
        "Der Fluss hier ist grau\nund trotzdem ein Fluss.",
      ),
    },
  },
  // A draft with different slugs and no German version: only previews show it.
  {
    id: 204,
    slugDe: "entwurf-gedicht",
    slugEn: "draft-poem",
    originalLanguage: "ar",
    year: 2026,
    author: 14,
    draft: true,
    versions: {
      ar: version("مسودة", "سطر أول\nسطر ثانٍ"),
      en: version("Draft", "First line\nSecond line", {
        translator: "Workshop",
      }),
    },
  },
  // Enough poems for a second page; years run from 2013 down to 1990.
  ...Array.from({ length: 24 }, (_, index) => ({
    id: 233 - index,
    slugDe: `gedicht-${index}`,
    slugEn: `poem-${index}`,
    originalLanguage: "de",
    year: 2013 - index,
    author: 12,
    versions: {
      de: version(
        `Gedicht ${index}`,
        `Zeile eins\nZeile zwei\nZeile drei\nZeile vier\nZeile fünf`,
        index === 0 ? { snippet: "Ein eigener Auszug" } : {},
      ),
      en: version(`Poem ${index}`, "Line one\nLine two", {
        translator: "Workshop",
      }),
    },
  })),
];
const localizedAuthor = (author, locale, depth) => ({
  id: author.id,
  slugDe: author.slugDe,
  slugEn: author.slugEn,
  name: author.name[locale] ?? null,
  country: author.country,
  city: depth > 0 ? author.city : (author.city?.id ?? null),
  portrait: depth > 0 ? author.portrait : (author.portrait?.id ?? null),
  biography: author.biography[locale] ?? null,
  awards: author.awards,
  _status: author.draft ? "draft" : "published",
});
const localizedPoem = (poem, locale, depth) => {
  const text = poem.versions[locale] ?? {};
  const author = authors.find((entry) => entry.id === poem.author);
  return {
    id: poem.id,
    slugDe: poem.slugDe,
    slugEn: poem.slugEn,
    title: text.title ?? null,
    content: text.content ?? null,
    originalLanguage: poem.originalLanguage,
    translator:
      locale === poem.originalLanguage ? null : (text.translator ?? null),
    description: text.description ?? null,
    year: poem.year,
    snippet: text.snippet ?? null,
    author: depth > 0 ? localizedAuthor(author, locale, depth - 1) : author.id,
    _status: poem.draft ? "draft" : "published",
  };
};
// The homepage global populates relationships two levels deep.
const homepagePoem = (id, locale) =>
  localizedPoem(
    poems.find((poem) => poem.id === id),
    locale,
    1,
  );
const homepageAuthor = (id, locale) =>
  localizedAuthor(
    authors.find((author) => author.id === id),
    locale,
    1,
  );
function poetryList(collection, params, locale) {
  const depth = Number(params.get("depth") ?? 0);
  const ids = (
    params.get("where[id][in]") ??
    params.get("where[id][equals]") ??
    params.get("id")
  )?.split(",");
  const author = params.get("where[author][equals]");
  // Like the CMS preview endpoint, `slug` is looked up in the locale's own slot.
  const slugParam = params.get("slug");
  const slugDe =
    params.get("where[slugDe][equals]") ?? (locale === "de" ? slugParam : null);
  const slugEn =
    params.get("where[slugEn][equals]") ?? (locale === "de" ? null : slugParam);
  const publishedOnly = params.get("where[_status][equals]") === "published";
  const docs = (collection === "poems" ? poems : authors)
    .filter((entry) => !publishedOnly || !entry.draft)
    .filter((entry) => !ids || ids.includes(String(entry.id)))
    .filter((entry) => !author || String(entry.author) === author)
    .filter((entry) => !slugDe || entry.slugDe === slugDe)
    .filter((entry) => !slugEn || entry.slugEn === slugEn)
    .map((entry) =>
      collection === "poems"
        ? localizedPoem(entry, locale, depth)
        : localizedAuthor(entry, locale, depth),
    );
  // Small pages in the mock exercise the web's paging through every page.
  const limit = Math.min(Number(params.get("limit") ?? 10), 10);
  const page = Number(params.get("page") ?? 1);
  return {
    docs: docs.slice((page - 1) * limit, page * limit),
    totalDocs: docs.length,
    hasNextPage: page * limit < docs.length,
  };
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
  if (url.pathname === "/shop-log")
    return response.end(JSON.stringify(shopLog));
  // Stands in for Photon (PLACE_SEARCH_URL), so tests never send addresses to komoot.
  if (url.pathname === "/photon/api") {
    shopLog.photon.push({
      query: Object.fromEntries(
        [...url.searchParams.keys()].map((key) => [
          key,
          url.searchParams.getAll(key).join(","),
        ]),
      ),
      userAgent: request.headers["user-agent"] ?? null,
    });
    if (url.searchParams.get("q")?.startsWith("Fehler")) {
      response.statusCode = 503;
      return response.end("{}");
    }
    return response.end(
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              type: "house",
              street: "Hermannstraße",
              housenumber: "12",
              postcode: "12049",
              city: "Berlin",
              district: "Neukölln",
            },
          },
          {
            type: "Feature",
            properties: {
              type: "street",
              name: "Hermannstraße",
              postcode: "20095",
              city: "Hamburg",
            },
          },
        ],
      }),
    );
  }
  if (
    /^\/(api\/(carts|payments|orders)|stripe)\//.test(url.pathname) ||
    url.pathname === "/api/carts"
  )
    return handleShop(request, response, url);

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

  // Payload reads a locale code in a query path as a locale suffix and rejects the path.
  const localeSuffixPath = [...url.searchParams.keys()].find((key) =>
    /\[[^\]]*\.(de|en|ar|fa|uk|ku)(\.[^\]]*)?\]/.test(key),
  );
  if (localeSuffixPath) {
    response.statusCode = 400;
    return response.end(
      JSON.stringify({
        errors: [
          {
            message: `The following path cannot be queried: ${localeSuffixPath}`,
          },
        ],
      }),
    );
  }

  const locale = url.searchParams.get("locale") ?? "de";
  const fixedPage = url.pathname.match(
    /^\/api\/globals\/(about|contact|privacy|legal|terms)\/(public|preview)$/,
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
  if (url.pathname === "/api/globals/shop-settings") {
    // Ukrainian stands in for settings that no editor has saved yet.
    if (locale === "uk") return response.end("{}");
    return response.end(
      JSON.stringify({
        shippingRate: 400,
        priceNote:
          locale === "de"
            ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
            : null,
      }),
    );
  }
  if (url.pathname === "/api/products") {
    const slug = url.searchParams.get("where[slug][equals]");
    const id = url.searchParams.get("where[id][equals]");
    const docs = (id ? [findProduct(id)].filter(Boolean) : products)
      .filter((entry) => !slug || entry.slug === slug)
      .map((entry) => localizedProduct(entry, locale));
    return response.end(JSON.stringify({ docs, totalDocs: docs.length }));
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
          ...bothSlugs("reading"),
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
  const poetryCollection = url.pathname.match(
    /^\/api\/(poems|authors)(\/preview)?$/,
  )?.[1];
  if (poetryCollection)
    return response.end(
      JSON.stringify(poetryList(poetryCollection, url.searchParams, locale)),
    );
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
      : (url.searchParams.get("where[slugDe][equals]") ??
        url.searchParams.get("where[slugEn][equals]"));
    const document = event(locale, isPreview);
    // Lookups return the record they matched, so its slugs feed the alternates.
    if (requestedSlug) Object.assign(document, bothSlugs(requestedSlug));
    const germanSlug = url.searchParams.get("where[slugDe][equals]");
    const englishSlug = url.searchParams.get("where[slugEn][equals]");
    if (germanSlug === "fluss-lesung" || englishSlug === "river-reading") {
      Object.assign(document, {
        slugDe: "fluss-lesung",
        slugEn: "river-reading",
      });
      if (locale === "fa") document.title = null;
    }
    if (germanSlug === "river-reading" || englishSlug === "fluss-lesung")
      return response.end(JSON.stringify({ docs: [], totalDocs: 0 }));
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
        ...bothSlugs("reading"),
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
              ...bothSlugs("next-workshop"),
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
              ...bothSlugs("past"),
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
    }
    if (requestedSlug === "bare-registration")
      document.registrationUrl = " google.de ";
    if (requestedSlug === "unsafe-registration")
      document.registrationUrl = "javascript:alert(1)";
    if (requestedSlug === "partial" && locale === "fa") document.title = null;
    return response.end(JSON.stringify({ docs: [document], totalDocs: 1 }));
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(Number(process.env.MOCK_CMS_PORT ?? 3001), "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
