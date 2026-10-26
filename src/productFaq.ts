// Single source of truth for the homepage's short, factual product Q&A block.
// Used both for the visible EducationSection content and for the FAQPage JSON-LD
// generated at prerender time (scripts/prerender.mjs) — the two must always match.
// Kept short and factual by design: the full question list lives on /faq/.


export type ProductFaqEntry = { question: string; answer: string }

export const productFaq: ProductFaqEntry[] = [
  {
    question: 'Što je NEPAR Publisher?',
    answer:
      'Digitalni cjenik koji ne samo da objavi CSV/XML datoteku, nego provjerava da je ispravna: validacija Excela/CSV-a, javni cjenik s arhivom od 30 dana, svakodnevni nadzor usklađenosti i e-mail upozorenje čim nešto nije u redu.',
  },
  {
    question: 'Za koga je Publisher?',
    answer:
      'Za pružatelje usluga i male trgovce s vlastitom web stranicom koji žele da netko provjerava njihovu objavu. Ako vaš ERP ili blagajna već objavljuje cjenik (primjerice Marketino, Minimax ili Pantheon), provjerite to kod pružatelja prije kupnje.',
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
    answer: 'Provjera weba i validator su besplatni. Nakon probne objave možete odabrati godišnji paket Link, Publisher ili Web + Publisher. Paketi i godišnje cijene vidljivi su na početnoj stranici bez prethodne provjere, a dostupni su i na stranici Cijene. Pomoć s ugradnjom na postojeći web dogovara se zasebno.',
  },
  {
    question: 'Kako započeti?',
    answer: 'Učitajte Excel/CSV/XML besplatno ili provjerite svoj web — zatim 7-dnevni probni bez registracije unaprijed.',
  },
]
