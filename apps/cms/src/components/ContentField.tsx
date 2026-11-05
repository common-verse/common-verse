"use client";

import { getLocaleMetadata, isLocale } from "@poetry/i18n";
import {
  TextField,
  TextareaField,
  useFormFields,
  useLocale,
} from "@payloadcms/ui";
import type { TextFieldClientProps, TextareaFieldClientProps } from "payload";
import { useEffect, useRef, type ReactNode } from "react";

function useContentLanguage(
  props: (TextFieldClientProps | TextareaFieldClientProps) & {
    languageField?: string;
  },
) {
  const locale = useLocale();
  const languageField = props.languageField;
  const siblingPath = props.path.split(".").slice(0, -1).join(".");
  const language = useFormFields(([fields]) =>
    languageField
      ? fields[[siblingPath, languageField].filter(Boolean).join(".")]?.value
      : undefined,
  );
  return typeof language === "string" && isLocale(language)
    ? language
    : languageField
      ? "und"
      : locale.code;
}

function ContentLanguage({
  language,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Payload's input components expose direction but no language attribute.
    const input = ref.current?.querySelector("input, textarea");
    if (input) {
      input.setAttribute("lang", language);
      input.setAttribute(
        "dir",
        isLocale(language) ? getLocaleMetadata(language).direction : "auto",
      );
    }
  }, [language]);
  return (
    <div ref={ref} className="content-language" style={{ display: "contents" }}>
      {children}
    </div>
  );
}

export function ContentText(
  props: TextFieldClientProps & { languageField?: string },
) {
  const language = useContentLanguage(props);
  const rtl =
    isLocale(language) && getLocaleMetadata(language).direction === "rtl";
  return (
    <ContentLanguage language={language}>
      <TextField
        {...props}
        field={{ ...props.field, admin: { ...props.field.admin, rtl } }}
      />
    </ContentLanguage>
  );
}

/** Translators credit translations, so the poem's original language has none. */
export function TranslatorText(props: TextFieldClientProps) {
  const locale = useLocale();
  const original = useFormFields(([fields]) => fields.originalLanguage?.value);
  return original === locale.code ? null : <ContentText {...props} />;
}

export function ContentTextarea(
  props: TextareaFieldClientProps & { languageField?: string },
) {
  const language = useContentLanguage(props);
  const rtl =
    isLocale(language) && getLocaleMetadata(language).direction === "rtl";
  return (
    <ContentLanguage language={language}>
      <TextareaField
        {...props}
        field={{ ...props.field, admin: { ...props.field.admin, rtl } }}
      />
    </ContentLanguage>
  );
}
