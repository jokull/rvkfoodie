/**
 * Pure venue-URL helpers — kept OUT of cms.ts (which imports the workers
 * runtime) so client-side components can import them safely.
 */

/** Slugify a name with good Icelandic/diacritic folding */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ð/gi, 'd')
    .replace(/þ/gi, 'th')
    .replace(/æ/gi, 'ae')
    .replace(/ö/gi, 'o')
    .replace(/&/g, 'and')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Build a /places/ URL path for a venue */
export const venueUrl = (venue: { id: string; name: string }): string =>
  `/places/${slugify(venue.name)}-${venue.id}`

/** Extract the nanoid from a "{slug}-{nanoid}" param */
export const parseVenueParam = (param: string): string => {
  const last = param.lastIndexOf('-')
  return last === -1 ? param : param.slice(last + 1)
}
