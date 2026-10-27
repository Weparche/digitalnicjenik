// Single source of truth for the homepage's short, factual product Q&A block.
// Used both for the visible EducationSection content and for the FAQPage JSON-LD
// generated at prerender time (scripts/prerender.mjs) — the two must always match.
// Kept short and factual by design: the full question list lives on /faq/.


import { installationPriceLabel } from '../shared/pricing'

export type ProductFaqEntry = { question: string; answer: string }

export const productFaq: ProductFaqEntry[] = [
  {
    question: 'Što je NEPAR digitalni cjenik?',
    answer:
      'Sloj za objavu digitalnog cjenika uz web koji već imate: javni cjenik na stalnoj poveznici, CSV i XML te arhiva prethodnih verzija 30 dana. Publisher je digitalni cjenik koji ne samo da objavi CSV/XML datoteku, nego provjerava da je ispravna, svakodnevnim nadzorom i e-mail upozorenjem.',
  },
  {
    question: 'Radi li s WordPressom i webshopom?',
    answer:
      'Da. Web Link radi na WordPressu, WooCommerceu, Shopifyju, Wixu, Webflowu i vlastitom webu: dobivenu poveznicu dodate kao gumb, stavku izbornika ili običan link. Povezivanje s webshopom ili poslovnim sustavom radimo po individualnoj ponudi.',
  },
  {
    question: 'Trebam li instalirati plugin?',
    answer: 'Ne za osnovni Web Link. Ne mijenjate postojeći web osim što dodate poveznicu. Ako vaš ERP ili blagajna već objavljuje cjenik, provjerite to kod pružatelja prije kupnje.',
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
    answer: `Provjera weba i validator su besplatni. Nakon probne objave možete odabrati godišnji paket Web Link, Publisher ili Web + Publisher. Paketi i godišnje cijene vidljivi su na početnoj stranici bez prethodne provjere, a dostupni su i na stranici Cijene. Pomoć s ugradnjom na postojeći web stoji ${installationPriceLabel()}.`,
  },
  {
    question: 'Kako započeti?',
    answer: 'Učitajte Excel/CSV/XML besplatno ili provjerite svoj web — zatim 7-dnevni probni bez registracije unaprijed.',
  },
]
