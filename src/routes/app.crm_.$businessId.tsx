/**
 * Business detail — hotels, contacts and deals for one operator. Deal stage
 * changes drive the pipeline; add forms are Formisch. Mutations return
 * entities, so list rows patch in place.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@cloudflare/kumo/components/button'
import { Input } from '@cloudflare/kumo/components/input'
import { Select } from '@cloudflare/kumo/components/select'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Table } from '@cloudflare/kumo/components/table'
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
  if (business.state === 'pending')
    return (
      <div className="flex items-center gap-2">
        <Loader size="sm" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    )
  if (business.state === 'failure')
    return <p className="text-sm text-rose-600">{business.error._tag === 'business/not-found' ? 'Business not found.' : `Failed: ${business.error._tag}`}</p>

  const b = business.value
  return (
    <div>
      <p className="text-sm text-slate-500">
        <Link to="/app/crm">← all businesses</Link>
      </p>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">{b.name}</h1>
        {b.website && (
          <a href={b.website} target="_blank" rel="noreferrer" className="text-sm text-slate-500">
            {b.website.replace(/^https?:\/\//, '')}
          </a>
        )}
        {b.industry && <Badge variant="secondary">{b.industry}</Badge>}
      </div>
      {b.notes && <p className="text-sm text-slate-500">{b.notes}</p>}
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
    <section className="mb-6 rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Hotels</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'cancel' : '+ add'}
        </Button>
      </div>
      {open && (
        <Form of={form} onSubmit={submit} className="mb-3 flex flex-wrap gap-2">
          <Field of={form} path={['name']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="Hotel name" aria-label="Hotel name" />}
          </Field>
          <Field of={form} path={['address']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="Address" aria-label="Address" />}
          </Field>
          <Field of={form} path={['roomCount']}>
            {(s) => <Input value={s.input} {...s.props} type="number" min={1} placeholder="Rooms" aria-label="Rooms" />}
          </Field>
          <Field of={form} path={['website']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="https://…" aria-label="Website" />}
          </Field>
          <Button type="submit" variant="secondary" size="sm" loading={add.state === 'pending'}>
            Add
          </Button>
          {add.state === 'failure' && <span className="text-sm text-rose-600">Failed: {add.error._tag}</span>}
        </Form>
      )}
      {hotels.state === 'pending' ? (
        <Loader size="sm" />
      ) : hotels.state === 'failure' ? (
        <p className="text-sm text-rose-600">Failed: {hotels.error._tag}</p>
      ) : hotels.value.length === 0 ? (
        <Empty size="sm" title="No hotels yet." />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Hotel</Table.Head>
              <Table.Head>Rooms</Table.Head>
              <Table.Head>Address</Table.Head>
              <Table.Head>Website</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {hotels.value.map((h) => (
              <Table.Row key={h.id}>
                <Table.Cell className="font-medium">{h.name}</Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-slate-500">{h.roomCount} rooms</span>
                </Table.Cell>
                <Table.Cell>{h.address && <span className="text-sm text-slate-500">{h.address}</span>}</Table.Cell>
                <Table.Cell>
                  {h.website && (
                    <a href={h.website} target="_blank" rel="noreferrer" className="text-sm text-slate-500">
                      site
                    </a>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
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
    <section className="mb-6 rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Contacts</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'cancel' : '+ add'}
        </Button>
      </div>
      {open && (
        <Form of={form} onSubmit={submit} className="mb-3 flex flex-wrap gap-2">
          <Field of={form} path={['firstName']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="First name" aria-label="First name" />}
          </Field>
          <Field of={form} path={['lastName']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="Last name" aria-label="Last name" />}
          </Field>
          <Field of={form} path={['title']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="Title" aria-label="Title" />}
          </Field>
          <Field of={form} path={['email']}>
            {(s) => <Input value={s.input} {...s.props} type="email" placeholder="email" aria-label="Email" />}
          </Field>
          <Field of={form} path={['phone']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="phone" aria-label="Phone" />}
          </Field>
          <Field of={form} path={['isDecisionMaker']}>
            {(s) => (
              <label className="flex items-center gap-1.5 text-sm">
                <input {...s.props} type="checkbox" />
                <span>decision maker</span>
              </label>
            )}
          </Field>
          <Button type="submit" variant="secondary" size="sm" loading={add.state === 'pending'}>
            Add
          </Button>
          {add.state === 'failure' && <span className="text-sm text-rose-600">Failed: {add.error._tag}</span>}
        </Form>
      )}
      {contacts.state === 'pending' ? (
        <Loader size="sm" />
      ) : contacts.state === 'failure' ? (
        <p className="text-sm text-rose-600">Failed: {contacts.error._tag}</p>
      ) : contacts.value.length === 0 ? (
        <Empty size="sm" title="No contacts yet." />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Contact</Table.Head>
              <Table.Head>Title</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Phone</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {contacts.value.map((c) => (
              <Table.Row key={c.id}>
                <Table.Cell>
                  <span className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</span>{' '}
                  {c.isDecisionMaker && <Badge variant="warning">decision maker</Badge>}
                </Table.Cell>
                <Table.Cell>{c.title && <span className="text-sm text-slate-500">{c.title}</span>}</Table.Cell>
                <Table.Cell>{c.email && <span className="text-sm text-slate-500">{c.email}</span>}</Table.Cell>
                <Table.Cell>{c.phone && <span className="text-sm text-slate-500">{c.phone}</span>}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
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

const STAGE_ITEMS: Record<(typeof PIPELINE_STAGES)[number], string> = Object.fromEntries(
  PIPELINE_STAGES.map((st) => [st, st]),
) as Record<(typeof PIPELINE_STAGES)[number], string>

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
    <section className="mb-6 rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Deals</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'cancel' : '+ add'}
        </Button>
      </div>
      {open && (
        <Form of={form} onSubmit={submit} className="mb-3 flex flex-wrap gap-2">
          <Field of={form} path={['name']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="Deal name" aria-label="Deal name" />}
          </Field>
          <Field of={form} path={['stage']}>
            {(s) => (
              <Select
                size="sm"
                aria-label="Stage"
                value={s.input ?? PIPELINE_STAGES[0]}
                onValueChange={(stage) => s.onChange(stage ?? PIPELINE_STAGES[0])}
                items={STAGE_ITEMS}
              />
            )}
          </Field>
          <Field of={form} path={['pricePerRoom']}>
            {(s) => <Input value={s.input} {...s.props} type="number" min={0} placeholder="Price/room" aria-label="Price per room" />}
          </Field>
          <Field of={form} path={['startDate']}>
            {(s) => <Input value={s.input} {...s.props} type="date" aria-label="Start date" />}
          </Field>
          <Field of={form} path={['renewalDate']}>
            {(s) => <Input value={s.input} {...s.props} type="date" aria-label="Renewal date" />}
          </Field>
          <Field of={form} path={['notes']}>
            {(s) => <Input value={s.input} {...s.props} placeholder="Notes" aria-label="Notes" />}
          </Field>
          <Button type="submit" variant="secondary" size="sm" loading={add.state === 'pending'}>
            Add
          </Button>
          {add.state === 'failure' && <span className="text-sm text-rose-600">Failed: {add.error._tag}</span>}
        </Form>
      )}
      {deals.state === 'pending' ? (
        <Loader size="sm" />
      ) : deals.state === 'failure' ? (
        <p className="text-sm text-rose-600">Failed: {deals.error._tag}</p>
      ) : deals.value.length === 0 ? (
        <Empty size="sm" title="No deals yet." />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Deal</Table.Head>
              <Table.Head>Stage</Table.Head>
              <Table.Head>Value</Table.Head>
              <Table.Head>Dates</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {deals.value.map((d: DealRow) => (
              <Table.Row key={d.id}>
                <Table.Cell className="font-medium">{d.name}</Table.Cell>
                <Table.Cell>
                  <Select
                    size="sm"
                    value={d.stage as (typeof PIPELINE_STAGES)[number]}
                    onValueChange={(stage) => {
                      if (stage) void update.mutate({ id: d.id, stage })
                    }}
                    aria-label={`${d.name} stage`}
                    items={STAGE_ITEMS}
                  />
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-slate-500">
                    {d.pricePerRoom !== null ? `${d.pricePerRoom} kr/room` : ''}
                    {d.annualValue !== null ? ` · ${d.annualValue.toLocaleString()} kr/yr` : ''}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-slate-500">
                    {fmt(d.startDate)} → {fmt(d.renewalDate)}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </section>
  )
}
