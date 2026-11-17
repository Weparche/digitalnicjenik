# Publisher: više cjenika

## Model
Korisnički račun ima postojeće tenant_members veze. Svaki tenant je zaseban cjenik s vlastitim slugom, licencom, metapodacima, objavama i arhivom. Nema migracije postojećih URL-ova. Pregled grupira isključivo vlastite cjenike prema identifikatoru i vrsti trgovca iz publication_metadata; identifikator nije autorizacija. Cjenici bez identifikatora ostaju u zasebnoj grupi.

## UX
- /app bez parametara: Moji cjenici, sažetak, pretraga, filter stavki za pregled.
- Kartica: naziv, oznaka i adresa, status licence/objave i formata, broj stavki, verzija, datum, uređivanje, arhiva i javni link.
- Postojeći duboki linkovi ostaju funkcionalni; svaka objava i dalje prolazi postojeće validacije.
- Dodavanje novog cjenika koristi postojeći onboarding.

## Sljedeća faza
Zajednički poslovni profil (pravni naziv, registracijski identifikator i OIB za naplatu nisu nužno ista stvar), eksplicitno povezivanje i ponovna uporaba podataka pri dodavanju cjenika, interni plan za vlastite NEPAR cjenike s auditom, objedinjeni checker/monitor rezultati, API sinkronizacija. Ne prepisivati identifikator u već objavljenim arhivama, ne spajati prava pristupa na temelju istog identifikatora, ne izuzimati administratore iz provjera licenci bez zasebne politike.
