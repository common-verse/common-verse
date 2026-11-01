import { message } from "@poetry/cms-ui";
import type { TextFieldSingleValidation } from "payload";
import { expect, it } from "vitest";
import configPromise from "../payload.config";

const request = (role?: string) =>
  ({
    req: {
      user: role ? { id: 7, collection: "users", role } : null,
      query: {},
      context: {},
    },
  }) as never;

async function access(slug: string) {
  const config = await configPromise;
  const entity =
    config.collections.find((collection) => collection.slug === slug) ??
    config.globals.find((global) => global.slug === slug);
  if (!entity) throw new Error(`Missing ${slug}`);
  return entity.access as Record<
    string,
    (args: never) => unknown | Promise<unknown>
  >;
}

it("keeps orders, transactions, addresses, carts and accounts private from guests", async () => {
  for (const slug of ["orders", "transactions", "addresses", "users"])
    for (const operation of ["read", "update", "delete"])
      expect(await (await access(slug))[operation](request())).toBe(false);
  const carts = await access("carts");
  expect(await carts.create(request())).toBe(true);
  expect(await carts.read(request())).toBe(false);
  expect(await (await access("shop-settings")).update(request())).toBe(false);
  expect(await (await access("products")).create(request())).toBe(false);
});

it("lets editors manage products, orders and shop settings but not payments", async () => {
  const products = await access("products");
  for (const operation of ["create", "update", "delete"])
    expect(await products[operation](request("editor"))).toBe(true);
  expect(await products.read(request())).toBe(true);
  const orders = await access("orders");
  expect(await orders.read(request("editor"))).toBe(true);
  expect(await orders.update(request("editor"))).toBe(true);
  expect(await orders.delete(request("editor"))).toBe(false);
  expect(await (await access("shop-settings")).update(request("editor"))).toBe(
    true,
  );
  expect(await (await access("shop-settings")).read(request())).toBe(true);
  for (const slug of ["transactions", "carts", "addresses"])
    expect(await (await access(slug)).read(request("editor"))).toBe(false);
  expect(await (await access("transactions")).read(request("admin"))).toBe(
    true,
  );
});

it("rejects product slugs that collide with shop routes or are not URL-safe", async () => {
  const slug = (await configPromise).collections
    .find((collection) => collection.slug === "products")!
    .flattenedFields.find((field) => field.name === "slug");
  if (slug?.type !== "text") throw new Error("Missing slug");
  const validate = slug.validate as TextFieldSingleValidation;
  const options = {
    required: true,
    req: {
      payload: { config: {} },
      t: () => "Required",
      i18n: { language: "uk" },
    },
  } as never;
  expect(await validate("cart", options)).toBe(message("slug_reserved", "uk"));
  expect(await validate("checkout", options)).toBe(
    message("slug_reserved", "uk"),
  );
  expect(await validate("die-zeit", options)).toBe(true);
  expect(await validate("die zeit", options)).toBe(
    message("slug_format", "uk"),
  );
});

it("answers refused payment starts on the real initiate endpoint with 409", async () => {
  const endpoint = (await configPromise).endpoints.find(
    ({ path, method }) =>
      path === "/payments/stripe/initiate" && method === "post",
  );
  // Without a customer email the plugin answers 400 before reading anything.
  const response = await endpoint!.handler({
    context: { paymentRefusal: "payment_in_progress" },
    user: null,
    headers: new Headers(),
  } as never);
  expect(response.status).toBe(409);
});
