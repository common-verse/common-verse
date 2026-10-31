import { getLocaleMetadata, localizedPath, type Locale } from "@poetry/i18n";
import { plainTextToRichText } from "../../src/utilities/plainTextToRichText";
import content from "./programme-content.json";

export type ProgrammeEvent = (typeof content)[number];
const labels = {
  de: {
    programme: "Das erwartet dich",
    practical: "Gut zu wissen",
    invitation: "Gemeinsam lesen, schreiben und zuhören",
    participation:
      "Du kannst in deiner vertrauten Sprache teilnehmen. Vorkenntnisse sind nicht nötig, und das Teilen eigener Texte ist freiwillig.",
    note: "Der Eintritt ist frei. Für eine Anmeldung oder Fragen zu Sprache, Anreise und Zugänglichkeit erreichst du uns über die Kontaktseite.",
    contact: "Kontakt und Anmeldung",
    prompts: [
      "Ankommen und den Gedanken des Nachmittags kennenlernen",
      "Texte hören, eigene Gedanken notieren und miteinander ins Gespräch kommen",
      "Zum Abschluss freiwillig einen Satz oder eine Frage teilen",
    ],
  },
  en: {
    programme: "What to expect",
    practical: "Good to know",
    invitation: "Read, write, and listen together",
    participation:
      "Take part in the language you feel most comfortable with. No experience is needed, and sharing your own writing is always optional.",
    note: "Admission is free. For registration or questions about language, travel, and access, please use our contact page.",
    contact: "Contact and registration",
    prompts: [
      "Arrive and explore the theme of the session",
      "Listen to texts, make notes, and exchange ideas",
      "Optionally share one sentence or question to close",
    ],
  },
  ar: {
    programme: "ماذا ينتظرك؟",
    practical: "معلومات عملية",
    invitation: "نقرأ ونكتب ونصغي معًا",
    participation:
      "يمكنك المشاركة باللغة التي ترتاح لها. لا تحتاج إلى خبرة سابقة، ومشاركة نصوصك اختيارية دائمًا.",
    note: "الدخول مجاني. للتسجيل أو للاستفسار عن اللغة والوصول وإمكانية المشاركة، تواصل معنا عبر صفحة الاتصال.",
    contact: "التواصل والتسجيل",
    prompts: [
      "نستقبل المشاركين ونتعرّف إلى موضوع اللقاء",
      "نستمع إلى النصوص وندوّن أفكارنا ونتحاور",
      "نشارك جملة أو سؤالًا في الختام لمن يرغب",
    ],
  },
  fa: {
    programme: "در این دیدار",
    practical: "اطلاعات کاربردی",
    invitation: "با هم می‌خوانیم، می‌نویسیم و گوش می‌دهیم",
    participation:
      "می‌توانید به زبانی که با آن راحت‌ترید شرکت کنید. تجربهٔ قبلی لازم نیست و خواندن نوشته‌های خودتان همیشه اختیاری است.",
    note: "ورود رایگان است. برای ثبت‌نام یا پرسش دربارهٔ زبان، مسیر و دسترسی، از صفحهٔ تماس با ما ارتباط بگیرید.",
    contact: "تماس و ثبت‌نام",
    prompts: [
      "آشنایی با یکدیگر و موضوع دیدار",
      "شنیدن متن‌ها، یادداشت‌برداری و گفت‌وگو",
      "در پایان، به‌اشتراک‌گذاشتن یک جمله یا پرسش به دلخواه",
    ],
  },
  uk: {
    programme: "Що на вас чекає",
    practical: "Корисна інформація",
    invitation: "Читаємо, пишемо та слухаємо разом",
    participation:
      "Беріть участь мовою, якою вам зручно. Попередній досвід не потрібен, а ділитися власними текстами можна за бажанням.",
    note: "Вхід вільний. Для реєстрації або запитань про мову, дорогу чи доступність скористайтеся сторінкою контактів.",
    contact: "Контакти та реєстрація",
    prompts: [
      "Знайомство та розмова про тему зустрічі",
      "Слухаємо тексти, занотовуємо думки й обмінюємося ідеями",
      "На завершення за бажанням ділимося реченням або запитанням",
    ],
  },
  ku: {
    programme: "Di vê hevdîtinê de",
    practical: "Agahiyên pratîk",
    invitation: "Bi hev re bixwînin, binivîsin û guh bidin",
    participation:
      "Hûn dikarin bi zimanê ku hûn pê rehet in beşdar bibin. Ne hewce ye ezmûna we hebe û parvekirina nivîsên xwe her tim bi dilê we ye.",
    note: "Ketina bûyerê belaş e. Ji bo qeydkirinê an pirsên li ser ziman, hatin û gihîştinê, rûpela têkiliyê bi kar bînin.",
    contact: "Têkilî û qeydkirin",
    prompts: [
      "Nasîn û destpêkirina mijara hevdîtinê",
      "Guhdayîna nivîsan, nivîsandina ramanan û sohbet",
      "Di dawiyê de bi dilê xwe hevokek an pirsek parve bikin",
    ],
  },
} satisfies Record<Locale, unknown>;

export function programmeRichText(
  event: ProgrammeEvent,
  locale: Locale,
  index: number,
  imageId: number,
) {
  const copy = event.text[locale];
  const expanded =
    locale === "de" ? event.text.de : locale === "en" ? event.text.en : null;
  const ui = labels[locale];
  const direction = getLocaleMetadata(locale).direction;
  const p = (value: string) => ({
    ...plainTextToRichText(value).root.children[0],
    direction,
  });
  const h = (value: string, tag = "h2") => ({
    ...p(value),
    type: "heading",
    tag,
  });
  const list = (items: string[], ordered: boolean) => ({
    ...p(""),
    type: "list",
    tag: ordered ? "ol" : "ul",
    listType: ordered ? "number" : "bullet",
    start: 1,
    children: items.map((value, i) => ({
      ...p(value),
      type: "listitem",
      value: i + 1,
    })),
  });
  const paragraphs = expanded?.body ?? [copy.description, ui.participation];
  const quote = expanded?.quote;
  const programme = expanded?.programme ?? ui.prompts;
  const blocks = [p(paragraphs[0])];
  if (index % 5 === 0)
    for (const node of blocks[0].children)
      if (node.format !== undefined) node.format = 1;
  const children = [
    ...blocks,
    ...(quote && index % 3 === 0 ? [{ ...p(quote), type: "quote" }] : []),
    h(ui.programme),
    list(
      programme,
      ["workshop", "zine", "shortforms", "translation", "letter"].includes(
        event.style,
      ),
    ),
    ...(index % 4 === 1
      ? [
          {
            type: "upload",
            version: 3,
            relationTo: "media",
            value: imageId,
            fields: null,
          },
        ]
      : []),
    p(paragraphs[1] ?? ui.participation),
    ...(quote && index % 3 === 1
      ? [{ ...p(quote), format: "center" as const }]
      : []),
    ...(index % 4 === 2 ? [{ type: "horizontalrule", version: 1 }] : []),
    h(ui.practical, "h3"),
    p(ui.note),
    {
      ...p(""),
      children: [
        {
          type: "link",
          version: 3,
          direction,
          format: "" as const,
          indent: 0,
          fields: {
            linkType: "custom",
            url: localizedPath(locale, "contact"),
            newTab: false,
          },
          children: plainTextToRichText(ui.contact).root.children[0].children,
        },
      ],
    },
  ];
  return { root: { ...plainTextToRichText("").root, direction, children } };
}
