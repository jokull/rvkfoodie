/**
 * Client-only Leaflet/OSM map — hotel pin + venue pins + radius ring.
 *
 * leaflet throws at import time in Node/workerd, so it is dynamically
 * imported inside useEffect — the module never loads server-side. Marker
 * icons use divIcon, so no icon-asset resolution is needed.
 */
import { useEffect, useRef } from 'react'
import type { GuideView } from '../models.js'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export function GuideMap({
  hotelPin,
  venueRows,
  radiusKm,
}: {
  hotelPin: { lat: number; lon: number } | null
  venueRows: GuideView['venueRows']
  radiusKm: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const pins = [
      ...(hotelPin ? [hotelPin] : []),
      ...venueRows.filter((r) => r.venue.lat !== null && r.venue.lon !== null).map((r) => ({
        lat: r.venue.lat!,
        lon: r.venue.lon!,
      })),
    ]
    if (pins.length === 0) return

    let map: import('leaflet').Map | null = null
    let cancelled = false

    void (async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !container) return

      const hotelIcon = L.divIcon({
        className: 'pin-hotel',
        html: '<div class="pin-dot pin-hotel-dot"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      const venueIcon = L.divIcon({
        className: 'pin-venue',
        html: '<div class="pin-dot pin-venue-dot"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })

      map = L.map(container, { scrollWheelZoom: false })
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR }).addTo(map)
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number]))

      if (hotelPin) {
        L.marker([hotelPin.lat, hotelPin.lon], { icon: hotelIcon })
          .addTo(map)
          .bindPopup('Your hotel')
        L.circle([hotelPin.lat, hotelPin.lon], {
          radius: radiusKm * 1000,
          className: 'radius-ring',
        }).addTo(map)
      }
      for (const r of venueRows) {
        if (r.venue.lat === null || r.venue.lon === null) continue
        L.marker([r.venue.lat, r.venue.lon], { icon: venueIcon })
          .addTo(map)
          .bindPopup(r.venue.name)
      }

      map.fitBounds(bounds, { padding: [24, 24] })
    })()

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [hotelPin, venueRows, radiusKm])

  const hasPins =
    hotelPin !== null || venueRows.some((r) => r.venue.lat !== null && r.venue.lon !== null)
  if (!hasPins) return null
  return <div ref={containerRef} className="guide-map" />
}
