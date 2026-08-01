/**
 * End-to-end RPC smoke test against the running dev server, using the real
 * browser client + wire protocol (works in node 24). Run with the dev server
 * up: pnpm dev, then npx tsx rpc-e2e.test.ts
 */
import { execFileSync } from 'node:child_process'
import { createBrowserClient, fetchTransport } from 'result-rpc/client'
import { appContract } from '../src/contract.js'

const base = process.env.RPC_URL ?? 'http://localhost:3000'
const client = createBrowserClient({
  contract: appContract,
  transport: fetchTransport({ url: `${base}/api/rpc` }),
  contractVersion: 'rvkfoodie-scaffold',
})

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log('ok:', msg)
}

// 1) guide view (public read)
const view = await client.guides.view({ id: 'guide_01' })
assert(view.ok, 'guides.view ok')
if (view.ok) {
  assert(view.value.guide.slug === 'hotel-borg', 'guide slug')
  assert(view.value.venueRows.length === 7, `7 live venue rows, got ${view.value.venueRows.length}`)
  console.log('  first venue:', view.value.venueRows[0].venue.name, '| cat:', view.value.venueRows[0].venue.category)
}

// 2) create + draft for hotel_02 (101 Hotel), then approve + publish.
// Reset that guide's state first so the flow is deterministic on re-runs.
const q = (sql: string) =>
  JSON.parse(
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'rvkfoodie-cms-v4b', '--local', '--json', '--command', sql], {
      encoding: 'utf8',
    }),
  )[0].results
for (const row of q(`SELECT id FROM guides WHERE hotel_id = 'hotel_02'`)) {
  q(`DELETE FROM guide_events WHERE guide_id = '${row.id}'`)
  q(`DELETE FROM guide_captures WHERE guide_id = '${row.id}'`)
  q(`DELETE FROM guide_venues WHERE guide_id = '${row.id}'`)
  q(`DELETE FROM guide_excludes WHERE guide_id = '${row.id}'`)
  q(`DELETE FROM guides WHERE id = '${row.id}'`)
}
// Idempotent CRUD venue (cascade removes its awards/lifecycle rows).
for (const row of q(`SELECT id FROM venues WHERE name = 'E2E Test Spot'`)) {
  q(`DELETE FROM venues WHERE id = '${row.id}'`)
}
const created = await client.guides.create({ hotelId: 'hotel_02' })
assert(created.ok, 'guides.create ok')
if (created.ok) {
  const guideId = created.value.id
  const draft = await client.guides.draft({ id: guideId })
  assert(draft.ok, 'guides.draft ok')
  if (draft.ok) assert(draft.value.added.length > 0, 'draft adds candidates from the backfilled pool')
  if (draft.ok) {
    assert(draft.value.added.length > 0, 'draft adds candidates from the backfilled pool')
    const pendingView = await client.guides.view({ id: guideId })
    assert(pendingView.ok, 'view after draft ok (0 live rows expected)')
    if (pendingView.ok) assert(pendingView.value.venueRows.length === 0, 'pending rows not live yet')

    // Approve the drafted candidates; the view then shows them live.
    const approve = await client.guides.approveCandidates({ guideId, venueIds: draft.value.added })
    assert(approve.ok && approve.value.length === draft.value.added.length, 'approveCandidates ok')
    const liveView = await client.guides.view({ id: guideId })
    assert(liveView.ok && liveView.value.venueRows.length === draft.value.added.length, 'view shows live rows after approve')
    if (liveView.ok) {
      assert(liveView.value.venueRows.some((r) => (r.venue.photos?.length ?? 0) > 0), 'guide view includes legacy CDN photos')
      assert(liveView.value.venueRows.some((r) => (r.venue.website?.length ?? 0) > 0 || (r.venue.phone?.length ?? 0) > 0), 'guide view includes website/phone')
    }

    const publish = await client.guides.publish({ id: guideId })
    assert(publish.ok, 'guides.publish ok')
    if (publish.ok) assert(publish.value.status === 'live', 'guide now live')
  }
}

// 3) exclude flow on the live guide
const ex = await client.guides.addExclude({ guideId: 'guide_01', venueId: 'venue_08' })
assert(ex.ok, 'guides.addExclude ok')
const exRm = await client.guides.removeExclude({ guideId: 'guide_01', venueId: 'venue_08' })
assert(exRm.ok, 'guides.removeExclude ok')

