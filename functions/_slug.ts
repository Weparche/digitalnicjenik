/** Slug helpers for trial Publisher claims. */

const RESERVED = new Set(['nepar', 'app', 'api', 'c', 'www', 'admin', 'static', 'assets', 'null', 'undefined'])

export function slugifyBusinessName(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hr-HR')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)
  return base || 'cjenik'
}

export function isReservedSlug(slug: string) {
  return RESERVED.has(slug)
}

export function validSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 48 && !isReservedSlug(slug)
}

export function suggestSlugAlternatives(base: string, taken: Set<string>) {
  const suggestions: string[] = []
  if (!taken.has(base) && validSlug(base)) suggestions.push(base)
  for (let i = 2; suggestions.length < 5 && i < 50; i += 1) {
    const candidate = `${base}-${i}`.slice(0, 48)
    if (validSlug(candidate) && !taken.has(candidate)) suggestions.push(candidate)
  }
  return suggestions
}
