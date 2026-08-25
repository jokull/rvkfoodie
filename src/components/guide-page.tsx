/**
 * The guide page component — venue cards grouped by category, the map, the
 * capture form (Turnstile-protected when a site key is configured), the
 * analytics beacon, and the sample marker for draft guides.
 *
 * Rendered on the server AND hydrated (Start is SSR, not RSC) — the only
 * client-only pieces are the map, open-now / walk-time computation, and the
 * beacon.
 *
 * Brand: the guide renders INSIDE the /g surface (not the _public shell), so
 * it echoes the consumer theme — cream canvas, ink text, #5071fe blue,
 * Instrument Serif for the display line — so the flagship hotel deliverable
 * reads as the same product the marketing site sells.
 */
import { useEffect, useMemo, useState } from 'react'
import { useResultMutation, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import type { GuideView } from '../models.js'
import { GuideMap } from './guide-map.js'
import { VENUE_CATEGORIES } from '../schema.js'

const sample = (value: GuideView) => value.guide.status !== 'live' || value.venueRows.length === 0

// ${priceLevel} → kr glyphs (1–4).
const PRICE_LEVELS = ['', 'kr', 'krkr', 'krkrkr', 'krkrkrkr']

/** "Mo-Su 10:00-22:00" (optionally ", 18:00-23:00") → open/closed status for
 * the current time, plus a short "closes/opens HH:MM" string. Best-effort. */
const openStatus = (hours: string | null): { open: boolean; label: string } | null => {
  if (!hours) return null
  const now = new Date()
  const dayIdx = now.getDay() // 0 = Sun
  const today = now.getHours() * 60 + now.getMinutes()
  const segments = hours.split(/[,;]/).map((s) => s.trim())
  for (const seg of segments) {
    const m = seg.match(/([A-Za-z]{2})-([A-Za-z]{2})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
    if (!m) continue
    const dayLetter = (s: string) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].indexOf(s)
    const from = dayLetter(m[1])
    const to = dayLetter(m[2])
    const isToday = (i: number) => (from <= to ? i >= from && i <= to : i >= from || i <= to)
    if (!isToday(dayIdx)) continue
    const openMin = Number(m[3]) * 60 + Number(m[4])
    const closeMin = Number(m[5]) * 60 + Number(m[6])
    if (today >= openMin && today < closeMin) {
      return { open: true, label: `Open · closes ${HHMM(closeMin)}` }
    }
    if (today < openMin) return { open: false, label: `Closed · opens ${HHMM(openMin)}` }
  }
  return { open: false, label: 'Closed today' }
}

const HHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/** Haversine → meters. */
const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371e3
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** "3 min walk" from hotel to venue (~4.5 km/h). Null when either pin is missing. */
const walkMin = (from: { lat: number; lon: number } | null, to: { lat: number; lon: number } | null) => {
  if (!from || !to) return null
  const m = metres(from, to)
  return Math.max(1, Math.round(m / 75))
}

const monthYear = (d: Date | null) => {
  if (!d) return null
  const month = d.toLocaleString('en', { month: 'short' })
  return `${month} ${d.getFullYear()}`
}

const sectionTitle = (category: string): string =>
  (
    {
      'breakfast-brunch': 'Breakfast & brunch',
      cafe: 'Cafés',
      bakery: 'Bakeries',
      restaurant: 'Restaurants',
      bar: 'Bars & nightlife',
      'street-food': 'Street food',
      'sweet-treats': 'Sweet treats',
    } as Record<string, string>
  )[category] ?? category

const slugify = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')

const LinkBack = () => <a href="/" className="guide-back">← rvkfoodie.is</a>

export function GuidePage({ slug }: { slug: string }) {
  const view = useResultQuery(client.guides.viewBySlug, { slug }, { staleTime: 60_000 })

  // Analytics beacon — fire-and-forget, failures never surface.
  const beacon = useResultMutation(client.events.record)
  useEffect(() => {
    if (view.state !== 'success') return
    const src = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('src') : null
    beacon.mutate({ slug, event: src === 'qr' ? 'qr-scan' : 'view' })
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.state === 'success'])

  if (view.state === 'pending') {
    return (
      <div className="guide-shell bg-cream min-h-screen">
        <p className="muted">Loading your guide…</p>
      </div>
    )
  }
  if (view.state === 'failure') {
    return (
      <div className="guide-shell bg-cream min-h-screen">
        <p className="guide-back"><LinkBack /></p>
        <h1 className="guide-h1">This guide isn't available yet</h1>
        <p className="guide-intro">
          {view.error._tag === 'guide/not-found'
            ? "We couldn't find it — it may be being prepared."
            : `Something went wrong (${view.error._tag}).`}
        </p>
        <p className="guide-intro">
          Is your hotel guide missing?{' '}
          <a href="mailto:guides@rvkfoodie.is" className="guide-link">Email us</a>{' '}
          and we'll get it to you.
        </p>
      </div>
    )
  }

  const value = view.value
  const isSample = sample(value)
  const hotel = value.hotel
  const hotelPin = hotel?.lat != null && hotel?.lon != null ? { lat: hotel.lat, lon: hotel.lon } : null
  const radiusMin = value.guide.radiusMin ?? 20

  // Group live venue rows by category, keeping template order.
  const sections = useMemo(() => {
    const byCategory = new Map<string, Array<(typeof value.venueRows)[number]>>()
    for (const row of value.venueRows) {
      const list = byCategory.get(row.venue.category) ?? []
      list.push(row)
      byCategory.set(row.venue.category, list)
    }
    return VENUE_CATEGORIES.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      rows: byCategory.get(c)!,
    }))
  }, [value])

  return (
    <div className="guide-shell bg-cream min-h-screen">
      <p className="guide-back"><LinkBack /></p>

      <header className="guide-hero">
        <h1 className="guide-h1">{isSample ? 'Sample guide' : 'Your guide to Reykjavík'}</h1>
        {hotel?.name && (
          <p className="guide-hotel">made for your stay<>{' '}at <strong>{hotel.name}</strong></></p>
        )}
        <p className="guide-intro">
          {isSample
            ? 'What your guests could receive — curated picks, kept current.'
            : `The best eats within a ${radiusMin}-minute walk — curated and kept current.`}
        </p>
        {isSample && <span className="badge badge-sample">sample</span>}
      </header>

      {/* Sticky category nav — jump to a day-part without scrolling the list. */}
      {sections.length > 1 && (
        <nav className="guide-nav" aria-label="Guide sections">
          {sections.map((s) => (
            <a key={s.category} href={`#${slugify(s.category)}`} className="guide-nav-chip">
              {sectionTitle(s.category)}
            </a>
          ))}
        </nav>
      )}

      <GuideMap hotelPin={hotelPin} venueRows={value.venueRows} radiusKm={radiusMin * 0.08} />

      {sections.length === 0 && <p className="muted">This guide is still being assembled.</p>}

      {sections.map((section) => (
        <section key={section.category} id={slugify(section.category)} className="guide-section">
          <h2 className="section-title">{sectionTitle(section.category)}</h2>
          <ul className="guide-list">
            {section.rows.map((row, i) => (
              <VenueCard
                key={row.id}
                row={row}
                hotelPin={hotelPin}
                editorPick={i === 0}
                onVenueClick={(venueId) => beacon.mutate({ slug, event: 'venue-click', venueId })}
              />
            ))}
          </ul>
        </section>
      ))}

      <footer className="guide-footer">
        <p>
          Made for <strong>{hotel?.name ?? 'your stay'}</strong> · curated by Reykjavík Foodie
        </p>
        <CaptureForm slug={slug} onCaptured={() => beacon.mutate({ slug, event: 'email-captured' })} />
      </footer>
    </div>
  )
}

