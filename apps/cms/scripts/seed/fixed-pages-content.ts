import type { FixedPageKey } from "@poetry/i18n";

// Starting content for the fixed informational pages.
export const fixedPagesContent: Record<
  FixedPageKey,
  Record<"de" | "en", { title: string; content: string; description: string }>
> = {
  about: {
    de: {
      title: "Über uns",
      description:
        "Poesie schafft Raum für Erfahrungen, Begegnung und Verständigung.",
      content: `Wir sind eine gemeinnützige Initiative für literarischen Austausch. Junge Menschen mit Flucht- und Migrationserfahrung finden bei uns Raum, ihre Geschichten, Erinnerungen und Gefühle in Gedichten auszudrücken. Schreiben hilft, Worte für Erlebnisse zu finden, die sich zunächst schwer erzählen lassen.

In Workshops, Schulen und offenen Schreibgruppen entstehen Texte in unterschiedlichen Sprachen. Lesungen, Gespräche, Ausstellungen und Veröffentlichungen bringen die Gedichte zu einem größeren Publikum und ermöglichen Begegnungen.

Unser Verein arbeitet ohne vorrangiges wirtschaftliches Eigeninteresse. Seine Mittel dienen der Bildungsarbeit, dem interkulturellen Dialog und der Unterstützung geflüchteter Menschen durch autobiografisches Schreiben.`,
    },
    en: {
      title: "About us",
      description:
        "Poetry creates space for experiences, connection and understanding.",
      content: `We are a nonprofit initiative for literary exchange. Young people with experiences of displacement and migration find space to express their stories, memories and feelings through poetry. Writing helps them find words for experiences that can initially be difficult to share.

Workshops, schools and open writing groups produce texts in different languages. Readings, discussions, exhibitions and publications introduce the poems to wider audiences and create opportunities to meet.

Our association does not primarily pursue commercial interests. Its resources support education, intercultural dialogue and people with refugee experiences through autobiographical writing.`,
    },
  },
  contact: {
    de: {
      title: "Kontakt",
      description:
        "Kontakt für Schreibworkshops, Zusammenarbeit, Presseanfragen und Fragen zu unserem Poesieprojekt.",
      content: `Du möchtest an einer Schreibgruppe teilnehmen, einen Workshop organisieren oder mit uns zusammenarbeiten? Wir freuen uns auf deine Nachricht. Auch für Fragen zu Lesungen, Veröffentlichungen und unserer Bildungsarbeit sind wir gern für dich da.

Beispiel-Poesieverein
[Anschrift]
[Postleitzahl und Ort]
[Telefonnummer]
kontakt@example.invalid

Ansprechbereiche
Projektleitung und Koordination
Schreibworkshops und Fundraising
Öffentlichkeitsarbeit und Social Media
Bildung, Forschung und Veröffentlichungen
Vorstand und Finanzen`,
    },
    en: {
      title: "Contact",
      description:
        "Get in touch about writing events, collaborations, press enquiries and our poetry project.",
      content: `Would you like to join a writing group, organise a workshop or work with us? We would love to hear from you. You can also contact us about readings, publications and our educational work.

Example Poetry Association
[Street address]
[Postal code and city]
[Telephone number]
contact@example.invalid

Contact areas
Project management and coordination
Writing events and fundraising
Communications and social media
Education, research and publications
Board and finance`,
    },
  },
  privacy: {
    de: {
      title: "Datenschutz",
      description:
        "Informationen zum Umgang mit personenbezogenen Daten und zu deinen Datenschutzrechten.",
      content: `Wir gehen sorgfältig mit deinen personenbezogenen Daten um. Hier erfährst du, welche Daten bei der Nutzung unserer Website verarbeitet werden und an wen du dich mit Fragen wenden kannst.

Verantwortlich
Beispiel-Poesieverein
[Anschrift]
datenschutz@example.invalid

Besuch der Website
Beim Aufruf der Website werden technische Daten wie IP-Adresse, Zeitpunkt des Zugriffs, Browser und Betriebssystem verarbeitet. Sie dienen dazu, die Website bereitzustellen, Fehler zu beheben und ihre Sicherheit zu gewährleisten.

Kontakt
Wenn du uns schreibst, verwenden wir deine Kontaktdaten und den Inhalt deiner Nachricht, um deine Anfrage zu beantworten. Wir geben diese Angaben nicht ohne Anlass an Dritte weiter.

Newsletter und externe Inhalte
Wenn du einen Newsletter abonnierst, verwenden wir deine E-Mail-Adresse für den Versand. Du kannst dich jederzeit abmelden. Beim Aufruf eingebundener Videos oder Karten können die jeweiligen Anbieter technische Daten erhalten; dabei kann eine Verarbeitung außerhalb der EU stattfinden.

Speicherung
Wir speichern personenbezogene Daten nur so lange, wie sie für den jeweiligen Zweck oder aufgrund gesetzlicher Aufbewahrungspflichten benötigt werden.

Deine Rechte
Du kannst Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragung verlangen. Du kannst eine erteilte Einwilligung widerrufen und einer Verarbeitung widersprechen. Außerdem hast du das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für Fragen oder die Ausübung deiner Rechte erreichst du uns unter datenschutz@example.invalid.`,
    },
    en: {
      title: "Privacy",
      description:
        "How we handle personal information and how to exercise your privacy rights.",
      content: `We treat your personal information with care. This notice explains how information is processed when you use our website and who to contact with questions.

Controller
Example Poetry Association
[address]
privacy@example.invalid

Visiting the website
When you visit the website, technical information such as your IP address, access time, browser and operating system is processed. This helps us deliver the website, resolve errors and maintain its security.

Contact
When you write to us, we use your contact details and the information in your message to answer your enquiry. We do not share these details with third parties without a reason.

Newsletters and external content
If you subscribe to a newsletter, we use your email address to send it. You can unsubscribe at any time. When you access embedded videos or maps, their providers may receive technical information and may process it outside the EU.

Retention
We keep personal information only for as long as it is needed for its purpose or to meet statutory retention requirements.

Your rights
You may request access, correction, deletion, restriction of processing and data portability. You may withdraw consent and object to processing. You also have the right to complain to a data protection authority. To ask a question or exercise your rights, contact us at privacy@example.invalid.`,
    },
  },
  legal: {
    de: {
      title: "Impressum",
      description:
        "Angaben zum Verein, zur Vertretung und zur redaktionellen Verantwortung für diese Website.",
      content: `Anbieter
Beispiel-Poesieverein
Gemeinnütziger Verein
[Anschrift]
[Postleitzahl und Ort]
Deutschland

Kontakt
kontakt@example.invalid
[Telefonnummer]

Vertretung und redaktionelle Verantwortung
[Vorstand und vertretungsberechtigte Personen]
[Redaktionell verantwortliche Person und Anschrift]

Vereinsregister
[Registergericht]
[Registernummer]

Gestaltung und Entwicklung
[Gestaltungs- und Entwicklungsteam]

Verbraucherstreitbeilegung
Wir sind weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.`,
    },
    en: {
      title: "Legal notice",
      description:
        "Association details, authorised representatives and editorial responsibility for this website.",
      content: `Provider
Example Poetry Association
Nonprofit association
[Street address]
[Postal code and city]
Germany

Contact
contact@example.invalid
[Telephone number]

Representation and editorial responsibility
[Board and authorized representatives]
[Person responsible for editorial content and address]

Association register
[Registry court]
[Registration number]

Design and development
[Design and development team]

Consumer dispute resolution
We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration body.`,
    },
  },
  terms: {
    de: {
      title: "AGB & Widerrufsbelehrung",
      description:
        "Allgemeine Geschäftsbedingungen und Widerrufsbelehrung für Bestellungen im Shop.",
      content: `AGB & Widerrufsbelehrung — Platzhalter, vom Verein zu ersetzen

Geltungsbereich und Vertragspartner
Beispiel-Poesieverein
[Anschrift]
[Postleitzahl und Ort]
shop@example.invalid

Vertragsschluss
[Wie eine Bestellung zustande kommt]

Preise, Versand und Zahlung
[Preise, Umsatzsteuer, Versand innerhalb Deutschlands und Zahlungsarten]

Widerrufsbelehrung
[Widerrufsrecht, Widerrufsfrist und Folgen des Widerrufs]

Muster-Widerrufsformular
[Muster-Widerrufsformular]`,
    },
    en: {
      title: "Terms of sale & withdrawal",
      description:
        "Terms and conditions and the right of withdrawal for orders from our shop.",
      content: `Terms of sale & right of withdrawal — placeholder, to be replaced by the association

Scope and contracting party
Example Poetry Association
[Street address]
[Postal code and city]
shop@example.invalid

Conclusion of contract
[How an order becomes a contract]

Prices, shipping and payment
[Prices, VAT, shipping within Germany and payment methods]

Right of withdrawal
[Right of withdrawal, withdrawal period and consequences of withdrawal]

Model withdrawal form
[Model withdrawal form]`,
    },
  },
};
