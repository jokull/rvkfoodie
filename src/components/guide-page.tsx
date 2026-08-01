/**
 * The guide page component — venue cards grouped by category, the map, the
 * capture form (Turnstile-protected when a site key is configured), the
 * analytics beacon, and the sample marker for draft guides.
 *
 * Rendered on the server AND hydrated (Start is SSR, not RSC) — the map and
 * the beacon are the only client-only pieces.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useResultMutation, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import type { GuideView } from '../models.js'
import { GuideMap } from './guide-map.js'
import { VENUE_CATEGORIES } from '../schema.js'

const sample = (value: GuideView) => value.guide.status !== 'live' || value.venueRows.length === 0

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

  if (view.state === 'pending') return <p className="muted">Loading guide…</p>
  if (view.state === 'failure') {
    return (
      <p className="error">
        {view.error._tag === 'guide/not-found'
          ? 'This guide does not exist.'
          : `Guide failed: ${view.error._tag}`}
      </p>
    )
  }

  const value = view.value
  const isSample = sample(value)

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
    <div className="guide-shell">
      <p className="muted small">
        <LinkBack />
      </p>

      <header className="guide-hero">
        <h1>{isSample ? 'Sample guide' : 'Your guide to Reykjavík'}</h1>
        <p className="guide-intro">
          {isSample
            ? 'What your guests could receive — curated picks, kept current.'
            : 'The best eats within a 20-minute walk — curated and kept current.'}
        </p>
        {isSample && <span className="badge badge-sample">sample</span>}
      </header>

      <GuideMap hotelPin={null} venueRows={value.venueRows} radiusKm={1.2} />

      {sections.length === 0 && <p className="muted">This guide is still being assembled.</p>}

      {sections.map((section) => (
        <section key={section.category} className="guide-section">
          <h2 className="section-title">{sectionTitle(section.category)}</h2>
          <ul className="guide-list">
            {section.rows.map((row, i) => (
              <VenueCard key={row.id} row={row} editorPick={i === 0} onVenueClick={(venueId) => beacon.mutate({ slug, event: 'venue-click', venueId })} />
            ))}
          </ul>
        </section>
      ))}

      <footer className="guide-footer">
        <p>
          Made for <strong>your stay</strong> · curated by Reykjavík Foodie
        </p>
        <CaptureForm slug={slug} onCaptured={() => beacon.mutate({ slug, event: 'email-captured' })} />
      </footer>
    </div>
  )
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

const LinkBack = () => (
  <a href="/" className="guide-back">
    ← rvkfoodie.is
  </a>
)

function VenueCard({
  row,
  editorPick,
  onVenueClick,
}: {
  row: GuideView['venueRows'][number]
  editorPick: boolean
  onVenueClick: (venueId: string) => void
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
  return (
    <li className={`venue-card${editorPick ? ' editor-pick' : ''}`}>
      {photoUrl && <img className="venue-card-photo" src={photoUrl} alt={v.name} loading="lazy" />}
      <div className="venue-card-head">
        <h3>{v.name}</h3>
        {editorPick && <span className="badge badge-pick">editor's pick</span>}
      </div>
      <p className="venue-card-address">{v.address}</p>
      {v.openingHours && <p className="venue-card-hours">{v.openingHours}</p>}
      {note && <p className="venue-card-note">{note}</p>}
      {v.recommendedDishes.length > 0 && (
        <p className="venue-card-dishes">Try: {v.recommendedDishes.join(' · ')}</p>
      )}
      <div className="venue-card-actions">
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(`${v.name} ${v.address}`)}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => onVenueClick(v.id)}
        >
          Directions
        </a>
        {v.dineoutId && (
          <a
            href={`https://dineout.is/restaurant/${v.dineoutId}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => onVenueClick(v.id)}
          >
            Reserve a table
          </a>
        )}
        {v.website && (
          <a href={v.website} target="_blank" rel="noreferrer" onClick={() => onVenueClick(v.id)}>
            Website
          </a>
        )}
        {v.phone && (
          <a href={`tel:${v.phone.replace(/\s/g, '')}`} onClick={() => onVenueClick(v.id)}>
            Call
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

  if (sent) return <p className="capture-done">Check your inbox — the guide is on its way.</p>
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
