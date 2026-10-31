import { locales, type Locale } from "@poetry/i18n";
import { plainTextToRichText } from "../../src/utilities/plainTextToRichText";

/** Editors replace this with the real count; the old shop tracked no stock. */
export const placeholderStock = 10;

type Text = { de: string; en: string };

export interface ShopBook {
  slug: string;
  title: string;
  titleLanguage: "de" | "en";
  /** Cents; 0 only for books that can no longer be bought. */
  priceInEUR: number;
  soldOut?: true;
  isbn?: string;
  pages?: number;
  publisher?: string;
  year?: number;
  coverAlt: Record<Locale, string>;
  coverCredit?: string;
  /** Source paragraphs per locale; locales without original text stay empty. */
  description: Partial<Record<keyof Text, string[]>>;
}

const designCredit = "Gestaltung: 2b4.design";

// Texts and facts from the old WooCommerce shop and thepoetryproject.de, retrieved October 2026.
export const shopBooks: ShopBook[] = [
  {
    slug: "sei-neben-mir-und-sieh-was-mir-geschehen-ist",
    title: "Sei neben mir und sieh, was mir geschehen ist",
    titleLanguage: "de",
    priceInEUR: 2000,
    isbn: "978-3-95732-607-2",
    pages: 240,
    publisher: "Verbrecher Verlag",
    year: 2024,
    coverAlt: {
      de: "Buchcover: weißer Titel „Sei neben mir und sieh, was mir geschehen ist“ in Großbuchstaben auf korallenrotem Grund, darüber „The Poetry Project & PEN Berlin (Hrsg.)“",
      en: "Book cover: the white title “Sei neben mir und sieh, was mir geschehen ist” in capital letters on a coral background, above it “The Poetry Project & PEN Berlin (Hrsg.)”",
      ar: "غلاف الكتاب: العنوان «Sei neben mir und sieh, was mir geschehen ist» بأحرف كبيرة بيضاء على خلفية مرجانية، وفوقه «The Poetry Project & PEN Berlin (Hrsg.)»",
      fa: "جلد کتاب: عنوان «Sei neben mir und sieh, was mir geschehen ist» با حروف بزرگ سفید روی زمینهٔ مرجانی، و بالای آن «The Poetry Project & PEN Berlin (Hrsg.)»",
      uk: "Обкладинка книжки: білий заголовок «Sei neben mir und sieh, was mir geschehen ist» великими літерами на кораловому тлі, над ним «The Poetry Project & PEN Berlin (Hrsg.)»",
      ku: "Berga pirtûkê: sernavê spî «Sei neben mir und sieh, was mir geschehen ist» bi tîpên mezin li ser paşxaneyeke mercanî, li jor «The Poetry Project & PEN Berlin (Hrsg.)»",
    },
    description: {
      de: [
        "Ahmad al Aboud nimmt Instantkaffee mit auf seine Flucht über das Mittelmeer. Mustafa Aliesa ist gerade mal 18 Jahre alt, als er sich in Neukölln ehrenamtlich in einer Suppenküche engagiert. Yama Shahi richtet seine Klage an den Künstler Banksy. Zainab Farahmand vermisst das fröhlich verzweifelte Treiben in Kabuls Straßen. Anastasiia Dunaieva ringt um ihre Muttersprache. Sie alle gehören zu den 32 Dichter*innen, die in diesem Buch festhalten, was sie auf ihrer Flucht erlebten, wie sich ihr Verhältnis zur alten Heimat verändert hat und wie sie, jeder und jede für sich, in Deutschland ankommen möchten. Sie wollen wieder einer Regierung vertrauen, und dass Freiheit keine Worthülse ist. Sie sehnen sich nach den Lebenden und den Toten, die sie zurückgelassen haben. Und entwerfen ein Bild der Zukunft, in der uns mehr verbindet als trennt.",
        "Mit Beiträgen von Jamal Abasi, Bahadȋn Akhan, Ahmad Al Aboud, Mohammad Al-Attar, Mustafa Aliesa, Ali Alzaeem, Navid Arafat, Rahmetullah Berxwedan Andan, Abdulsalam Atto, Kathrin Bach, Fevzi Çetin, Dilber Çıray, Anastasiia Dunaieva, Zainab Farahmand, Matthias Hänsch, Mahdi Hashemi, Shahzamir Hataki, Sara Hauser, Murtaza Hosseini, Sozdar Jafarzadeh, Tayebah Joya, Razia Karimi, Mariia Kaziun, Stela Knezevic, Susanne Koelbl, Dmytro Krasilnikov, Mykhailo Krasilnikov, Nadiia Kulish, Anna Melikova, Javad Mohammadi, Sarina Mohammadi, Nasir Nadeem, Rojin Namer, Nazifullah Nasseri, Yasser Niksada, Iryna Omelyanchuk, Abdul Ahmad Pouya, Theresa Rüger, Natalia Serebrjakowa, Meral Şîmşek, Babak Shafian, Yama Shahi, Anna Velhorn, Uliana Wieseler und Mohamad Zahra",
        "Mit Fotos von Anne Freitag",
        "Das Projekt wird im Rahmen des Bundesprogramms „Demokratie leben!“ vom Bundesministerium für Familie, Senioren, Frauen und Jugend und von der S. Fischer Stiftung gefördert.",
      ],
      en: [
        "In late November 2024, the anthology “Be by My Side and See What Has Happened to Me”, edited by PEN Berlin and The Poetry Project, was published. In it, 29 poets write about what they experienced while fleeing, how their relationship to their former home country has changed, and how each of them, in their own way, hopes to settle in Germany. The texts are in German as well as in their original languages: Arabic, Kurdish, Persian, and Ukrainian.",
      ],
    },
  },
  {
    slug: "ich-wollte-bleiben-ich-ging",
    title: "Ich wollte bleiben. Ich ging.",
    titleLanguage: "de",
    priceInEUR: 2200,
    isbn: "978-3-9821512-0-5",
    pages: 256,
    publisher: "The Poetry Project",
    year: 2019,
    coverAlt: {
      de: "Buchcover: handschriftlicher Titel „Ich wollte bleiben. Ich ging.“ auf spiegelnder Silberfolie mit runder Ausstanzung, darunter „Ein lyrischer Dialog mit Deutschen von morgen“",
      en: "Book cover: the handwritten title “Ich wollte bleiben. Ich ging.” on reflective silver foil with a round cut-out, below it “Ein lyrischer Dialog mit Deutschen von morgen”",
      ar: "غلاف الكتاب: العنوان المكتوب بخط اليد «Ich wollte bleiben. Ich ging.» على رقاقة فضية عاكسة فيها فتحة دائرية، وتحته «Ein lyrischer Dialog mit Deutschen von morgen»",
      fa: "جلد کتاب: عنوان دست‌نویس «Ich wollte bleiben. Ich ging.» روی ورقهٔ نقره‌ای براق با یک برش دایره‌ای، و زیر آن «Ein lyrischer Dialog mit Deutschen von morgen»",
      uk: "Обкладинка книжки: рукописний заголовок «Ich wollte bleiben. Ich ging.» на дзеркальній срібній фользі з круглим вирізом, під ним «Ein lyrischer Dialog mit Deutschen von morgen»",
      ku: "Berga pirtûkê: sernavê bi destan nivîsandî «Ich wollte bleiben. Ich ging.» li ser pelikeke zîvîn a biriqok bi qulikeke girover, li jêr «Ein lyrischer Dialog mit Deutschen von morgen»",
    },
    coverCredit: designCredit,
    description: {
      de: [
        "Für Geflüchtete gilt es, fast alles neu zu lernen, nicht nur die Sprache. Nach dem Verlust ihrer Heimat fallen viele in ein Vakuum und stehen vor der Aufgabe, die innere Leere zu füllen. Wie erginge es uns in einer ähnlichen Situation?",
        "130 lyrische Texte von 106 größtenteils jugendlichen Autor*innen halten auch jenen einen Spiegel vor, die niemals fliehen mussten.",
        "Publikation inkl. aller Gedichte, die 2018 den Else Lasker-Schüler-Lyrikpreis erhielten.",
        "14 Kapitel: Flucht, Heimat, Gewalt, Ankunft, Fremdheit, Familie, Erinnerung, Liebe, Vertrauen, Einsamkeit, Freiheit, »Die Deutschen«, Frauen und Männer, Identität",
      ],
    },
  },
  {
    slug: "i-wanted-to-stay-i-left",
    title: "I wanted to stay. I left.",
    titleLanguage: "en",
    priceInEUR: 2200,
    isbn: "978-3-9821512-1-2",
    pages: 256,
    publisher: "The Poetry Project",
    year: 2019,
    coverAlt: {
      de: "Buchcover: handschriftlicher Titel „I wanted to stay. I left.“ auf spiegelnder Silberfolie mit runder Ausstanzung, darunter „A lyrical dialogue with tomorrow’s Germans“",
      en: "Book cover: the handwritten title “I wanted to stay. I left.” on reflective silver foil with a round cut-out, below it “A lyrical dialogue with tomorrow’s Germans”",
      ar: "غلاف الكتاب: العنوان المكتوب بخط اليد «I wanted to stay. I left.» على رقاقة فضية عاكسة فيها فتحة دائرية، وتحته «A lyrical dialogue with tomorrow’s Germans»",
      fa: "جلد کتاب: عنوان دست‌نویس «I wanted to stay. I left.» روی ورقهٔ نقره‌ای براق با یک برش دایره‌ای، و زیر آن «A lyrical dialogue with tomorrow’s Germans»",
      uk: "Обкладинка книжки: рукописний заголовок «I wanted to stay. I left.» на дзеркальній срібній фользі з круглим вирізом, під ним «A lyrical dialogue with tomorrow’s Germans»",
      ku: "Berga pirtûkê: sernavê bi destan nivîsandî «I wanted to stay. I left.» li ser pelikeke zîvîn a biriqok bi qulikeke girover, li jêr «A lyrical dialogue with tomorrow’s Germans»",
    },
    coverCredit: designCredit,
    description: {
      en: [
        "This publication ineluctably holds up a mirror before those who never had to flee. How would we feel in a similar situation? The refugees have to learn almost everything anew, not only the language. After losing their homeland, many fall into a void, and are faced with the task of filling this vacuum.",
        "The poems collected in the volume “I Wanted to Stay. I Left.” were written by refugees and non-refugees. They deal with loss and loneliness, fear and longing. Yet they likewise address love and common ground, as well as the struggle for mutual understanding. “I wanted to stay. I left.” also holds up a mirror to those who have never had to flee and asks how they would act if they had to.",
      ],
    },
  },
  {
    slug: "allein-nach-europa",
    title: "Allein nach Europa",
    titleLanguage: "de",
    priceInEUR: 800,
    pages: 64,
    publisher: "The Poetry Project",
    coverAlt: {
      de: "Buchcover: Ein junger Mann liest nachts in einem Hinterhof von einem Blatt, darüber der Titel „Allein nach Europa“ und Übersetzungen auf Persisch, Englisch und Arabisch",
      en: "Book cover: a young man reads from a sheet of paper in a courtyard at night, with the title “Allein nach Europa” and translations in Persian, English and Arabic",
      ar: "غلاف الكتاب: شاب يقرأ من ورقة في فناء خلفي ليلًا، وفوقه العنوان «Allein nach Europa» وترجماته إلى الفارسية والإنجليزية والعربية",
      fa: "جلد کتاب: مرد جوانی شب‌هنگام در یک حیاط پشتی از روی برگه‌ای می‌خواند، و بالای آن عنوان «Allein nach Europa» و ترجمه‌هایش به فارسی، انگلیسی و عربی",
      uk: "Обкладинка книжки: юнак уночі читає з аркуша в задньому дворі, над ним заголовок «Allein nach Europa» і переклади перською, англійською та арабською мовами",
      ku: "Berga pirtûkê: xortek bi şev li hewşeke paşîn ji pelekî dixwîne, li jor sernavê «Allein nach Europa» û wergerên wê bi farisî, îngilîzî û erebî",
    },
    coverCredit: designCredit,
    description: {
      de: [
        "Wie wollen wir zusammenleben? Was haben Leute auf der Flucht erlebt? Diese und andere Fragen werden im Band „Allein nach Europa“ diskutiert. Jugendliche aus Afghanistan und dem Iran verfassten Gedichte über Sehnsucht, Schönheit aber auch über Todesangst und Fremdheit. Die sehr persönlichen Texte zeigen, dass unter Sprachlosigkeit, unter den Trümmern des Krieges, immer noch die poetische Seele einer jahrhundertealten Hochkultur lebt, schön und unzerstört. Durch die Gedichte finden Jugendliche ihre Stimme.",
        "Gedichtband »Allein nach Europa« mit Gedichten der Preisträger 2018: Ali Ahmade, Ghani Ataei, Mahdi Hashemi, Shahzamir Hataki, Kahel Kaschmiri, Mohamad Mashghdost, Yasser Niksada und Samiullah Rasouli",
        "Neuauflage der Berliner Anthologie mit 14 Gedichten der Preisträger des Else Lasker-Schüler-Lyrikpreises, übersetzt in 4 Sprachen: Deutsch, Persisch, Englisch, Arabisch.",
      ],
      en: [
        "How do we want to live together? What have people experienced while fleeing their homes? These and other questions are explored in the collection “Alone to Europe”. Young people from Afghanistan and Iran wrote poems about longing and beauty, but also about the fear of death and feeling alienated. These deeply personal texts show that, even amid speechlessness and the ruins of war, the poetic soul of a centuries-old, sophisticated culture still lives on — beautiful and undamaged. Through these poems, young people find their voices.",
        "Collection of poetry with award winning poems by Ali Ahmade, Ghani Ataei, Mahdi Hashemi, Shahzamir Hataki, Kahel Kaschmiri, Mohamad Mashghdost, Yasser Niksada and Samiullah Rasouli",
        "Collection of poetry with 14 Award winning poems in four languages: German, Persian, English, Arabic.",
      ],
    },
  },
  {
    slug: "berliner-anthologie",
    title: "The Poetry Project – Berliner Anthologie",
    titleLanguage: "de",
    priceInEUR: 0,
    soldOut: true,
    pages: 32,
    coverAlt: {
      de: "Buchcover der Berliner Anthologie: ein Mikrofon vor braunem Hintergrund unter dem Titel „The Poetry Project“, mit einem Vorwort von Susanne Koelbl",
      en: "Cover of the Berliner Anthologie: a microphone against a brown background below the title “The Poetry Project”, with a foreword by Susanne Koelbl",
      ar: "غلاف «Berliner Anthologie»: ميكروفون أمام خلفية بنية تحت العنوان «The Poetry Project»، مع تقديم بقلم Susanne Koelbl",
      fa: "جلد «Berliner Anthologie»: یک میکروفون جلوی زمینهٔ قهوه‌ای زیر عنوان «The Poetry Project»، با پیشگفتاری از Susanne Koelbl",
      uk: "Обкладинка «Berliner Anthologie»: мікрофон на коричневому тлі під заголовком «The Poetry Project», з передмовою Susanne Koelbl",
      ku: "Berga «Berliner Anthologie»: mîkrofonek li ber paşxaneyeke qehweyî di bin sernavê «The Poetry Project» de, bi pêşgotineke Susanne Koelbl",
    },
    coverCredit: designCredit,
    description: {},
  },
];

export function productData(book: ShopBook) {
  return {
    title: book.title,
    titleLanguage: book.titleLanguage,
    slug: book.slug,
    generateSlug: false,
    priceInEUR: book.priceInEUR,
    inventory: book.soldOut ? 0 : placeholderStock,
    isbn: book.isbn ?? null,
    pages: book.pages ?? null,
    publisher: book.publisher ?? null,
    year: book.year ?? null,
  };
}

export const productDescriptions = (book: ShopBook) =>
  Object.entries(book.description).map(
    ([locale, paragraphs]) =>
      [
        locale as keyof Text,
        plainTextToRichText(paragraphs.join("\n\n")),
      ] as const,
  );

/** Locales a seeded record still lacks; filled values are never replaced. */
export const emptyLocales = (
  current: Partial<Record<Locale, string | null>> | null | undefined,
) => locales.filter((locale) => !current?.[locale]);
