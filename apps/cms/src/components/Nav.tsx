import { DefaultNav } from "@payloadcms/next/rsc";
import type { groupNavItems } from "@payloadcms/ui/shared";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";

type NavElementProps = {
  children?: ReactNode;
  groups?: ReturnType<typeof groupNavItems>;
};

const entityOrder = [
  "articles",
  "events",
  "locations",
  "poems",
  "authors",
  "cities",
  "media",
  "users",
  "homepage",
  "events-page",
  "about",
  "contact",
  "privacy",
  "legal",
  "terms",
  "products",
  "orders",
  "shop-settings",
  "carts",
  "transactions",
];
const rank = (slug: string) => {
  const index = entityOrder.indexOf(slug);
  return index === -1 ? entityOrder.length : index;
};

export function orderNavigation(node: ReactNode): ReactNode {
  if (!isValidElement<NavElementProps>(node)) return node;
  const { groups, children } = node.props;
  if (groups) {
    const ordered = groups
      .map((group) => ({
        ...group,
        entities: [...group.entities].sort(
          (a, b) => rank(a.slug) - rank(b.slug),
        ),
      }))
      .sort(
        (a, b) =>
          Math.min(...a.entities.map(({ slug }) => rank(slug))) -
          Math.min(...b.entities.map(({ slug }) => rank(slug))),
      );
    if (
      ordered.every(
        (group, index) =>
          group.label === groups[index].label &&
          group.entities.every(
            (entity, item) => entity === groups[index].entities[item],
          ),
      )
    )
      return node;
    return cloneElement(node, { groups: ordered });
  }
  if (!children) return node;
  return cloneElement(node, {
    children: Children.map(children, orderNavigation),
  });
}

export async function Nav(props: Parameters<typeof DefaultNav>[0]) {
  // shortcut: relies on Payload's native groups prop, revisit if its nav renderer changes.
  return orderNavigation(await DefaultNav(props));
}
