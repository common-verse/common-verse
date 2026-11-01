import type { APIRoute } from "astro";
import { PLACE_SEARCH_URL } from "astro:env/server";
import {
  maxQueryLength,
  minQueryLength,
  photonSuggestions,
  rateLimiter,
  type AddressSuggestion,
} from "../../lib/address";

// Checkout address suggestions. The browser asks us, not komoot: buyers' IP addresses stay
// here, answers are cached, and a self-hosted Photon only needs PLACE_SEARCH_URL.
const photon = PLACE_SEARCH_URL || "https://photon.komoot.io/";
// new URL("api", base) drops the last path segment of a base without a trailing slash.
if (!photon.endsWith("/"))
  throw new Error('PLACE_SEARCH_URL must end with "/".');
const userAgent = "PoetryProjectShop/1.0 (https://thepoetryproject.de)";
const cacheLimit = 500;
const cacheAge = 24 * 60 * 60 * 1000;
const cache = new Map<
  string,
  { at: number; suggestions: AddressSuggestion[] }
>();
// A typing buyer sends a request about every 200 ms at most; 30 a minute covers several addresses.
const allowed = rateLimiter(30, 60 * 1000);
// All buyers together stay within the public Photon's fair use.
const allowedOverall = rateLimiter(300, 60 * 1000);

const reply = (suggestions: AddressSuggestion[], status = 200) =>
  new Response(JSON.stringify({ suggestions }), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

export const GET: APIRoute = async ({ url, clientAddress, request }) => {
  // Only our own checkout page may use this; browsers always send Sec-Fetch-Site.
  if (request.headers.get("sec-fetch-site") !== "same-origin")
    return reply([], 403);
  const query = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (query.length < minQueryLength || query.length > maxQueryLength)
    return reply([]);
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < cacheAge)
    return reply(cached.suggestions);
  if (!allowed(clientAddress) || !allowedOverall("all")) return reply([], 429);

  const search = new URL("api", photon);
  search.search = new URLSearchParams([
    ["q", query],
    ["countrycode", "DE"],
    ["layer", "house"],
    ["layer", "street"],
    ["lang", "de"],
    ["limit", "5"],
  ]).toString();
  try {
    const response = await fetch(search, {
      headers: { "user-agent": userAgent },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error(`Photon answered ${response.status}`);
    const suggestions = photonSuggestions(await response.json(), query);
    cache.delete(key);
    cache.set(key, { at: Date.now(), suggestions });
    // Maps keep insertion order: the first key is the oldest.
    if (cache.size > cacheLimit) cache.delete(cache.keys().next().value!);
    return reply(suggestions);
  } catch (error) {
    // Without suggestions the street field is a plain text field.
    console.error(error);
    return reply([], 502);
  }
};
