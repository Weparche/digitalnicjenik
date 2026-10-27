// Content migrated from nepar.hr; historical prices are never inferred from notes.
export const anchorGuide = {
  "lead": "Odluka NN 101/2026-1212 o isticanju dodatne cijene primjenjuje se od 17. studenoga 2026. (Vlada je 29. rujna 2026. pomaknula rok s 1. listopada). U javnosti se ta referentna cijena često naziva sidrena cijena. To je zasebna obveza od objave XML/CSV digitalnog cjenika iz Odluke 1213.",
  "sections": [
    {
      "heading": "Što je sidrena odnosno dodatna cijena?",
      "paragraphs": [
        "Odluka NN 101/2026-1212 propisuje isticanje dodatne maloprodajne cijene uz važeću cijenu proizvoda ili usluge. Za većinu proizvoda i usluga referentna je cijena koja je bila na snazi 10. rujna 2026.",
        "Iznimka: trgovci odnosno pružatelji usluga koji su prema ranijoj mjeri već isticali dodatnu cijenu za određene kategorije proizvoda nastavljaju s cijenom koja je bila na snazi 2. svibnja 2025. za te kategorije. Datum 10. rujna 2026. zato nije univerzalan za svaki proizvod ili uslugu bez iznimke.",
        "Dodatna cijena mora biti jasno istaknuta uz aktualnu cijenu tamo gdje se cijena prikazuje prema pravilima Odluke. Ako cijene oglašavate na vlastitoj web stranici, i web prikaz treba promatrati odvojeno od tehničke obveze XML/CSV cjenika."
      ]
    },
    {
      "heading": "Sidrena cijena i digitalni cjenik nisu ista stvar",
      "paragraphs": [
        "Odluka 1212 uređuje način isticanja dodatne cijene. Odluka 1213 uređuje objavu cjenika proizvoda i usluga u strojno čitljivom XML ili CSV formatu za trgovce i pružatelje usluga koji imaju uspostavljene mrežne stranice.",
        "Zato samo postojanje XML datoteke ne rješava automatski način vizualnog isticanja cijena, kao što ni ispravno prikazana sidrena cijena na webu ne zamjenjuje obvezu strojno čitljivog cjenika kada se Odluka 1213 primjenjuje."
      ]
    },
    {
      "heading": "Kako to riješiti na web stranici bez dvostrukog održavanja?",
      "paragraphs": [
        "Najstabilniji pristup je imati jedan izvor istine za cijene. Ako poslovni program, ERP, blagajna ili drugi sustav može izvesti strukturirane podatke, web prikaz i XML/CSV mogu se generirati iz istog izvora.",
        "Time se smanjuje rizik da aktualna cijena na webu, sidrena cijena i strojno čitljivi cjenik završe s različitim vrijednostima."
      ]
    }
  ],
  "faq": [
    [
      "Je li sidrena cijena isto što i XML/CSV cjenik?",
      "Ne. Sidrena odnosno dodatna cijena uređena je Odlukom NN 101/2026-1212, a objava digitalnog XML/CSV cjenika Odlukom NN 101/2026-1213."
    ],
    [
      "Koji je datum važan za sidrenu cijenu?",
      "Za većinu proizvoda i usluga Odluka 1212 kao dodatnu cijenu veže cijenu koja je bila na snazi 10. rujna 2026. Trgovci koji su prema ranijoj mjeri već isticali dodatnu cijenu za određene kategorije proizvoda nastavljaju s cijenom koja je bila na snazi 2. svibnja 2025. za te kategorije."
    ],
    [
      "Vrijedi li obveza samo za webshopove?",
      "Ne. Pravilo o dodatnoj cijeni nije ograničeno samo na online prodaju. Način primjene ovisi o tome gdje i kako trgovac ili pružatelj usluge ističe odnosno oglašava cijene."
    ],
    [
      "Može li se sidrena cijena automatski prikazivati na webu?",
      "Da, ako postoji pouzdan strukturirani izvor podataka koji sadrži aktualnu i odgovarajuću dodatnu cijenu. Tada ih web integracija može prikazivati iz istog izvora."
    ],
    [
      "Moram li dodati posebno polje u bazu podataka za sidrenu cijenu?",
      "Ne kao zakonski zahtjev. To je samo jedna implementacijska opcija. Bitno je da obvezni podatak ispravno objavite i, gdje je primjenjivo, prikažete uz cijenu — interna pohrana bira se prema mogućnostima postojećeg sustava."
    ]
  ]
}
