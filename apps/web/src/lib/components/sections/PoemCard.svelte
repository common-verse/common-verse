<script lang="ts">
  import { localizedPath, type Locale } from "@poetry/i18n";
  import type { LegacyPoem } from "@poetry/types";
  import { Heading } from "$lib/components/ui/heading";
  import { Link } from "$lib/components/ui/link";
  import { authorDisplayName } from "$lib/editorial";
  import { contentDirection, poemExcerpt } from "$lib/homepage";
  import * as m from "../../../paraglide/messages.js";

  let { poem, locale }: { poem: LegacyPoem; locale: Locale } = $props();
  const excerpt = $derived(poemExcerpt(poem, locale));
  const author = $derived(typeof poem.author === "object" ? poem.author : null);
  const href = $derived(localizedPath(locale, `poems/${poem.slug}`));
</script>

<article>
  <div
    lang={poem.originalLanguage === "other" ? "und" : poem.originalLanguage}
    dir={contentDirection(poem.originalLanguage)}
  >
    <Heading level={3}
      ><Link variant="heading" {href}>{poem.title}</Link></Heading
    >
    <p class="verse">{excerpt.original}</p>
  </div>
  {#if excerpt.translation && poem.originalLanguage !== locale}
    <div
      class="feature-translation"
      lang={locale}
      dir={contentDirection(locale)}
    >
      <Heading level={3}
        ><Link variant="heading" {href}>{excerpt.translation.title}</Link
        ></Heading
      >
      <p class="verse">
        {excerpt.translation.text.split("\n").slice(0, 5).join("\n")}
      </p>
      {#if excerpt.translation.translator}
        <p class="translation-credit">
          {m.translated_by(
            { name: excerpt.translation.translator },
            { locale },
          )}
        </p>
      {/if}
    </div>
  {/if}
  {#if author}<p class="feature-author">
      {authorDisplayName(author.name)}
    </p>{/if}
</article>
