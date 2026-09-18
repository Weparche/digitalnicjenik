// Single source of truth for the homepage's short, factual product Q&A block.
// Used both for the visible EducationSection content and for the FAQPage JSON-LD
// generated at prerender time (scripts/prerender.mjs) — the two must always match.
// Kept short and factual by design: detailed regulation lives on nepar.hr, not here.

export type ProductFaqEntry = { question: string; answer: string }

export const productFaq: ProductFaqEntry[] = [
  {
    question: 'Što je NEPAR Digitalni cjenik?',
    answer: 'Alat kojim provjerite ima li vaš web javno dostupan strojno čitljiv cjenik, validirate CSV ili XML te po potrebi zatražite da NEPAR sve tehnički postavi.',
  },
  {
    question: 'Što alat provjerava?',
    answer: 'Provjera gleda samo javno dostupne tehničke signale na unesenoj adresi — postoji li dohvatljiv CSV ili XML cjenik. Ne provjerava pravnu usklađenost.',
  },
  {
    question: 'Podržava li XML i CSV?',
    answer: 'Da. Validator prihvaća CSV i XML, a oba izlazna formata generiramo iz jednog normaliziranog zapisa.',
  },
  {
    question: 'Može li se postojeći cjenik automatizirati?',
    answer: 'Da. Ako cijene već vodite u poslovnom sustavu, cilj je da taj sustav ostane izvor istine, a objava na webu se ažurira iz njega bez dvostrukog unosa.',
  },
  {
    question: 'Moram li mijenjati postojeći web?',
    answer: 'Ne nužno. Rješenje se povezuje s postojećim webom (WordPress, Wix, Google Sites, Webflow i drugi) bez potrebe za redizajnom.',
  },
  {
    question: 'Kako započeti?',
    answer: 'Provjerite svoj web besplatno, ili odmah učitajte CSV/XML/Excel cjenik za provjeru — oboje bez registracije.',
  },
]
