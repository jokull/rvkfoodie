/**
 * Public-site cards — ported from the legacy site's Tailwind markup. The
 * theme tokens (cream/ink/blue, Instrument Serif) live in styles.css.
 */
import type { CmsImage, Guide, Venue } from '../cms.js'
import { venueUrl } from '../venue-url.js'

const ImageTag = ({ image, alt, sizes = '128px' }: { image?: CmsImage; alt: string; sizes?: string }) => {
  if (!image?.url) return null
  return (
    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0">
      <img src={image.url} alt={image.alt ?? alt} width={image.width ?? undefined} height={image.height ?? undefined} sizes={sizes} className="w-full h-full object-cover" loading="lazy" />
    </div>
  )
}

export function VenueCard(props: Venue) {
  const { id, name, address, description, note, time, openingHours, googleMapsUrl, bestOfAward, grapevineUrl, image, website, phone } = props
  const mapsUrl =
    googleMapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address} Iceland`)}`
  const imgUrl = image?.url ?? null

  return (
    <article className="py-8 border-b border-ink/5 last:border-0">
      {time && (
        <p className="text-tiny leading-tiny text-blue font-medium tracking-wide uppercase mb-2">{time}</p>
      )}
      {bestOfAward && (
        <p className="text-tiny font-medium mb-2">
          {grapevineUrl ? (
            <a href={grapevineUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-blue hover:opacity-80 transition-opacity">
              🏆 {bestOfAward}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-blue">🏆 {bestOfAward}</span>
          )}
        </p>
      )}
      <div className={imgUrl ? 'flex gap-5 items-start' : undefined}>
        {imgUrl && <ImageTag image={image} alt={name} />}
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[1.75rem] leading-tight mb-1">
            <a href={venueUrl({ id, name })} className="hover:text-blue transition-colors">
              {name}
            </a>
          </h3>
          <p className="text-tiny text-ink-light mb-2">{address}</p>
          {description && <p className="text-normal leading-normal mb-2">{description}</p>}
          {note && <p className="text-tiny text-ink-light italic mb-2">{note}</p>}
          {openingHours && <p className="text-tiny text-ink-light mb-2">🕐 {openingHours}</p>}
          <div className="flex flex-wrap gap-3 text-tiny">
            <a href={mapsUrl} target="_blank" rel="noopener" className="text-blue hover:opacity-80 transition-opacity">
              Map ↗
            </a>
            {website && (
              <a href={/^https?:/.test(website) ? website : `https://${website}`} target="_blank" rel="noopener" className="text-blue hover:opacity-80 transition-opacity">
                Website ↗
              </a>
            )}
            {phone && <span className="text-ink-light">{phone}</span>}
          </div>
        </div>
      </div>
    </article>
  )
}

export function Paywall({
  gumroadUrl,
  price,
  hiddenCount,
  slug,
  productId,
  prefillKey,
  error,
  pending,
}: {
  gumroadUrl: string
  price: number
  hiddenCount: number
  slug: string
  productId: string
  prefillKey?: string
  error?: 'invalid' | undefined
  pending?: boolean
}) {
  const checkoutUrl = `/api/checkout?slug=${slug}&url=${encodeURIComponent(gumroadUrl)}`

  return (
    <div className="relative mt-4 mb-16">
      <div className="absolute inset-x-0 -top-32 h-32 bg-gradient-to-t from-cream to-transparent pointer-events-none" />
      <div className="border border-ink/10 rounded-2xl p-8 text-center">
        <p className="font-display text-[1.75rem] leading-tight mb-2">+{hiddenCount} more spots inside</p>
        <p className="text-ink-light mb-8">Unlock the full guide with all venues, tips, and Google Maps pins.</p>

        <a href={checkoutUrl} className="inline-block bg-blue text-white font-medium px-8 py-3 rounded-full hover:opacity-90 transition-opacity mb-8">
          Get the guide — ${price}
        </a>

        {pending && (
          <p className="text-tiny text-blue mb-4">Purchase received — your guide is being unlocked. Refresh this page in a moment.</p>
        )}

        <div className="border-t border-ink/10 pt-6">
          <p className="text-tiny text-ink-light mb-3">Already purchased? Enter your license key</p>
          <form method="POST" action="/api/claim" className="flex gap-2 max-w-sm mx-auto">
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="slug" value={slug} />
            <input
              type="text"
              name="license_key"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              defaultValue={prefillKey}
              required
              className="flex-1 border border-ink/15 rounded-lg px-4 py-2 text-tiny bg-white focus:outline-none focus:border-blue placeholder:text-ink/30"
            />
            <button type="submit" className="bg-ink text-cream text-tiny font-medium px-5 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Unlock
            </button>
          </form>
          {error && <p className="text-tiny text-red-600 mt-2">Invalid license key. Please try again.</p>}
        </div>
      </div>
    </div>
  )
}

export function GuideCard({ guide }: { guide: Guide }) {
  const totalVenues = guide.content.reduce((n, b) => (b.blockType === 'section' ? n + b.venues.length : n), 0)
  return (
    <a href={`/guides/${guide.slug}`} className="block border-b border-ink/10 py-6 group">
      <h3 className="font-display text-[1.75rem] leading-tight mb-1 group-hover:text-blue transition-colors">
        {guide.title}
      </h3>
      <p className="text-tiny text-ink-light mb-2">
        {guide.subtitle} · {totalVenues} venues
      </p>
      <p className="text-normal mb-2">{guide.description}</p>
      <p className="text-tiny text-blue font-medium">${guide.price} →</p>
    </a>
  )
}
