/**
 * Venue edit form (Formisch + valibot). All fields editable; numeric and
 * date fields are strings in the form and parsed on submit — the wire
 * validates the real values server-side.
 */
import { Field, Form, useForm } from '@formisch/react'
import { useMemo } from 'react'
import { useResultMutation } from 'result-rpc/react'
import * as v from 'valibot'
import type { VenueRow } from '../models.js'
import { client } from '../rpc-client.js'
import { VENUE_CATEGORIES } from '../schema.js'

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  category: v.picklist(VENUE_CATEGORIES),
  categorySecondary: v.optional(v.string()),
  address: v.pipe(v.string(), v.minLength(1)),
  cuisine: v.optional(v.string()),
  priceLevel: v.optional(v.string()),
  openingHours: v.optional(v.string()),
  website: v.optional(v.string()),
  phone: v.optional(v.string()),
  lat: v.optional(v.string()),
  lon: v.optional(v.string()),
  note: v.optional(v.string()),
  tags: v.optional(v.string()),
  recommendedDishes: v.optional(v.string()),
  confidence: v.optional(v.string()),
  lastVerifiedAt: v.optional(v.string()),
})

type EditInput = v.InferInput<typeof schema>

const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? undefined : Number(s))
const int = (s: string | undefined) => (s === undefined || s.trim() === '' ? undefined : Number.parseInt(s, 10))
const split = (s: string | undefined) => (s === undefined ? undefined : s.split(',').map((x) => x.trim()).filter(Boolean))
const fmtDate = (ms: number | Date | null | undefined) => {
  if (ms === null || ms === undefined) return undefined
  const d = ms instanceof Date ? ms : new Date(ms)
  if (Number.isNaN(d.getTime())) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function VenueEditForm({ venue }: { venue: VenueRow }) {
  const form = useForm({
    schema,
    initialInput: useMemo<EditInput>(
      () => ({
        name: venue.name,
        category: venue.category as EditInput['category'],
        categorySecondary: venue.categorySecondary ?? '',
        address: venue.address,
        cuisine: venue.cuisine ?? '',
        priceLevel: venue.priceLevel !== null ? String(venue.priceLevel) : '',
        openingHours: venue.openingHours ?? '',
        website: venue.website ?? '',
        phone: venue.phone ?? '',
        lat: venue.lat !== null ? String(venue.lat) : '',
        lon: venue.lon !== null ? String(venue.lon) : '',
        note: venue.note ?? '',
        tags: venue.tags.join(', '),
        recommendedDishes: venue.recommendedDishes.join(', '),
        confidence: String(venue.confidence),
        lastVerifiedAt: fmtDate(venue.lastVerifiedAt) ?? '',
      }),
      [venue],
    ),
  })

  const update = useResultMutation(client.venues.update)

  const submit = async (input: EditInput) => {
    const result = await update.mutateAsync({
      id: venue.id,
      name: input.name.trim(),
      category: input.category,
      address: input.address.trim(),
      categorySecondary: input.categorySecondary?.trim() || undefined,
      cuisine: input.cuisine?.trim() || undefined,
      priceLevel: int(input.priceLevel),
      openingHours: input.openingHours?.trim() || undefined,
      website: input.website?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      lat: num(input.lat),
      lon: num(input.lon),
      note: input.note?.trim() || undefined,
      tags: split(input.tags),
      recommendedDishes: split(input.recommendedDishes),
      confidence: num(input.confidence),
      lastVerifiedAt: input.lastVerifiedAt ? new Date(input.lastVerifiedAt) : undefined,
    })
    if (!result.ok) throw new Error(result.error._tag)
  }

  const FieldText = ({ path, label, ...rest }: { path: readonly string[]; label: string; [k: string]: any }) => (
    <Field of={form} path={path as any}>
      {(s) => (
        <label className="form-field">
          <span>{label}</span>
          <input {...s.props} {...rest} />
          {s.errors && <em className="form-error">{s.errors[0]}</em>}
        </label>
      )}
    </Field>
  )

  return (
    <Form of={form} onSubmit={submit} className="venue-form">
      <div className="form-grid">
        <FieldText path={['name']} label="Name" />
        <Field of={form} path={['category']}>
          {(s) => (
            <label className="form-field">
              <span>Category</span>
              <select {...s.props}>
                {VENUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Field>
        <FieldText path={['categorySecondary']} label="Secondary category" placeholder="optional" />
        <FieldText path={['cuisine']} label="Cuisine" placeholder="e.g. Thai" />
        <FieldText path={['address']} label="Address" />
        <FieldText path={['openingHours']} label="Opening hours" placeholder="free text" />
        <FieldText path={['website']} label="Website" type="url" placeholder="https://…" />
        <FieldText path={['phone']} label="Phone" placeholder="555 1234" />
        <FieldText path={['priceLevel']} label="Price level (1–4)" type="number" min={1} max={4} placeholder="—" />
        <FieldText path={['confidence']} label="Confidence (0–1)" type="number" min={0} max={1} step={0.1} placeholder="0" />
        <FieldText path={['lastVerifiedAt']} label="Last verified" type="date" />
        <div className="form-grid form-grid-two">
          <FieldText path={['lat']} label="Latitude" placeholder="64.14…" />
          <FieldText path={['lon']} label="Longitude" placeholder="-21.93…" />
        </div>
        <FieldText path={['tags']} label="Tags" placeholder="free, family-friendly" />
        <FieldText path={['recommendedDishes']} label="Recommended dishes" placeholder="comma separated" />
        <Field of={form} path={['note']}>
          {(s) => (
            <label className="form-field form-field-wide">
              <span>Note</span>
              <textarea {...s.props} rows={4} />
            </label>
          )}
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={update.state === 'pending'}>
          {update.state === 'pending' ? 'Saving…' : 'Save changes'}
        </button>
        {update.state === 'success' && <span className="saved">Saved ✓</span>}
        {update.state === 'failure' && (
          <span className="error">
            {update.error._tag === 'venue/name-taken' ? 'Name already taken' : `Failed: ${update.error._tag}`}
          </span>
        )}
      </div>
    </Form>
  )
}
