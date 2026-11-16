import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

mkdirSync('public', { recursive: true })
// Keep the original root file untouched; publish an exact copy so Pages Functions can read the same source in production.
copyFileSync('marketino-artikli', 'public/marketino-artikli')
writeFileSync('functions/_fixture.ts', `// Generated from the untouched root marketino-artikli fixture by prepare-public-fixture.mjs.\nexport const marketinoFixture = ${JSON.stringify(readFileSync('marketino-artikli', 'utf8'))}\n`)

// Editable illustrative templates; same headers as the existing NEPAR service CSV example.
mkdirSync('public/examples',{recursive:true})
const header=['Grupa','Naziv','Vrsta','Interna šifra','Cijena','Akcijska cijena','Poseban oblik prodaje','Naziv posebnog oblika prodaje','Sidrena cijena','Jedinica','Datum referentne cijene','Najniža cijena u 30 dana','Nova stavka','Razlog izuzeća cijene po jedinici']
const templates={
 'digitalni-cjenik-salon':[['Šišanje','Muško šišanje','Usluga','FR-001',15,'','NE','',15],['Fen','Feniranje kratke kose','Usluga','FR-002',12,'','NE','',12],['Fen','Feniranje duge kose','Usluga','FR-003',18,'','NE','',18]],
 'digitalni-cjenik-autoservis':[['Dijagnostika','Dijagnostika vozila','Usluga','AS-001',30,'','NE','',30],['Servis','Servisni radni sat','Usluga','AS-002',45,'','NE','',45],['Gume','Montaža gume do 16 inča','Usluga','AS-003',12,'','NE','',12]],
 'digitalni-cjenik-ugostiteljstvo':[['Kava','Espresso','Usluga','UG-001',2,'','NE','',2],['Kava','Cappuccino','Usluga','UG-002',2.5,'','NE','',2.5],['Hrana','Dnevna juha','Usluga','UG-003',4,'','NE','',4]]
}
for(const [name,rows] of Object.entries(templates)){
 const book=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet([header,...rows]);sheet['!cols']=header.map((h,i)=>({wch:i===1?32:Math.max(h.length+2,14)}));XLSX.utils.book_append_sheet(book,sheet,'Cjenik');writeFileSync('public/examples/'+name+'.xlsx',XLSX.write(book,{type:'buffer',bookType:'xlsx'}))
}
