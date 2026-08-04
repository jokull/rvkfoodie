/**
 * Business detail — hotels, contacts and deals for one operator. Deal stage
 * changes drive the pipeline; add forms are Formisch. Mutations return
 * entities, so list rows patch in place.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { Field, Form, reset, useForm } from '@formisch/react'
import { useState } from 'react'
import * as v from 'valibot'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery } from 'result-rpc/react'
import type { DealRow, HotelRow } from '../models.js'
import { client } from '../rpc-client.js'
import { PIPELINE_STAGES } from '../schema.js'
import { prefetchBusinessDetail } from '../ssr.js'

export const Route = createFileRoute('/app/crm_/$businessId')({
  loader: ({ params }) => prefetchBusinessDetail({ data: { id: params.businessId } }),
  component: BusinessDetail,
})

function BusinessDetail() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <BusinessDetailInner />
    </ResultRpcHydrationBoundary>
  )
}

function BusinessDetailInner() {
  const { businessId } = Route.useParams()
  const business = useResultQuery(client.businesses.byId, { id: businessId }, { staleTime: 60_000 })
  if (business.state === 'pending') return <p className="muted">Loading…</p>
  if (business.state === 'failure')
    return <p className="error">{business.error._tag === 'business/not-found' ? 'Business not found.' : `Failed: ${business.error._tag}`}</p>

  const b = business.value
  return (
    <div>
      <p className="muted small">
        <Link to="/app/crm">← all businesses</Link>
      </p>
      <div className="page-head">
        <h1 className="page-title">{b.name}</h1>
        {b.website && (
          <a href={b.website} target="_blank" rel="noreferrer" className="muted small">
            {b.website.replace(/^https?:\/\//, '')}
          </a>
        )}
        {b.industry && <span className="badge">{b.industry}</span>}
      </div>
      {b.notes && <p className="muted small">{b.notes}</p>}
      <Hotels businessId={businessId} />
      <Contacts businessId={businessId} />
      <Deals businessId={businessId} />
    </div>
  )
}

// --- Hotels --------------------------------------------------------------

const hotelSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  address: v.optional(v.string()),
  roomCount: v.pipe(v.string(), v.regex(/^\d+$/, 'rooms must be a number')),
  website: v.optional(v.string()),
})

function Hotels({ businessId }: { businessId: string }) {
  const hotels = useResultQuery(client.hotels.listByBusiness, { businessId }, { staleTime: 60_000 })
  const add = useResultMutation(client.hotels.add)
  const [open, setOpen] = useState(false)
  const form = useForm({ schema: hotelSchema })

  const submit = async (input: v.InferInput<typeof hotelSchema>) => {
    const result = await add.mutateAsync({
      businessId,
      name: input.name.trim(),
      address: input.address?.trim() || undefined,
      roomCount: Number.parseInt(input.roomCount, 10),
      website: input.website?.trim() || undefined,
    })
    if (result.status === 'ok') {
      reset(form)
      setOpen(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Hotels</h2>
        <button className="link-button" onClick={() => setOpen((o) => !o)}>
          {open ? 'cancel' : '+ add'}
        </button>
      </div>
      {open && (
        <Form of={form} onSubmit={submit} className="lifecycle-form">
          <Field of={form} path={['name']}>
            {(s) => <input {...s.props} placeholder="Hotel name" aria-label="Hotel name" />}
          </Field>
          <Field of={form} path={['address']}>
            {(s) => <input {...s.props} placeholder="Address" aria-label="Address" />}
          </Field>
          <Field of={form} path={['roomCount']}>
            {(s) => <input {...s.props} type="number" min={1} placeholder="Rooms" aria-label="Rooms" />}
          </Field>
          <Field of={form} path={['website']}>
            {(s) => <input {...s.props} placeholder="https://…" aria-label="Website" />}
          </Field>
          <button type="submit" disabled={add.state === 'pending'}>
            {add.state === 'pending' ? '…' : 'Add'}
          </button>
          {add.state === 'failure' && <span className="error">Failed: {add.error._tag}</span>}
        </Form>
      )}
      {hotels.state === 'pending' ? (
        <p className="muted small">…</p>
      ) : hotels.state === 'failure' ? (
        <p className="error">Failed: {hotels.error._tag}</p>
      ) : hotels.value.length === 0 ? (
        <p className="muted small">No hotels yet.</p>
      ) : (
        <ul className="event-list">
          {hotels.value.map((h) => (
            <li key={h.id}>
              <strong>{h.name}</strong>
              <span className="muted small">{h.roomCount} rooms</span>
              {h.address && <span className="muted small">{h.address}</span>}
              {h.website && (
                <a href={h.website} target="_blank" rel="noreferrer" className="muted small">
                  site
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Contacts ------------------------------------------------------------

const contactSchema = v.object({
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  title: v.optional(v.string()),
  isDecisionMaker: v.optional(v.boolean()),
})

function Contacts({ businessId }: { businessId: string }) {
  const contacts = useResultQuery(client.contacts.listByBusiness, { businessId }, { staleTime: 60_000 })
  const add = useResultMutation(client.contacts.add)
  const [open, setOpen] = useState(false)
  const form = useForm({ schema: contactSchema })

  const submit = async (input: v.InferInput<typeof contactSchema>) => {
    const result = await add.mutateAsync({
      businessId,
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      title: input.title?.trim() || undefined,
      isDecisionMaker: input.isDecisionMaker ?? false,
    })
    if (result.status === 'ok') {
      reset(form)
      setOpen(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Contacts</h2>
        <button className="link-button" onClick={() => setOpen((o) => !o)}>
          {open ? 'cancel' : '+ add'}
        </button>
      </div>
      {open && (
        <Form of={form} onSubmit={submit} className="lifecycle-form">
          <Field of={form} path={['firstName']}>
            {(s) => <input {...s.props} placeholder="First name" aria-label="First name" />}
          </Field>
          <Field of={form} path={['lastName']}>
            {(s) => <input {...s.props} placeholder="Last name" aria-label="Last name" />}
          </Field>
          <Field of={form} path={['title']}>
            {(s) => <input {...s.props} placeholder="Title" aria-label="Title" />}
          </Field>
          <Field of={form} path={['email']}>
            {(s) => <input {...s.props} type="email" placeholder="email" aria-label="Email" />}
          </Field>
          <Field of={form} path={['phone']}>
            {(s) => <input {...s.props} placeholder="phone" aria-label="Phone" />}
          </Field>
          <Field of={form} path={['isDecisionMaker']}>
            {(s) => (
              <label className="checkbox-label">
                <input {...s.props} type="checkbox" />
                <span>decision maker</span>
              </label>
            )}
          </Field>
          <button type="submit" disabled={add.state === 'pending'}>
            {add.state === 'pending' ? '…' : 'Add'}
          </button>
          {add.state === 'failure' && <span className="error">Failed: {add.error._tag}</span>}
        </Form>
      )}
      {contacts.state === 'pending' ? (
        <p className="muted small">…</p>
      ) : contacts.state === 'failure' ? (
        <p className="error">Failed: {contacts.error._tag}</p>
      ) : contacts.value.length === 0 ? (
        <p className="muted small">No contacts yet.</p>
      ) : (
        <ul className="event-list">
          {contacts.value.map((c) => (
            <li key={c.id}>
              <strong>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</strong>
              {c.title && <span className="muted small">{c.title}</span>}
              {c.isDecisionMaker && <span className="badge badge-pick">decision maker</span>}
              {c.email && <span className="muted small">{c.email}</span>}
              {c.phone && <span className="muted small">{c.phone}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Deals ---------------------------------------------------------------

const dealSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  stage: v.picklist(PIPELINE_STAGES),
  pricePerRoom: v.optional(v.string()),
  startDate: v.optional(v.string()),
  renewalDate: v.optional(v.string()),
  notes: v.optional(v.string()),
})

function Deals({ businessId }: { businessId: string }) {
  const deals = useResultQuery(client.deals.listByBusiness, { businessId }, { staleTime: 60_000 })
  const add = useResultMutation(client.deals.add)
  const update = useResultMutation(client.deals.update)
  const [open, setOpen] = useState(false)
  const form = useForm({ schema: dealSchema })

  const submit = async (input: v.InferInput<typeof dealSchema>) => {
    const result = await add.mutateAsync({
      businessId,
      name: input.name.trim(),
      stage: input.stage,
      pricePerRoom: input.pricePerRoom ? Number.parseInt(input.pricePerRoom, 10) : undefined,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      renewalDate: input.renewalDate ? new Date(input.renewalDate) : undefined,
      notes: input.notes?.trim() || undefined,
    })
    if (result.status === 'ok') {
      reset(form)
      setOpen(false)
    }
  }

  const fmt = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—')

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Deals</h2>
        <button className="link-button" onClick={() => setOpen((o) => !o)}>
          {open ? 'cancel' : '+ add'}
        </button>
      </div>
      {open && (
        <Form of={form} onSubmit={submit} className="lifecycle-form">
          <Field of={form} path={['name']}>
            {(s) => <input {...s.props} placeholder="Deal name" aria-label="Deal name" />}
          </Field>
          <Field of={form} path={['stage']}>
            {(s) => (
              <select {...s.props} aria-label="Stage">
                {PIPELINE_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field of={form} path={['pricePerRoom']}>
            {(s) => <input {...s.props} type="number" min={0} placeholder="Price/room" aria-label="Price per room" />}
          </Field>
          <Field of={form} path={['startDate']}>
            {(s) => <input {...s.props} type="date" aria-label="Start date" />}
          </Field>
          <Field of={form} path={['renewalDate']}>
            {(s) => <input {...s.props} type="date" aria-label="Renewal date" />}
          </Field>
          <Field of={form} path={['notes']}>
            {(s) => <input {...s.props} placeholder="Notes" aria-label="Notes" />}
          </Field>
          <button type="submit" disabled={add.state === 'pending'}>
            {add.state === 'pending' ? '…' : 'Add'}
          </button>
          {add.state === 'failure' && <span className="error">Failed: {add.error._tag}</span>}
        </Form>
      )}
      {deals.state === 'pending' ? (
        <p className="muted small">…</p>
      ) : deals.state === 'failure' ? (
        <p className="error">Failed: {deals.error._tag}</p>
      ) : deals.value.length === 0 ? (
        <p className="muted small">No deals yet.</p>
      ) : (
        <ul className="event-list">
          {deals.value.map((d: DealRow) => (
            <li key={d.id} className="deal-row">
              <strong>{d.name}</strong>
              <select
                value={d.stage}
                onChange={(e) => void update.mutate({ id: d.id, stage: e.target.value as (typeof PIPELINE_STAGES)[number] })}
                aria-label={`${d.name} stage`}
              >
                {PIPELINE_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <span className="muted small">
                {d.pricePerRoom !== null ? `${d.pricePerRoom} kr/room` : ''}
                {d.annualValue !== null ? ` · ${d.annualValue.toLocaleString()} kr/yr` : ''}
              </span>
              <span className="muted small">
                {fmt(d.startDate)} → {fmt(d.renewalDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
