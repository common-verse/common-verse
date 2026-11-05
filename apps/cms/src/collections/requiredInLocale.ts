import { message, type MessageKey } from "@poetry/cms-ui";
import type {
  CollectionSlug,
  TextFieldSingleValidation,
  TypedLocale,
} from "payload";

/**
 * Requires a localized value in one locale, e.g. German or the poem's original language.
 * Publishing from another locale checks that locale's stored value, drafts included.
 * Drafts skip validation, so this applies on publish.
 */
export const requiredInLocale =
  (
    field: string,
    localeOf: (data: Record<string, unknown>) => unknown,
    error: MessageKey,
  ): TextFieldSingleValidation =>
  async (value, { collectionSlug, data, event, id, req }) => {
    const locale = localeOf(data as Record<string, unknown>);
    if (typeof locale !== "string") return true;
    const invalid = message(error, req.i18n.language);
    if (req.locale === locale) return value ? true : invalid;
    if (event === "onChange") return true;
    if (id === undefined) return invalid;
    const stored = await req.payload.findByID({
      collection: collectionSlug as CollectionSlug,
      id,
      locale: locale as TypedLocale,
      fallbackLocale: false,
      draft: true,
      depth: 0,
      disableErrors: true,
      select: { [field]: true },
      // A copy, because the Local API overwrites the request's locale.
      req: { ...req },
    });
    return (stored as Record<string, unknown> | null)?.[field] ? true : invalid;
  };
