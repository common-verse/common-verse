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
- **Orders**: Stripe confirms the payment before an order exists. Editors see the
  date, email, amount and status, and set the status while packing and shipping.
  Payload sends no emails; Stripe sends receipts.
- **Shop settings**: the flat shipping rate within Germany and a price note shown
  under prices and at checkout.

## Checkout flow

1. Astro creates a guest cart (`POST /api/carts`) and keeps its ID and secret in
   httpOnly cookies. Every cart request carries that secret.
2. The checkout form collects email and a German address. Astro calls
   `POST /api/payments/stripe/initiate`. The CMS rejects other countries, adds the
   shipping rate to the current book prices and creates a PaymentIntent and a pending
   transaction. Without a saved shipping rate, payment is refused.
3. The Payment Element confirms the payment in the browser and returns to the
   site, which calls `POST /api/payments/stripe/confirm-order`. The CMS checks the
   PaymentIntent with Stripe, creates the order and lowers stock.
4. If the buyer never returns, the `payment_intent.succeeded` webhook confirms the
   same order. Confirmation is idempotent.

The CMS must be called from the Astro server without cookies or API keys: a signed-in
user would become the order's customer.

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

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOKS_SIGNING_SECRET` for the CMS and
`PUBLIC_STRIPE_PUBLISHABLE_KEY` for Astro ([configuration](configuration.md)).
Without the secret key the site works but payments fail; without the signing
secret, webhooks are ignored.

In the Stripe Dashboard:

1. Use test keys for development; the CMS pins API version `2025-08-27.basil`.
2. Add a webhook endpoint `https://<cms>/api/payments/stripe/webhooks` for
   `payment_intent.succeeded` and copy its signing secret.
3. Disable delayed payment methods such as SEPA Direct Debit in the Payment
   Element settings. They leave payments processing, so no order is created.
4. Enable email receipts for successful payments.

Locally, forward webhooks with
`stripe listen --forward-to localhost:3001/api/payments/stripe/webhooks`.

## Known limits

- Stock is checked when payment starts, not when it completes. Two buyers can
  oversell the last copy.
- A cart holds at most 7 different books; Stripe metadata limits the item list.
  Each line allows 1 to 10 copies, and payment is refused when stock is short.
- Price note and VAT: the seeded note (`Gemäß § 19 UStG wird keine Umsatzsteuer
berechnet.`) is a placeholder to confirm with the treasurer.
- Terms of sale & withdrawal is a placeholder page; the association must replace it
  before launch.
- There is no withdrawal function as § 356a BGB requires; it must exist before
  launch.
- A buyer who pays the same cart in two tabs is charged twice, and the webhook
  confirms both orders. Refund the duplicate in the Stripe Dashboard.
- Abandoned carts and pending transactions remain in the database.

## Deployment

- Rate-limit `/api/carts` and `/api/payments/*` at the proxy. Each payment start
  creates a Stripe Customer, a PaymentIntent and a pending transaction, and the
  CMS has no limit of its own.
- Cart reads send the cart secret as `?secret=`, so it appears in CMS access logs.
  Restrict access to those logs or drop the query string from them.
- The plugin is in beta; review its release notes before upgrading Payload.
