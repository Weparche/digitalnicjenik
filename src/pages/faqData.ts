import { PLANS, formatEur } from '../publisherPricing'
// Single source for the /faq page and its FAQPage JSON-LD (rendered in scripts/prerender.mjs).
// Answers are plain text so the visible copy and the structured data can never drift apart.
// Regulatory statements follow NN 101/2026 (Odluke 1212 i 1213), the Government's 29.9.2026 amendment
// and the Ministry's written clarifications; draft rules are labelled as drafts.

export type FaqEntry = { question: string; answer: string }
export type FaqGroup = { id: string; title: string; entries: FaqEntry[] }

export const faqGroups: FaqGroup[] = [
  {
    id: 'obveza',
    title: 'Obveza i rokovi',
    entries: [
      {
        question: 'Što je digitalni cjenik?',
        answer:
          'Digitalni cjenik je važeći cjenik proizvoda ili usluga objavljen na mrežnoj stranici trgovca odnosno pružatelja usluga u strojno čitljivom CSV ili XML obliku, tako da ga programi mogu automatski dohvatiti. PDF, slika ili obična HTML tablica ne zadovoljavaju taj zahtjev.',
      },
      {
        question: 'Do kada treba objaviti digitalni cjenik?',
        answer:
          'Vlada je 29. rujna 2026. pomaknula primjenu obje odluke (o dodatnoj cijeni i o objavi cjenika) s 1. listopada na 17. studenoga 2026. Referentni datumi ostaju 10. rujna 2026. te, za ranije obuhvaćene skupine proizvoda, 2. svibnja 2025.',
      },
      {
        question: 'Tko mora objaviti digitalni cjenik?',
        answer:
          'Trgovci na malo i pružatelji registriranih usluga koji imaju mrežnu stranicu. Ministarstvo je pojasnilo da se obveza odnosi i na informativne ili prezentacijske stranice bez web shopa, dok profil na društvenoj mreži nije mrežna stranica za tu svrhu.',
      },
      {
        question: 'Moram li imati digitalni cjenik ako nemam web stranicu?',
        answer:
          'Obveza objave na webu odnosi se na one koji imaju uspostavljenu mrežnu stranicu. Ministar gospodarstva pojasnio je da oni koji je nemaju ne moraju izrađivati novu, a društvene mreže ne smatraju se web stranicom. Isticanje dodatne cijene u prostoru i oglašavanju ostaje zasebna obveza.',
      },
      {
        question: 'Mijenja li se nešto s novim pravilnicima?',
        answer:
          'Dva nacrta pravilnika (o načinu isticanja bazne cijene i o sadržaju i načinu objave cjenika proizvoda) na e-Savjetovanju su od 14. listopada do 13. studenoga 2026. Ministarstvo planira stupanje na snagu 17. studenoga 2026. Nacrti predviđaju, među ostalim, evidentiranje promjene sljedeći radni dan do 11 sati, ali to su prijedlozi, ne konačna pravila.',
      },
    ],
  },
  {
    id: 'sadrzaj',
    title: 'Što cjenik mora sadržavati',
    entries: [
      {
        question: 'Što je sidrena (dodatna) cijena?',
        answer:
          'Uz aktualnu maloprodajnu cijenu mora se istaknuti i dodatna, popularno nazvana sidrena cijena: referentna cijena iz propisanog datuma, bez posebnih oblika prodaje. Služi informiranju potrošača i nije nova prodajna cijena. Može biti jednaka aktualnoj cijeni.',
      },
      {
        question: 'Koji su referentni datumi za sidrenu cijenu?',
        answer:
          'Za robu i usluge koje su novo obuhvaćene referentna je cijena važeća 10. rujna 2026. Za skupine koje su već bile u režimu iz 2025. (primjerice hrana, piće, kozmetika, sredstva za čišćenje i proizvodi za kućanstvo) i dalje se koristi 2. svibnja 2025. Točan popis provjerite u tekstu Odluke.',
      },
      {
        question: 'Koja polja mora imati cjenik usluga?',
        answer:
          'Naziv usluge, maloprodajnu cijenu, podatak o posebnom obliku prodaje (uključujući njegov naziv ako postoji) i sidrenu odnosno dodatnu cijenu.',
      },
      {
        question: 'Koja polja mora imati cjenik proizvoda?',
        answer:
          'Među ostalim naziv, šifru, marku, maloprodajnu i sidrenu cijenu, podatke o posebnom obliku prodaje, barkod te dostupnost, kao i jedinice i cijenu po jedinici gdje se primjenjuju. Obvezna polja čitajte iz službenog teksta Odluke.',
      },
      {
        question: 'Propisuje li Odluka nazive stupaca u CSV-u?',
        answer:
          'Ne. Odluka propisuje podatke koje cjenik mora sadržavati, ali ne imena stupaca, separator ni kodiranje. Zato je važno da je struktura dosljedna i strojno čitljiva. Naš primjer strukture pogledajte u specifikaciji CSV/XML.',
      },
      {
        question: 'Kako se mora zvati datoteka cjenika?',
        answer:
          'Odluka zasebno propisuje naziv datoteke: treba uključivati oblik prodajnog odnosno uslužnog objekta, adresu, oznaku objekta, broj pohrane i vremensku oznaku. NEPAR Publisher naziv generira automatski, primjerice usluzni-objekt_ulica-1_p-01_8_20261117-064500.csv.',
      },
    ],
  },
  {
    id: 'objava',
    title: 'Objava, arhiva i ažuriranje',
    entries: [
      {
        question: 'Koliko često treba ažurirati cjenik?',
        answer:
          'Prema važećim odlukama trgovci na malo ažuriraju cjenik jednom dnevno, najkasnije do 8:00 za tekući radni dan, a pružatelji usluga nakon promjene cijene, najkasnije do 8:00 na dan objave izmjene. Nacrti pravilnika predlažu drukčiji ritam, ali još nisu doneseni.',
      },
      {
        question: 'Koliko dugo prethodni cjenici moraju ostati dostupni?',
        answer:
          'Najmanje 30 dana nakon objave novog cjenika. To znači arhivu verzija, a ne prepisivanje jedne datoteke bez povijesti.',
      },
      {
        question: 'Što znači automatizirani dohvat podataka?',
        answer:
          'Cjenik mora biti objavljen tako da ga programi mogu preuzeti bez ručnog prepisivanja. Ministarstvo navodi da se ta obveza u praksi ispunjava javnom objavom CSV ili XML cjenika na mrežnoj stranici, na stabilnom URL-u.',
      },
      {
        question: 'Imam više poslovnica. Treba li zaseban cjenik za svaku?',
        answer:
          'Da. Prema pojašnjenju Ministarstva za svaku lokaciju objavljuje se zasebna CSV ili XML datoteka, čak i ako su cijene jednake. Za lanac objekata struktura datoteka mora biti jedinstvena.',
      },
      {
        question: 'Imam web shop. Treba li zaseban cjenik?',
        answer: 'Da, za web shop se objavljuje zasebna CSV ili XML datoteka.',
      },
    ],
  },
  {
    id: 'publisher',
    title: 'NEPAR Publisher',
    entries: [
      {
        question: 'Što je NEPAR Publisher?',
        answer:
          'Digitalni cjenik koji ne samo da objavi datoteku, nego provjerava da je ispravna: učitate Excel, CSV ili XML, dobijete javni CSV/XML na stabilnom URL-u s arhivom, svakodnevni nadzor usklađenosti i e-mail upozorenje čim nešto nije u redu.',
      },
      {
        question: 'Što točno nadzor provjerava?',
        answer:
          'Svaki dan provjeravamo dostupnost, broj zapisa i sva polja koja CSV/XML prenosi iz objavljene verzije. Provjeravamo i naziv datoteke, obvezne podatke te obje datoteke svake verzije unutar roka arhiviranja od zamjene. Uz jutarnju provjeru i ponovni pokušaj postoji provjera nakon roka; za aktualnost koristimo kalendar objekta. Pravila se ažuriraju nakon provjere konačnog teksta novog propisa.',
      },
      {
        question: 'Kako i kada dobivam upozorenje?',
        answer:
          'E-mailom vlasniku računa kad provjera otkrije kritičan problem, primjerice da XML vraća grešku ili da broj stavki ne odgovara. Blaža upozorenja vidite u nadzornoj ploči, a kad se problem riješi, stiže obavijest o oporavku.',
      },
      {
        question: 'Podržava li NEPAR cjenike proizvoda, a ne samo usluga?',
        answer:
          'Da. Za proizvode podržavamo polja iz čl. III Odluke: naziv, šifru, marku, jedinicu mjere i cijenu za jedinicu mjere (gdje je primjenjivo), maloprodajnu cijenu s posebnim oblikom prodaje, sidrenu cijenu, barkod i dostupnost. Podatke učitavate iz Excela, CSV-a ili XML-a (prepoznajemo i izvoz iz WooCommercea), do 5 000 stavki po cjeniku. Izravni uvoz iz ERP-a ili blagajne zasad nemamo.',
      },
      {
        question: 'Koliko košta NEPAR Publisher?',
        answer:
          `Provjera weba, validator i pretvorba Excela besplatni su, uz 7-dnevni probni rok. Godišnji paketi: ${PLANS.map(p => `${p.name} ${formatEur(p.price, true)}`).join(', ')}. Pomoć s ugradnjom na postojeći web dogovara se zasebno.`,
      },
      {
        question: 'Što se događa nakon probnog roka ako ne aktiviram Publisher?',
        answer:
          'Aktualni javni URL se gasi (HTTP 410). Ranije zamijenjene verzije ostaju u javnoj arhivi do isteka svojeg roka dostupnosti, osim u slučaju suspenzije. Podaci za obnovu ostaju spremljeni; nakon aktivacije isti aktualni URL ponovno radi.',
      },
      {
        question: 'Kako se plaća?',
        answer:
          'Po ponudi, uplatom na račun. Licenca se aktivira nakon što uplata bude evidentirana i vrijedi godinu dana.',
      },
      {
        question: 'Mogu li cjenik ugraditi na postojeću web stranicu?',
        answer:
          'Da. Dobivate kratku skriptu za ugradnju cjenika u stranicu, QR kod i prikaz za ispis na A4 (iz preglednika se sprema i kao PDF).',
      },
      {
        question: 'Je li NEPAR pravni savjet ili jamstvo usklađenosti?',
        answer:
          'Ne. NEPAR pruža tehničku provjeru i evidenciju objave. Obvezujuće tumačenje daju službeni propisi i nadležna tijela, a odgovornost za točnost cijena ostaje na trgovcu odnosno pružatelju usluga.',
      },
    ],
  },
]

export const allFaqEntries: FaqEntry[] = faqGroups.flatMap((group) => group.entries)
