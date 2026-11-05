"use client";

import {
  Button,
  RelationshipField,
  useDocumentDrawer,
  useField,
  useFormFields,
  useTranslation,
} from "@payloadcms/ui";
import { message } from "@poetry/cms-ui";
import type { RelationshipFieldClientProps } from "payload";
import { useEffect, useRef } from "react";

/** Native city picker; creating a city prefills the author's country, which Payload's own create button cannot. */
export function CityField(props: RelationshipFieldClientProps) {
  const { i18n } = useTranslation();
  const country = useFormFields(([fields]) => fields.country?.value) as
    | string
    | undefined;
  const { setValue } = useField({ path: props.path });
  const previousCountry = useRef(country);
  const [CityDrawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({
    collectionSlug: "cities",
  });

  useEffect(() => {
    // A city from the previous country no longer matches.
    if (previousCountry.current && previousCountry.current !== country)
      setValue(null);
    previousCountry.current = country;
  }, [country, setValue]);

  return (
    <div className="field-type">
      <RelationshipField
        {...props}
        field={{
          ...props.field,
          admin: { ...props.field.admin, allowCreate: false },
        }}
      />
      <Button
        buttonStyle="secondary"
        size="small"
        margin={false}
        disabled={!country || props.readOnly}
        onClick={openDrawer}
      >
        {message("create_city", i18n.language)}
      </Button>
      <CityDrawer
        key={country}
        initialData={{ country }}
        redirectAfterCreate={false}
        onSave={({ doc }) => {
          setValue(doc.id);
          closeDrawer();
        }}
      />
    </div>
  );
}
