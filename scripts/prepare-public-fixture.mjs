import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

mkdirSync('public', { recursive: true })
// Keep the original root file untouched; publish an exact copy so Pages Functions can read the same source in production.
copyFileSync('marketino-artikli', 'public/marketino-artikli')
writeFileSync('functions/_fixture.ts', `// Generated from the untouched root marketino-artikli fixture by prepare-public-fixture.mjs.\nexport const marketinoFixture = ${JSON.stringify(readFileSync('marketino-artikli', 'utf8'))}\n`)
