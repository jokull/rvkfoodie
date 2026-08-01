/**
 * Legacy venue backfill (ticket 04). Idempotent: dedupes on normalized name,
 * merges the two seed overlaps (Bæjarins, Laundromat) in place, reindexes
 * the remaining seed venues to the tail, inserts the rest. Reads a committed
 * snapshot (scripts/backfill-data.json — extracted from the legacy
 * block_venue dump + venue-data.json) so runs are deterministic.
 *
 *   pnpm tsx scripts/backfill-venues.ts --dry-run   # plan + diff only
 *   pnpm tsx scripts/backfill-venues.ts             # apply (local D1)
 *
 * Every write is audit-logged (actor `backfill:legacy`). The 9 countryside
 * venues (no coords) were deliberately skipped — revisit when a Golden
 * Circle guide exists.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createId } from '@paralleldrive/cuid2'

const DRY_RUN = process.argv.includes('--dry-run')
const DB = 'rvkfoodie-cms-v4b'

const d1 = (sql: string): any[] => {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--local', '--json', '--command', sql],
    { encoding: 'utf8' },
  )
  const parsed = JSON.parse(out)
  return parsed[0]?.results ?? parsed.results ?? []
}

// --- normalize: must match the extraction that produced backfill-data.json ---
const norm = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[áà]/g, 'a')
    .replace(/[íì]/g, 'i')
    .replace(/[óò]/g, 'o')
    .replace(/[úù]/g, 'u')
    .replace(/[éè]/g, 'e')
    .replace(/ý/g, 'y')
    .replace(/þ/g, 'th')
    .replace(/ð/g, 'd')
    .replace(/æ/g, 'ae')
    .replace(/ö/g, 'o')
    .replace(/'/g, '')
    .replace(/&/g, 'and')
    .replace(/!/g, '')
    .replace(/[^a-z0-9]/g, '')

type Curated = {
  category: string
  categorySecondary?: string
  cuisine?: string
  dishes?: string[]
  extraTags?: string[]
}
// Curated by hand from the legacy write-ups — the sources carried no
// category/cuisine data, only prose.
const CURATED: Record<string, Curated> = {
  sandholtbakery: { category: 'bakery', dishes: ['sourdough', 'flaky pastries'] },
  deigworkshop: { category: 'bakery', dishes: ['Costanza bagel', 'doughnuts'] },
  reykjavikroasters: { category: 'cafe', extraTags: ['multiple-locations'] },
  braudandco: { category: 'bakery', dishes: ['cinnamon buns', 'pretzel croissants'], extraTags: ['multiple-locations'] },
  plantan: { category: 'cafe', cuisine: 'Vegan', extraTags: ['multiple-locations'] },
  jomfruin: { category: 'restaurant', cuisine: 'Danish' },
  apotek: { category: 'restaurant', cuisine: 'Icelandic', dishes: ['fish of the day'] },
  baejarinsbeztupylsur: { category: 'street-food', dishes: ['pylsa with everything'] },
  fine: { category: 'restaurant', cuisine: 'Chinese', dishes: ['beef noodle dish', 'chili chicken', 'mapo tofu'] },
  chickpea: { category: 'street-food', cuisine: 'Middle Eastern', dishes: ['homemade falafel'] },
  shalimar: { category: 'restaurant', cuisine: 'Pakistani', dishes: ['thali platter'] },
  ramenmomo: { category: 'restaurant', cuisine: 'Japanese', dishes: ['tantanmen'] },
  austurindiafelagid: { category: 'restaurant', cuisine: 'Indian' },
  skal: { category: 'restaurant', categorySecondary: 'bar', cuisine: 'Nordic', dishes: ['cod wings'] },
  laprimavera: { category: 'restaurant', cuisine: 'Italian', dishes: ['pasta'] },
  '2guysathlemmur': { category: 'restaurant', cuisine: 'Burgers', dishes: ['smash burger'] },
  lekock: { category: 'restaurant', cuisine: 'Burgers', dishes: ['burger on potato brioche'] },
  sumacgrilldrinks: { category: 'restaurant', cuisine: 'Lebanese', dishes: ['grilled meat skewers'] },
  banthai: { category: 'restaurant', cuisine: 'Thai', dishes: ['shrimp 107'] },
  skreid: { category: 'restaurant', cuisine: 'Basque' },
  vinstukantiusopar: { category: 'bar', categorySecondary: 'restaurant', dishes: ['grilled padrón peppers', 'aged Tindur cheese'] },
  rontgen: { category: 'bar' },
  kramber: { category: 'bar' },
  port9: { category: 'bar' },
  ammadon: { category: 'bar' },
  bodega: { category: 'bar' },
  daisycocktailbar: { category: 'bar' },
  '12tonartheirishmanpub': { category: 'bar', categorySecondary: 'cafe' },
  kaffibarinn: { category: 'bar' },
  laundromatcafe: { category: 'cafe', categorySecondary: 'restaurant' },
  kaffilaekur: { category: 'cafe', dishes: ['sourdough flatbakes'] },
  lapoblana: { category: 'restaurant', cuisine: 'Mexican', dishes: ['enchiladas in salsa verde', 'quesadillas'] },
  plantanbistronorraenahusid: { category: 'restaurant', categorySecondary: 'cafe', cuisine: 'Plant-based' },
  bullan: { category: 'street-food', cuisine: 'Burgers', extraTags: ['multiple-locations'] },
  justwinginit: { category: 'street-food' },
  mokkakaffi: { category: 'cafe', dishes: ['waffles with cream and jam'] },
  gaetagelato: { category: 'sweet-treats', dishes: ['pistachio gelato', 'salted caramel gelato'] },
}

// Legacy photos — live objects on media.rvkfoodie.is (R2 bucket rvkfoodie-cms,
// custom domain + Image Resizing). Raw URLs; renderers append cdn-cgi/image
// options. Two venues needed their newer asset variant (old key 404s).
const PHOTOS: Record<string, string> = {
  austurindiafelagid: 'https://media.rvkfoodie.is/2025-05-16_10-30-00_UTC_3.jpg',
  skal: 'https://media.rvkfoodie.is/skal-steak-wine.jpg',
  skreid: 'https://media.rvkfoodie.is/skreid-2.jpg',
  vinstukantiusopar: 'https://media.rvkfoodie.is/2026-01-24_13-40-44_UTC_3.jpg',
  lekock: 'https://media.rvkfoodie.is/uploads/td5cucw0c5/le-kock-burger.jpg',
  chickpea: 'https://media.rvkfoodie.is/uploads/01KM5ERE8VKMRQG8K8TJG7SG5B/chickpea-falafel.jpeg',
  lapoblana: 'https://media.rvkfoodie.is/uploads/nkpti6fxvu/la-poblana.jpeg',
  bullan: 'https://media.rvkfoodie.is/uploads/t6gzo781k7/bullan.jpeg',
  jomfruin: 'https://media.rvkfoodie.is/uploads/01KM5ERJ1CZS8CT1B6MY0F9K9E/jomfruin-smorrebrod.jpeg',
}

type Row = (typeof data)[number]
const data: any[] = JSON.parse(readFileSync('scripts/backfill-data.json', 'utf8'))
const JSON_VERIFIED_AT = Date.parse('2026-03-15T00:00:00Z')

const plan = () => {
  const existing = d1(
    'SELECT id, name, order_key, category, category_secondary, status, cuisine, tags, note, recommended_dishes, last_verified_at, confidence, source, address, lat, lon, opening_hours, photos FROM venues ORDER BY order_key',
  )
  const byName = new Map(existing.map((v: any) => [norm(v.name), v]))
  const inserts: any[] = []
  const updates: any[] = []
  const reindexes: any[] = []
  const awards: any[] = []
  const keys: string[] = []

  data.forEach((v: Row, i: number) => {
    const curated = CURATED[v.key]
    if (!curated) throw new Error(`No curation for ${v.name} (${v.key})`)
    const tags = [
      ...(v.isFree ? ['free'] : []),
      ...(v.kidsGuide ? ['family-friendly'] : []),
      ...(curated.extraTags ?? []),
    ]
    const target = {
      name: v.name,
      category: curated.category,
      categorySecondary: curated.categorySecondary ?? null,
      status: 'live',
      orderKey: `a${i}`,
      cuisine: curated.cuisine ?? null,
      tags,
      note: v.description + (v.note ? `\n\n${v.note}` : ''),
      recommendedDishes: curated.dishes ?? [],
      lastVerifiedAt: v.inJson ? JSON_VERIFIED_AT : null,
      confidence: v.inJson ? 0.9 : 0.5,
      source: v.inJson ? 'legacy:venue-data.json' : 'legacy:block_venue',
      address: v.jsonAddress ?? v.address,
      lat: v.jsonLat ?? v.lat,
      lon: v.jsonLon ?? v.lon,
      openingHours: v.jsonHours ?? v.openingHours,
      photos: PHOTOS[v.key] ? [PHOTOS[v.key]] : [],
    }
    keys.push(target.orderKey)
    // Seed lookup: the two seed overlaps are 'Bæjarins Beztu Pylsur' (norm
    // matches) and 'The Laundromat Cafe' (leading 'The' — match both ways).
    const hit = byName.get(v.key) ?? byName.get(`the${v.key}`)
    if (!hit) inserts.push({ id: createId(), ...target })
    else {
      const same =
        hit.order_key === target.orderKey &&
        hit.category === target.category &&
        hit.category_secondary === target.categorySecondary &&
        hit.status === target.status &&
        hit.confidence === target.confidence &&
        hit.source === target.source &&
        hit.photos === JSON.stringify(target.photos)

      if (!same) updates.push({ id: hit.id, ...target })
    }
  })

  // Award venue ids: existing rows + this run's inserts (fresh-DB safe).
  const idByKey = new Map<string, string>()
  for (const [k, v] of byName) idByKey.set(k, v.id)
  for (const v of inserts) idByKey.set(norm(v.name), v.id)
  for (const v of data) {
    if (!v.bestOfAward) continue
    const hit = idByKey.get(v.key) ?? idByKey.get(`the${v.key}`)
    if (!hit) throw new Error(`Award venue not found: ${v.key}`)
    awards.push({ venueId: hit, awardType: 'grapevine-best-of', title: v.bestOfAward, url: v.grapevineUrl })
  }

  // Non-overlapping seed venues keep existing, reindexed to the tail.
  const owned = new Set(data.map((v: Row) => v.key))
  let tail = data.length
  for (const v of existing) {
    const k = norm(v.name).replace(/^the/, '')
    if (!owned.has(k)) {
      const target = `a${tail++}`
      if (v.order_key !== target) reindexes.push({ id: v.id, name: v.name, orderKey: target })
    }
  }

  return { inserts, updates, reindexes, awards, keys, data }
}

const esc = (s: any) =>
  s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`
const json = (x: any) => esc(JSON.stringify(x))

const render = (p: ReturnType<typeof plan>) => {
  const sql: string[] = []
  const audit: string[] = []
  for (const v of p.inserts) {
    sql.push(
      `INSERT INTO venues (id, name, category, category_secondary, status, order_key, cuisine, tags, note, recommended_dishes, last_verified_at, confidence, source, address, lat, lon, opening_hours, photos, price_level, google_places_id, dineout_id, created_at, updated_at) VALUES (${esc(v.id)}, ${esc(v.name)}, ${esc(v.category)}, ${esc(v.categorySecondary)}, 'live', ${esc(v.orderKey)}, ${esc(v.cuisine)}, ${json(v.tags)}, ${esc(v.note)}, ${json(v.recommendedDishes)}, ${v.lastVerifiedAt ? esc(v.lastVerifiedAt) : 'NULL'}, ${v.confidence}, ${esc(v.source)}, ${esc(v.address)}, ${v.lat}, ${v.lon}, ${esc(v.openingHours)}, ${json(v.photos)}, NULL, NULL, NULL, ${Date.now()}, ${Date.now()});`,
    )
    audit.push(
      `INSERT INTO audit_log (id, actor, action, entity_type, entity_id, after, at) VALUES ('${createId()}', 'backfill:legacy', 'venue.backfill.insert', 'venue', '${v.id}', ${json({ name: v.name, category: v.category, orderKey: v.orderKey })}, ${Date.now()});`,
    )
  }
  for (const v of p.updates) {
    sql.push(
      `UPDATE venues SET name = ${esc(v.name)}, category = ${esc(v.category)}, category_secondary = ${esc(v.categorySecondary)}, status = 'live', order_key = ${esc(v.orderKey)}, cuisine = ${esc(v.cuisine)}, tags = ${json(v.tags)}, note = ${esc(v.note)}, recommended_dishes = ${json(v.recommendedDishes)}, last_verified_at = ${v.lastVerifiedAt ? esc(v.lastVerifiedAt) : 'NULL'}, confidence = ${v.confidence}, source = ${esc(v.source)}, address = ${esc(v.address)}, lat = ${v.lat}, lon = ${v.lon}, opening_hours = ${esc(v.openingHours)}, photos = ${json(v.photos)}, updated_at = ${Date.now()} WHERE id = '${v.id}';`,
    )
    audit.push(
      `INSERT INTO audit_log (id, actor, action, entity_type, entity_id, after, at) VALUES ('${createId()}', 'backfill:legacy', 'venue.backfill.update', 'venue', '${v.id}', ${json({ name: v.name, category: v.category, orderKey: v.orderKey })}, ${Date.now()});`,
    )
  }
  for (const v of p.reindexes) {
    sql.push(`UPDATE venues SET order_key = ${esc(v.orderKey)}, updated_at = ${Date.now()} WHERE id = '${v.id}';`)
    audit.push(
      `INSERT INTO audit_log (id, actor, action, entity_type, entity_id, after, at) VALUES ('${createId()}', 'backfill:legacy', 'venue.backfill.reindex', 'venue', '${v.id}', ${json({ orderKey: v.orderKey })}, ${Date.now()});`,
    )
  }
  for (const a of p.awards) {
    sql.push(
      `INSERT INTO venue_awards (id, venue_id, award_type, title, url, created_at) VALUES ('${createId()}', '${a.venueId}', 'grapevine-best-of', ${esc(a.title)}, ${esc(a.url)}, ${Date.now()})
       ON CONFLICT (venue_id, award_type) DO UPDATE SET title = excluded.title, url = excluded.url;`,
    )
  }
  return [...sql, ...audit]
}

const main = () => {
  const p = plan()
  console.log(`backfill: ${p.inserts.length} inserts, ${p.updates.length} merges, ${p.reindexes.length} reindexes, ${p.awards.length} awards`)
  console.log(`orderKey space: a0..a${p.keys.length - 1} (${p.keys.length} venues), seeds reindexed to a${p.keys.length}..`)
  console.log('\nINSERT:')
  for (const v of p.inserts) console.log(`  ${v.orderKey.padEnd(3)} ${v.name} [${v.category}] conf=${v.confidence} src=${v.source}`)
  console.log('\nMERGE (in place):')
  for (const v of p.updates) console.log(`  ${v.orderKey.padEnd(3)} ${v.name} [${v.category}] conf=${v.confidence}`)
  console.log('\nREINDEX:')
  for (const v of p.reindexes) console.log(`  ${v.orderKey} ${v.name}`)
  console.log('\nAWARDS:')
  for (const a of p.awards) console.log(`  ${a.title}`)
  if (DRY_RUN) {
    console.log('\ndry-run — nothing applied')
    return
  }
  const sql = render(p)
  const file = `/tmp/backfill-${Date.now()}.sql`
  writeFileSync(file, sql.join('\n'))
  execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--local', '--file', file], { stdio: 'inherit' })
  console.log(`\napplied (${sql.length} statements)`)
}

main()
