// Single source of truth for the homepage's short, factual product Q&A block.
// Used both for the visible EducationSection content and for the FAQPage JSON-LD
// generated at prerender time (scripts/prerender.mjs) — the two must always match.
// Kept short and factual by design: detailed regulation lives on nepar.hr, not here.

import { launchOfferDetail, regularSelfServicePriceLabel } from './publisherPricing'

export type ProductFaqEntry = { question: string; answer: string }

export const productFaq: ProductFaqEntry[] = [
  {
    question: 'Što je NEPAR Publisher?',
    answer:
      'Publishing layer između vašeg Excel/CSV cjenika i javnog weba: provjera podataka, propisani CSV/XML, aktualni link za dohvat i verzioniranje objava. MIKROeRAČUN pokriva eRačune; Publisher pokriva cjenik na mrežnoj stranici.',
  },
  {
    question: 'Za koga je Publisher?',
    answer:
      'Za malog poduzetnika izvan sustava PDV-a koji koristi ili planira MIKROeRAČUN, ima vlastitu web stranicu i nema komercijalni POS/ERP koji mu već objavljuje cjenik. Ako imate Marketino, Minimax ili Pantheon — provjerite kod providera prije kupnje.',
  },
  {
    question: 'Što alat provjerava na webu?',
    answer:
      'Provjera gleda javno dostupne signale na unesenoj adresi — postoji li dohvatljiv CSV ili XML cjenik. Ne provjerava pravnu usklađenost cijelog poslovanja.',
  },
  {
    question: 'Podržava li Excel, XML i CSV?',
    answer: 'Da. Validator prihvaća CSV i XML, Excel pretvorite u istom alatu. Oba izlazna formata dolaze iz jednog normaliziranog zapisa.',
  },
  {
    question: 'Što dobivam u probnom roku?',
    answer:
      'Nakon potvrde e-maila dobivate stvarni javni link /c/vaš-slug, CSV/XML feedove i dashboard. Ako ne aktivirate Publisher u 7 dana, javni URL se gasi — podaci ostaju.',
  },
  {
    question: 'Koliko košta nakon probe?',
    answer: `${launchOfferDetail()} Postavljanje na web: prva godina uključuje Publisher, zatim ${regularSelfServicePriceLabel()}.`,
  },
  {
    question: 'Kako započeti?',
    answer: 'Učitajte Excel/CSV/XML besplatno ili provjerite svoj web — zatim 7-dnevni probni bez registracije unaprijed.',
  },
]
