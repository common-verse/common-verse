/** One address suggestion for the checkout's street field. */
export interface AddressSuggestion {
  /** Street and house number, as the street field takes it. */
  line1: string;
  postalCode: string;
  city: string;
  /** District or locality, only to tell similar streets apart. */
  area: string | null;
}

interface PhotonProperties {
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  district?: string;
  locality?: string;
}

export const minQueryLength = 3;
export const maxQueryLength = 120;

/** "Hermannstr 12a" → street "Hermannstr" and the typed house number "12a". */
function typedAddress(query: string) {
  const match = query.match(/^(.*?)\s+(\d+\s?[a-zA-Z]?(?:[-/]\d+)?)\s*$/);
  return match
    ? { street: match[1]!, number: match[2]!.replace(/\s/g, "") }
    : { street: query, number: null };
}

/** Compares street names the way people abbreviate them: "Hermannstr." is "Hermannstraße". */
const streetKey = (street: string) =>
  street
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/str\.?(?=\s|$)/g, "strasse")
    .replace(/[^\p{L}\p{N}]+/gu, "");

/** Usable suggestions from a Photon response: German postcode, street and city, no duplicates. */
export function photonSuggestions(
  response: unknown,
  query: string,
): AddressSuggestion[] {
  const features = (response as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  const typed = typedAddress(query);
  const typedStreet = streetKey(typed.street);
  const seen = new Set<string>();
  return features.flatMap((feature) => {
    const p: PhotonProperties = feature?.properties ?? {};
    const street = p.street ?? (p.type === "street" ? p.name : undefined);
    const city = p.city ?? p.locality;
    if (!street || !city || !/^\d{5}$/.test(p.postcode ?? "")) return [];
    // The typed number only belongs to the street the buyer typed, not to a similar one.
    const houseNumber =
      p.housenumber ??
      (typedStreet && streetKey(street).startsWith(typedStreet)
        ? typed.number
        : null);
    const line1 = houseNumber ? `${street} ${houseNumber}` : street;
    const key = `${line1}|${p.postcode}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const area = p.district ?? (p.locality !== city ? p.locality : undefined);
    return [{ line1, postalCode: p.postcode!, city, area: area ?? null }];
  });
}

/**
 * One client for rate limits: an IPv6 address by its /64 prefix, since one connection usually
 * holds a whole /64; IPv4 (also IPv4-mapped IPv6) and other keys stay as they are.
 */
export function clientKey(address: string) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return mapped[1]!;
  if (!address.includes(":")) return address;
  const [head = "", tail] = address.toLowerCase().split("%")[0]!.split("::");
  const front = head ? head.split(":") : [];
  const back = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? front
      : [...front, ...Array(8 - front.length - back.length).fill("0"), ...back];
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/**
 * Allows `limit` calls per key within `windowMs`; a small in-memory guard for one server.
 * A negative `cost` takes a counted call back, so only failures count against the limit.
 */
export function rateLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, { start: number; count: number }>();
  return (client: string, now = Date.now(), cost = 1) => {
    const key = clientKey(client);
    const current = windows.get(key);
    if (!current || now - current.start >= windowMs) {
      // Forget expired windows so the map does not grow with every visitor.
      for (const [other, entry] of windows)
        if (now - entry.start >= windowMs) windows.delete(other);
      if (cost > 0) windows.set(key, { start: now, count: cost });
      return true;
    }
    current.count += cost;
    return current.count <= limit;
  };
}
