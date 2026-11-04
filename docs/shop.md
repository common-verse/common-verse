# Shop

The bookshop uses [`@payloadcms/plugin-ecommerce`](https://payloadcms.com/docs/ecommerce/overview)
with its Stripe adapter (PaymentIntents and the Payment Element). Buyers check
out as guests; there are no customer accounts. Configuration lives in
[`apps/cms/src/shop`](../apps/cms/src/shop) and
[`Products.ts`](../apps/cms/src/collections/Products.ts).

## Editor workflow

The **Shop** sidebar group holds Products, Orders and Shop settings. Editors and
administrators manage all three; carts and payment transactions are visible to
administrators only. See [accounts and permissions](accounts-and-permissions.md).

- **Products**: title, title language, cover, description per language, price and
  stock. Enter prices with a decimal point (`12.50`); a comma is ignored. Stock `0`
  means sold out and empty means unlimited. New products start at `0`.
  Products are public when saved; there are no drafts.
- **Orders**: Stripe confirms the payment before an order exists, so every order
  is paid; ship nothing else. Editors see the order code, date, email, amount and
  status. A new order starts as _Paid_; set _Shipped_ once it is posted, or
  _Cancelled_ / _Refunded_. Payload sends no emails; Stripe sends receipts.
- **Shop settings**: the flat shipping rate within Germany and a price note shown
  under prices and at checkout.

## Payment methods

Card, Apple Pay and Google Pay (wallets through Stripe's Express Checkout
Element), Wero and SEPA Direct Debit. No PayPal, Klarna or prepayment. The CMS
creates PaymentIntents with automatic payment methods, so the Stripe Dashboard
switches decide what the Payment Element shows (see [configuration](#configuration)).
The checkout's payment-methods line (`shop_payment_methods`, required at the
start of checkout by § 312j Abs. 1 BGB) is fixed text: change it together with
the Dashboard. The wallet row is limited in code to Apple Pay and Google Pay, so
Link, Amazon Pay, PayPal or Klarna never appear there even if switched on.

SEPA Direct Debit is asynchronous: Stripe reports the payment as processing for
about six business days and it can still fail. The order exists only after
`payment_intent.succeeded`; until then the buyer's lookup shows "Zahlung läuft"
and editors see nothing in Orders. The buyer's bank can still reverse a debit
for eight weeks.

## Checkout flow

1. Astro creates a guest cart (`POST /api/carts`) and keeps its ID and secret in
   httpOnly cookies. Every cart request carries that secret.
2. The checkout is one page. The Payment Element and the Express Checkout Element
   load at once with the cart total and `eur` (Stripe's deferred intent, `mode:
'payment'`); no PaymentIntent exists yet. The form collects email and a German
   address (last name required, first name optional); the Payment Element
   collects the payment details, not the email or the country, which the form
   passes on. The page also carries its checkout key: books, quantities, current
   prices and shipping.
3. On „Zahlungspflichtig bestellen“ the browser checks the form with the shared
   schema, calls `elements.submit()` and posts the contact and the checkout key
   as JSON to the Astro route `/api/checkout` (10 starts per IP a minute). It
   checks the contact again and compares the key with the current cart: on a
   difference (another tab, a new price or shipping rate) it answers
   `409 cart_changed`, and the browser sends the form to the page, which shows the
   current cart with what was typed and a notice. Then it calls
   `POST /api/payments/stripe/initiate`. The CMS rejects other countries, adds the
   shipping rate to the current book prices and creates a PaymentIntent and a
   pending transaction with a new order code, returned as `orderCode`. Without a
   saved shipping rate, payment is refused. Astro keeps the PaymentIntent, the
   contact, the cart contents with prices and the order code in the httpOnly
   `poetry-checkout` cookie for a day and returns only the client secret. A retry
   with the same checkout key and contact (a declined card) reuses that
   PaymentIntent.
   Otherwise the CMS first cancels the cart's earlier PaymentIntents that are not
   paid yet (reason `abandoned`) and marks their transactions cancelled, so only
   the newest one can be paid. It refuses with `409 { "error": "payment_in_progress" }`
   and creates nothing when an earlier one is processing or paid, when one waits
   for the buyer (3-D Secure, a Wero redirect) and is younger than 10 minutes, or
   when another payment start for the cart is running; the site shows „Zahlung
   läuft bereits“ and keeps its cookie and code. A cart that already has its order
   gets `409 { "error": "cart_completed" }`; Astro then clears the cart and
   checkout cookies and sends the buyer to the cart with a neutral notice, as it
   does when the cart no longer exists.
4. The browser confirms with `stripe.confirmPayment` and the client secret; Stripe
   returns to `/shop/checkout/complete`, which calls
   `POST /api/payments/stripe/confirm-order`. The CMS checks the PaymentIntent
   with Stripe, creates the order with the transaction's code, lowers stock and
   returns `{ orderID, transactionID, orderCode, … }`. While a SEPA payment is
   processing, confirmation fails. At the same time Astro reads the PaymentIntent
   from Stripe with the publishable key and the client secret, as Stripe.js would
   (`GET /v1/payment_intents/<id>?client_secret=…&expand[]=payment_method`), for
   its status and the payment method's last four digits; when Stripe cannot be
   reached, Stripe's `redirect_status` decides. Then:
   - confirmed, or processing (SEPA): the page shows the code (copy button and a
     link to the status page with `?code=`), email, payment, address and the next
     steps; the books come from the checkout key with the prices paid. Astro clears
     the cart and checkout cookies and keeps code, status, PaymentIntent ID, time,
     checkout key and the payment method (brand or IBAN and last four digits only),
     but no name, address or email, in the httpOnly `poetry-order` cookie for 15
     minutes, limited to the confirmation path. A reload therefore shows code,
     payment and next steps without confirming twice, but no longer the contact.
     A small script then removes Stripe's parameters, including the client secret,
     from the address bar.
   - failed (declined, cancelled, abandoned 3-D Secure or Wero): the cart and
     checkout cookies stay; below the heading a line says the cart is still saved,
     and „Erneut versuchen“ leads back to the checkout. No notification: on phones
     it would cover the heading and the summary toggle.
   - paid at Stripe but not confirmed by the CMS yet: „Deine Zahlung wird geprüft“
     with the code from payment start and the status link; the cookies stay, the
     webhook creates the order, a reload asks again, and a second payment start is
     refused by the CMS (`payment_in_progress`). A return without the matching
     checkout cookie shows the same text without a code.
5. Wallets (Apple Pay, Google Pay) ask for email and a German shipping address in
   their own sheet with the flat rate. On the element's `confirm` event the browser
   checks that contact with the same schema (the recipient name is split at its
   last space; a single name is the last name) and continues with step 3. While
   the form starts a payment, a press on a wallet button is refused, and the form's
   button stays disabled while a wallet payment runs.
6. Webhooks keep the transaction current. On `payment_intent.processing` and
   `payment_intent.payment_failed` the CMS reads the PaymentIntent's current
   status from Stripe, so late or repeated events cannot overwrite a newer state,
   and marks the transaction processing or failed. `payment_intent.succeeded`
   confirms the order if the buyer never returned.
   Confirmation is idempotent and also accepts a transaction marked failed or
   processing once Stripe reports success (a declined card retried, a SEPA debit
   collected).

Without JavaScript the form still posts to the page, which reports field errors;
paying needs Stripe.js, so a quiet note says so and no payment starts.

## Address suggestions

The street field suggests German addresses from [Photon](https://photon.komoot.io/)
(OpenStreetMap data, © OpenStreetMap contributors, ODbL; the list shows the
attribution). The browser asks the Astro route `/api/address?q=`, never komoot
directly. From 3 characters, after 180 ms without typing, the route asks Photon
for houses and streets in Germany (`countrycode=DE`, `layer=house`,
`layer=street`, `lang=de`, `limit=5`) with a 2.5 s timeout and a descriptive
User-Agent. Answers are cached in memory for a day (500 queries); each IP may
send 30 uncached queries a minute, and all buyers together 300. The route answers
only requests with `Sec-Fetch-Site: same-origin`, which browsers send from our
own pages; other sites and scripts get `403`. When Photon fails or the limit is reached the
field is a plain text field, without a message. Choosing a suggestion fills
street and house number (the typed number when Photon only knows the street),
postcode and city. `PLACE_SEARCH_URL` selects another Photon server, as for the
CMS place search ([configuration](configuration.md)).

Privacy: what the buyer types into the street field (partial addresses) is sent
from our server to komoot's public Photon service; the buyer's IP
address and cookies are not. The privacy policy should name komoot as recipient
of address searches during checkout, or a self-hosted Photon should replace it.
The public service has fair-use limits and no availability guarantee.

## Rate limits and the client address

`/api/checkout`, `/api/address` and the order status page count requests per client IP in memory (one
Node process; a restart forgets them). An IPv6 address counts by its /64 prefix,
which one connection usually holds as a whole. Astro takes the IP from the TCP
connection. Behind a reverse proxy every buyer would then share the proxy's
address: build with `TRUST_PROXY=true` and a correct `PUBLIC_SITE_URL`, and
Astro reads `X-Forwarded-For` on requests for that host
([`security.allowedDomains`](https://docs.astro.build/en/reference/configuration-reference/#securityalloweddomains)).
The proxy must overwrite, not append to, `X-Forwarded-For`, and the Node server
must not be reachable around it; otherwise anyone can choose their IP. The
proxy's own limits (see [deployment](#deployment)) stay the main protection.

## Order code and status lookup

Every order has a public code: 8 characters of Crockford base32 (no I, L, O or
U), stored without hyphen and displayed as `K7QD-93FA`. It is created with the
transaction when payment starts, so buyers see it on the confirmation page even
for SEPA (the website keeps it in the checkout cookie), and copied to the order. Orders from before codes existed have none.

`POST /api/orders/lookup` with `{ "code", "email" }` and the header
`x-order-lookup-secret: $ORDER_LOOKUP_SECRET` returns the status buyers see:

| `status`             | Shown as               | Source                      |
| -------------------- | ---------------------- | --------------------------- |
| `payment_processing` | Zahlung läuft          | transaction processing      |
| `payment_failed`     | Zahlung fehlgeschlagen | transaction failed          |
| `paid`               | Bezahlt, wird gepackt  | order Paid                  |
| `shipped`            | Versendet              | order Shipped               |
| `cancelled`          | Storniert              | order Cancelled or Refunded |

The response holds `code`, `status`, `createdAt`, `items` (`title`, `quantity`),
`amount` and `currency`, never name or address, and is not cached. The code is
read case-insensitively without hyphens or spaces, with O, I and L read as 0, 1
and 1; the email is trimmed and lowercased. A wrong code, wrong email, unpaid
attempt or malformed request all get the same `404 { "error": "Not found" }`.
The endpoint reads orders with access control bypassed, so only the Astro server
may call it; it has no rate limit of its own.

The CMS must be called from the Astro server without cookies or API keys: a signed-in
user would become the order's customer.

Buyers look up an order on the status page (`/bestellstatus`, `/en/order-status`;
linked in the footer as „Bestellstatus“). It is a plain form that posts to the page,
so it works without JavaScript: the Astro server checks code and email with the same
reading as the CMS, then calls the lookup with `ORDER_LOOKUP_SECRET`. Each IP may
fail 5 lookups in 15 minutes (in memory, see
[rate limits](#rate-limits-and-the-client-address)); found orders and CMS errors do
not count. „Keine Bestellung gefunden“, „Zu viele Versuche“ and „nicht abrufbar“
appear as text in a reserved line below the button, so nothing moves. A found order
shows its status, timeline, books with quantities, total and date beside it, in the
checkout's split layout, never name or address. The page is `no-store`. A failed
payment names the shop address `shop@thepoetryproject.de`, a placeholder until the
association decides.

## Legal duties

Not legal advice: the association decides how to meet these norms. Texts were read
on gesetze-im-internet.de on 2026-10-31; re-read the linked norm before relying on
a detail.

- **Start of checkout**: state clearly that delivery is to Germany only and which
  payment methods are accepted
  ([§ 312j Abs. 1 BGB](https://www.gesetze-im-internet.de/bgb/__312j.html)).
- **Directly before the order button**: show, highlighted, the books' main
  features, the total price and the shipping costs (§ 312j Abs. 2 BGB with
  [Art. 246a § 1 Abs. 1 Nr. 1, 5, 7 EGBGB](https://www.gesetze-im-internet.de/bgbeg/art_246a__1.html)),
  and give the withdrawal conditions with the model
  [notice](https://www.gesetze-im-internet.de/bgbeg/art_253anlage_1.html) and
  [form](https://www.gesetze-im-internet.de/bgbeg/art_253anlage_2.html)
  (Art. 246a § 1 Abs. 2 EGBGB). On narrow screens the order summary must still
  come before the button.
- **Order button**: easily readable, labelled „Zahlungspflichtig bestellen“ or an
  equally unambiguous wording, with no other text (§ 312j Abs. 3 BGB); otherwise
  no contract is formed (Abs. 4). Other locales translate `shop_pay` faithfully.
- **Around the order**: buyers can correct input errors before ordering, receive
  an electronic receipt confirmation without delay, and can retrieve and save
  the terms
  ([§ 312i Abs. 1 Nr. 1, 3, 4 BGB](https://www.gesetze-im-internet.de/bgb/__312i.html)).
  Whether Stripe's receipt counts as that confirmation is for the association
  to decide.
- **Prices**: say whether VAT is included and state shipping costs
  ([§ 6 PAngV](https://www.gesetze-im-internet.de/pangv_2022/__6.html)).
- **Withdrawal function**: books carry the 14-day withdrawal right
  ([§ 312g Abs. 2 BGB](https://www.gesetze-im-internet.de/bgb/__312g.html) has no
  exception for them). Since 2026-06-19,
  [§ 356a BGB](https://www.gesetze-im-internet.de/bgb/__356a.html) requires an
  easily readable, prominent function labelled „Vertrag widerrufen“ (or equally
  unambiguous), reachable for the whole withdrawal period and not behind a
  login. Buyers enter or confirm their name, the order, and where to receive the
  confirmation, then send it with „Widerruf bestätigen“. The shop must
  acknowledge it without delay on a durable medium, with its content and the date
  and time of receipt.

## Configuration

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOKS_SIGNING_SECRET` for the CMS,
`PUBLIC_STRIPE_PUBLISHABLE_KEY` for Astro and `ORDER_LOOKUP_SECRET` for both
([configuration](configuration.md)).
Without the secret key the site works but payments fail; without the signing
secret, webhooks are ignored.

In the Stripe Dashboard:

1. Use test keys for development; the CMS pins API version `2025-08-27.basil`.
2. Add a webhook endpoint `https://<cms>/api/payments/stripe/webhooks` for
   `payment_intent.succeeded`, `payment_intent.processing` and
   `payment_intent.payment_failed`, and copy its signing secret.
3. Under payment methods, enable Cards, Apple Pay, Google Pay, Wero and SEPA
   Direct Debit, and disable everything else (PayPal, Klarna, bank transfer and
   other methods). Register the site's domain under payment method domains, or
   the wallet buttons stay hidden.
4. Enable email receipts for successful payments.

Locally, forward webhooks with
`stripe listen --forward-to localhost:3001/api/payments/stripe/webhooks`.

## Known limits

- Stock is checked when payment starts, not when it completes. Two buyers can
  oversell the last copy; with SEPA the gap lasts days.
- A cart holds at most 7 different books; Stripe metadata limits the item list.
  Each line allows 1 to 10 copies, and payment is refused when stock is short.
- Price note and VAT: the seeded note (`Gemäß § 19 UStG wird keine Umsatzsteuer
berechnet.`) is a placeholder to confirm with the treasurer.
- Terms of sale & withdrawal is a placeholder page; the association must replace it
  before launch.
- There is no withdrawal function as § 356a BGB requires; it must exist before
  launch.
- Only the newest PaymentIntent of a cart can be paid. A payment start holds its
  cart for at most a minute; a slower one that lost the cart to a newer start
  cancels its own PaymentIntent (reason `duplicate`) and answers
  `payment_in_progress`. A buyer who pays two different carts (two devices) gets
  two orders; refund a duplicate in the Stripe Dashboard.
- Abandoned carts and pending transactions remain in the database.

## Deployment

- Rate-limit `/api/carts`, `/api/payments/*` and the Astro route that calls
  `/api/orders/lookup` at the proxy; codes and emails can otherwise be guessed
  without limit. Each payment start creates a Stripe Customer, a PaymentIntent
  and a pending transaction, and the CMS has no limit of its own.
- Cart reads send the cart secret as `?secret=`, so it appears in CMS access logs.
  Restrict access to those logs or drop the query string from them.
- The plugin is in beta; review its release notes before upgrading Payload.

## Agent team

Shop work extends the [agent team](agent-team.md):

- CMS developers and security review add `stripe-best-practices`, which yields to
  the project overrides in [skills](skills.md): PaymentIntents with the Payment
  Element and the pinned SDK.
- Security review always runs and covers money as well as access and keys.
- QA runs every acceptance criterion with Stripe test mode on the real stack.
- The designer takes the checkout flow and [legal duties](#legal-duties) from
  this page.
