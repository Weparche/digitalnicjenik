/** Croatian count form: 1 stavka, 2–4 stavke, 5+ stavki (11–14 always stavki; 21 stavka, 22 stavke…). */
export function pluralHr(count: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(count) % 10
  const mod100 = Math.abs(count) % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export const stavke = (count: number) => `${count} ${pluralHr(count, 'stavka', 'stavke', 'stavki')}`

/** "1 stavka nema", "3 stavke nemaju", "5 stavki nema". */
export const stavkeNema = (count: number) => `${stavke(count)} ${pluralHr(count, 'nema', 'nemaju', 'nema')}`