// 4) lifecycle + audit surfaces
const lifecycle = await client.venues.addLifecycleEvent({ venueId: 'venue_05', type: 'temporarily-closed', startedAt: new Date(), note: 'renovations' })
assert(lifecycle.ok, 'addLifecycleEvent ok')
const audit = await client.audit.list({ entityType: 'venue', entityId: 'venue_05' })
assert(audit.ok, 'audit.list ok')
if (audit.ok) assert(audit.value.length >= 1, 'audit rows exist')
console.log('ALL E2E CHECKS PASSED')

// --- Guide page surfaces (ticket 06) ---
const bySlug = await client.guides.viewBySlug({ slug: 'hotel-borg' })
assert(bySlug.ok, 'guides.viewBySlug ok')
if (bySlug.ok) assert(bySlug.value.venueRows.length === 7, '7 venues via slug')

const capture = await client.captures.request({ slug: 'hotel-borg', email: 'guest@example.com' })
assert(capture.ok, 'captures.request ok (EMAIL binding local emulation)')

const qrRes = await fetch('http://localhost:3000/api/qr?slug=hotel-borg')
assert(qrRes.status === 200 && (qrRes.headers.get('content-type') ?? '').includes('image/svg+xml'), 'QR endpoint returns SVG')

// --- Analytics beacon (ticket 09) ---
const ev = await client.events.record({ slug: 'hotel-borg', event: 'view' })
assert(ev.ok, 'events.record ok')
const evClick = await client.events.record({ slug: 'hotel-borg', event: 'venue-click', venueId: 'venue_01' })
assert(evClick.ok, 'events.record venue-click ok')

// --- Auth (ticket 10) — better-auth adapter on drizzle 1.0-rc.4 + D1 ---
const AUTH = 'http://localhost:3000'
const unauth = await fetch(`${AUTH}/api/auth/get-session`)
assert(unauth.status === 200, 'get-session ok when signed out')
const wrong = await fetch(`${AUTH}/api/auth/sign-in/email-otp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: AUTH },
  body: JSON.stringify({ email: 'jokull@solberg.is', otp: '000000' }),
})
assert(wrong.status === 400, 'sign-in wrong code rejected (adapter SELECT on 1.0-rc.4)')
const send = await fetch(`${AUTH}/api/auth/email-otp/send-verification-otp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: AUTH },
  body: JSON.stringify({ email: 'jokull@solberg.is', type: 'sign-in' }),
})
assert(send.status === 200, 'send-verification-otp ok (adapter INSERT on 1.0-rc.4 + EMAIL binding)')

// --- Venue CRUD extras (website/phone/confidence + awards) ---
const addV = await client.venues.add({ name: 'E2E Test Spot', category: 'restaurant', address: 'Testavegur 1' })
assert(addV.ok, 'venues.add ok (CRUD venue)')
if (addV.ok) {
  const vid = addV.value.id
  const upd = await client.venues.update({
    id: vid,
    website: 'https://example.com',
    phone: '555 1234',
    confidence: 0.7,
  })
  assert(upd.ok && upd.value.website === 'https://example.com' && upd.value.phone === '555 1234' && upd.value.confidence === 0.7, 'venues.update carries website/phone/confidence')
  const award = await client.venueAwards.add({ venueId: vid, awardType: 'grapevine-best-of', title: 'Test Award', url: 'https://grapevine.is/x' })
  assert(award.ok, 'venueAwards.add ok')
  const dup = await client.venueAwards.add({ venueId: vid, awardType: 'grapevine-best-of', title: 'Dup', url: undefined })
  assert(!dup.ok && dup.error._tag === 'venue-award/exists', 'venueAwards.add rejects duplicates')
  const list = await client.venueAwards.list({ venueId: vid })
  assert(list.ok && list.value.length === 1 && list.value[0].title === 'Test Award', 'venueAwards.list ok')
  if (award.ok) {
    const rm = await client.venueAwards.remove({ id: award.value.id })
    assert(rm.ok, 'venueAwards.remove ok')
  }
  const empty = await client.venueAwards.list({ venueId: vid })
  assert(empty.ok && empty.value.length === 0, 'venueAwards.list empty after remove')
  const del = await client.venues.setStatus({ id: vid, status: 'closed' })
  assert(del.ok && del.value.status === 'closed', 'CRUD venue cleaned up (closed)')
}