function VenueCard({
  row,
  hotelPin,
  editorPick,
  onVenueClick,
}: {
  row: GuideView['venueRows'][number]
  hotelPin: { lat: number; lon: number } | null
  editorPick: boolean
  onVenueClick: (venueId: string, action?: string) => void
}) {
  const v = row.venue
  const note = row.overrideText ?? v.note
  const photo = v.photos[0]
  const photoUrl = photo
    ? photo.replace(
        /^(https?:\/\/media\.rvkfoodie\.is)\/?(.*)$/,
        '$1/cdn-cgi/image/width=640,fit=scale-down,format=webp/$2',
      )
    : null
  const walk = walkMin(hotelPin, v.lat != null && v.lon != null ? { lat: v.lat, lon: v.lon } : null)
  const open = openStatus(v.openingHours)

  return (
    <li className={`venue-card ${editorPick ? 'editor-pick' : ''}`}>
      {photoUrl && <img className="venue-card-photo" src={photoUrl} alt={v.name} loading="lazy" />}
      <div className="venue-card-head">
        <h3>{v.name}</h3>
        {v.priceLevel != null && <span className="venue-card-price">{PRICE_LEVELS[v.priceLevel] ?? ''}</span>}
      </div>
      {editorPick && <span className="badge badge-pick">editor's pick</span>}
      <p className="venue-card-meta">
        <span>{v.address}</span>
        {walk != null && <span className="venue-card-walk">{walk} min walk</span>}
      </p>
      {open && (
        <p className={`venue-card-hours ${open.open ? 'is-open' : 'is-closed'}`}>{open.label}</p>
      )}
      {(v.cuisine || v.categorySecondary) && (
        <p className="venue-card-tags">{[v.cuisine, v.categorySecondary].filter(Boolean).join(' · ')}</p>
      )}
      {note && <p className="venue-card-note">{note}</p>}
      {v.recommendedDishes.length > 0 && (
        <p className="venue-card-dishes">Try: {v.recommendedDishes.join(' · ')}</p>
      )}
      {v.lastVerifiedAt && (
        <p className="venue-card-verified">Spot-checked {monthYear(v.lastVerifiedAt)}</p>
      )}
      <div className="venue-card-actions">
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(`${v.name} ${v.address}`)}`}
          target="_blank"
          rel="noreferrer"
          className="action action-primary"
          onClick={() => onVenueClick(v.id, 'directions')}
        >
          Directions
        </a>
        {v.phone && (
          <a
            href={`tel:${v.phone.replace(/\s/g, '')}`}
            className="action action-call"
            onClick={() => onVenueClick(v.id, 'call')}
          >
            Call
          </a>
        )}
        {v.dineoutId && (
          <a
            href={`https://dineout.is/restaurant/${v.dineoutId}`}
            target="_blank"
            rel="noreferrer"
            className="action"
            onClick={() => onVenueClick(v.id, 'reserve')}
          >
            Reserve
          </a>
        )}
        {v.website && (
          <a
            href={v.website}
            target="_blank"
            rel="noreferrer"
            className="action"
            onClick={() => onVenueClick(v.id, 'website')}
          >
            Website
          </a>
        )}
      </div>
    </li>
  )
}

/**
 * "Email me this guide" — offline keeping. Bot protection (Turnstile) is
 * punted (GitHub issue); the form is open for now.
 */
function CaptureForm({
  slug,
  onCaptured,
}: {
  slug: string
  onCaptured: () => void
}) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const capture = useResultMutation(client.captures.request, {
    onSuccess: () => {
      setSent(true)
      onCaptured()
    },
  })

  if (sent) {
    return (
      <p className="capture-done" role="status">
        Check your inbox — the guide is on its way.
      </p>
    )
  }
  return (
    <form
      className="capture-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!email.trim()) return
        capture.mutate({ slug, email: email.trim() })
      }}
    >
      <label htmlFor="capture-email">Keep this guide — email it to yourself</label>
      <div className="capture-row">
        <input
          id="capture-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <button type="submit" disabled={capture.state === 'pending'}>
          {capture.state === 'pending' ? 'Sending…' : 'Email me'}
        </button>
      </div>
      {capture.state === 'failure' && (
        <p className="error">Couldn't send right now — try again later.</p>
      )}
    </form>
  )
}
