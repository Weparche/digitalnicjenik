/** The commercial offer, shared by marketing, lead emails and prerendered SEO. */
export const PLANS = [
  { id: 'link', name: 'Link', price: 19.9, summary: 'Objavite pripremljeni CSV na stalnoj poveznici.', features: ['Upload i zamjena CSV cjenika', 'Stalni javni URL dok je pretplata aktivna', 'CSV/XML izlaz za podržani format', 'Arhiva prethodnih verzija 30 dana od zamjene uz aktivnu pretplatu', 'Link za vašu postojeću web stranicu'] },
  { id: 'publisher', name: 'Publisher', price: 49.9, summary: 'Objavite, ažurirajte i pratite svoj cjenik.', features: ['Sve iz paketa Link', 'Excel, CSV i XML · detaljna validacija', 'Dashboard i jednostavna objava novih verzija', 'Stalni CSV/XML endpointi i verzioniranje', 'Javna arhiva najmanje 30 dana od zamjene', 'Nadzor i e-mail upozorenja', 'QR, ispis u PDF i ugradnja na web'] },
  { id: 'web', name: 'Web + Publisher', price: 79.9, summary: 'Jednostavan web za cjenik, uz našu pomoć.', features: ['Sve iz paketa Publisher', 'Jednostavan NEPAR web / landing', 'Hosting i SSL', 'Osnovno uređivanje', 'Postavljanje cjenika i tehničko povezivanje'] },
] as const
export type PlanId = typeof PLANS[number]['id']
export function formatEur(amount: number, perYear = false): string {
  const value = amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value} €${perYear ? '/god' : ''}`
}
