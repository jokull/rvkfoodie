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

export function GuidePage({ slug, turnstileSiteKey }: { slug: string; turnstileSiteKey: string }) {
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
        <CaptureForm slug={slug} siteKey={turnstileSiteKey} onCaptured={() => beacon.mutate({ slug, event: 'email-captured' })} />
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
  return (
    <li className={`venue-card${editorPick ? ' editor-pick' : ''}`}>
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
      </div>
    </li>
  )
}

/**
 * "Email me this guide" — offline keeping. When a Turnstile site key is
 * configured the widget renders and the token rides the mutation; without
 * one (dev) the form works without it and the server skips verification.
 */
function CaptureForm({
  slug,
  siteKey,
  onCaptured,
}: {
  slug: string
  siteKey: string
  onCaptured: () => void
}) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const capture = useResultMutation(client.captures.request, {
    onSuccess: () => {
      setSent(true)
      onCaptured()
    },
  })

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return
    let cancelled = false
    void (async () => {
      await loadTurnstileScript()
      if (cancelled || !widgetRef.current) return
      const turnstile = (window as unknown as { turnstile?: TurnstileRender }).turnstile
      if (!turnstile) return
      turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(null),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [siteKey])

  if (sent) return <p className="capture-done">Check your inbox — the guide is on its way.</p>
  return (
    <form
      className="capture-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!email.trim()) return
        if (siteKey && !token) return
        capture.mutate({ slug, email: email.trim(), ...(token ? { turnstileToken: token } : {}) })
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
        <button type="submit" disabled={capture.state === 'pending' || (siteKey !== '' && !token)}>
          {capture.state === 'pending' ? 'Sending…' : 'Email me'}
        </button>
      </div>
      {siteKey && <div ref={widgetRef} className="turnstile-widget" />}
      {capture.state === 'failure' && (
        <p className="error">Couldn't send right now — try again later.</p>
      )}
    </form>
  )
}

interface TurnstileRender {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
    },
  ) => void
}

let scriptPromise: Promise<void> | null = null
const loadTurnstileScript = () => {
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
      )
      if (existing) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('turnstile script failed to load'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}
