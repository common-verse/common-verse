# Configuration and secrets

When `.env` is absent, setup copies `.env.example` and replaces its secret
placeholders with independent 32-byte cryptographically random values. The
file is created with owner-only permissions where supported and excluded from Git.
It is plain text, not encrypted. Restrict access to your development machine.

Existing `.env` files are preserved byte for byte. Missing or placeholder required
values produce an error; correct them explicitly. Shell environment variables take
precedence. Both applications use the root file; a second CMS `.env` is not needed.
Development setup refuses to run with `NODE_ENV=production`.

Production secrets must be generated separately, stored in your hosting platform's
secret settings, and kept stable across deployments. Neither builds nor production
startup should generate them. Rotating Payload's secret can invalidate sessions;
rotating the preview secret invalidates previously issued preview links.

| Variable                         | Deployment owner and timing                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYLOAD_SECRET`                 | CMS runtime; private and stable.                                                                                                                                           |
| `PREVIEW_SECRET`                 | Same private value in CMS and Astro runtimes. Astro reads it through `astro:env/server`, not an embedded build constant.                                                   |
| `DATABASE_URL`                   | CMS runtime; actual environment database credentials.                                                                                                                      |
| `PUBLIC_CMS_URL`                 | Astro build; the CMS origin reachable by the Astro server.                                                                                                                 |
| `PUBLIC_SITE_URL`                | Astro build and CMS runtime; the public site origin for metadata and preview links.                                                                                        |
| `PAYLOAD_PUBLIC_SERVER_URL`      | CMS runtime; the public CMS origin.                                                                                                                                        |
| `STRIPE_SECRET_KEY`              | CMS runtime; private. Without it the site runs, but shop payments fail.                                                                                                    |
| `STRIPE_WEBHOOKS_SIGNING_SECRET` | CMS runtime; private. Without it webhooks are ignored, including the paid-order fallback.                                                                                  |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY`  | Astro; publishable, not secret. Use test keys locally.                                                                                                                     |
| `ORDER_LOOKUP_SECRET`            | Same private value in CMS and Astro server runtimes. Setup generates it for a new `.env`; without it the lookup answers 401.                                               |
| `TRUST_PROXY`                    | Astro build; `true` only behind a reverse proxy that overwrites `X-Forwarded-For`, so rate limits see the buyer's IP ([shop](shop.md#rate-limits-and-the-client-address)). |

No secret should receive a `PUBLIC_` prefix. Preview links contain a bearer secret;
share them only with intended reviewers. Development setup is not a deployment
command. Production schema changes need reviewed Payload migrations.

## Documentation tools

[`.mcp.json`](../.mcp.json) configures the Astro documentation service.
Before connecting a client to Payload, read the
[Payload MCP client setup documentation](https://payloadcms.com/docs/plugins/mcp#connecting-to-mcp-clients).
Use the running local CMS endpoint at `http://localhost:3001/api/mcp` with a
personal scoped API key. The project's enabled capabilities are defined in
[`payload.config.ts`](../apps/cms/src/payload.config.ts); key-management permissions
are covered in [accounts and permissions](accounts-and-permissions.md).

## Editor maps and place search

The event editor uses Leaflet with OpenStreetMap standard tiles and Photon place
search. No API key is needed. Search is proxied through the authenticated CMS
endpoint; map tiles load directly in the editor with visible OSM attribution.
No map requests are added to public pages. External queries are debounced and limited to six results. The same search also
returns saved locations by alias, name, or address. Map clicks use reverse geocoding
to resolve an address while retaining the selected coordinates. Coordinate selection and saved places remain available if external
search fails.

`PLACE_SEARCH_URL` optionally selects another Photon server (base URL, including a
trailing slash) for the CMS and for the website's checkout address suggestions,
read at runtime. The default is `https://photon.komoot.io/`. Its public service has
fair-use throttling and no availability guarantee; use a dedicated Photon service
if editorial traffic exceeds its allowance. Standard OSM tiles also have a
[usage policy](https://operations.osmfoundation.org/policies/tiles/).
