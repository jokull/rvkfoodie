/**
 * Business detail — hotels, contacts and the deal pipeline board for one
 * operator. Add/edit forms are Formisch with visible labels; mutations
 * return entities, so list rows patch in place. Deal stage moves are
 * optimistic with rollback on failure and a confirm step into won/lost.
 */
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Button } from '@cloudflare/kumo/components/button'
import { Input, Textarea } from '@cloudflare/kumo/components/input'
import { Select } from '@cloudflare/kumo/components/select'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Field as KumoField } from '@cloudflare/kumo/components/field'
import { Table } from '@cloudflare/kumo/components/table'
import { CaretLeft, CaretRight, PencilSimple, Trash } from '@phosphor-icons/react'
import { Field, Form, reset, useForm } from '@formisch/react'
import { useState, type ReactNode } from 'react'
import * as v from 'valibot'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery } from 'result-rpc/react'
import type { DealRow, HotelRow, ContactRow, BusinessRow } from '../models.js'
import { client } from '../rpc-client.js'
import { PIPELINE_STAGES } from '../schema.js'
import { prefetchBusinessDetail } from '../ssr.js'
import { errMsg, fmtDate, kr, stageLabel, STAGE_ORDER } from '../components/crm-shared.js'

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

// --- Shared bits ----------------------------------------------------------

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel()
      }}
    >
      <Dialog>
        <Dialog.Title>{title}</Dialog.Title>
        <p className="text-sm text-slate-600">{description}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}

const escClose =
  (onClose: () => void, busy: boolean) =>
  (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !busy) onClose()
  }

function PanelHeader({ title, onCancel, busy }: { title: string; onCancel: () => void; busy?: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
    </div>
  )
}

// --- Business header + edit/delete ---------------------------------------

const businessSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
  website: v.optional(v.string()),
  industry: v.optional(v.string()),
  notes: v.optional(v.string()),
})

function BusinessEditDialog({
  business,
  open,
  onClose,
}: {
  business: BusinessRow
  open: boolean
  onClose: () => void
}) {
  const update = useResultMutation(client.businesses.update)
  const form = useForm({ schema: businessSchema, initialInput: { name: business.name, website: business.website ?? '', industry: business.industry ?? '', notes: business.notes ?? '' } })

  const submit = async (input: v.InferInput<typeof businessSchema>) => {
    const result = await update.mutateAsync({
      id: business.id,
      name: input.name.trim(),
      website: input.website?.trim() || undefined,
      industry: input.industry?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    })
    if (result.status === 'ok') onClose()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) update.reset()
        else onClose()
      }}
    >
      <Dialog>
        <Dialog.Title>Edit business</Dialog.Title>
        <Form of={form} onSubmit={submit} className="flex flex-col gap-3 p-4">
          <Field of={form} path={['name']}>
            {(s) => (
              <KumoField label="Name">
                <Input value={s.input} {...s.props} autoFocus error={s.errors?.[0]} />
              </KumoField>
            )}
          </Field>
          <Field of={form} path={['website']}>
            {(s) => (
              <KumoField label="Website (optional)">
                <Input value={s.input} {...s.props} type="url" placeholder="https://example.com" autoComplete="url" />
              </KumoField>
            )}
          </Field>
          <Field of={form} path={['industry']}>
            {(s) => (
              <KumoField label="Industry (optional)">
                <Input value={s.input} {...s.props} placeholder="hotel-operator, tour…" />
              </KumoField>
            )}
          </Field>
          <Field of={form} path={['notes']}>
            {(s) => (
              <KumoField label="Notes (optional)">
                <Textarea value={s.input} {...s.props} rows={2} />
              </KumoField>
            )}
          </Field>
          {update.state === 'failure' && <p className="text-sm text-rose-700">{errMsg(update.error)}</p>}
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" variant="primary" loading={update.state === 'pending'}>
              Save changes
            </Button>
            <Dialog.Close
              render={(props) => (
                <Button type="button" variant="ghost" {...props}>
                  Cancel
                </Button>
              )}
            />
          </div>
        </Form>
      </Dialog>
    </Dialog.Root>
  )
}

function BusinessDetailInner() {
  const router = useRouter()
  const { businessId } = Route.useParams()
  const business = useResultQuery(client.businesses.byId, { id: businessId }, { staleTime: 60_000 })
  const remove = useResultMutation(client.businesses.remove)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (business.state === 'pending')
    return (
      <div className="flex items-center gap-2">
        <Loader size="sm" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    )
  if (business.state === 'failure')
    return <p className="text-sm text-rose-700">{errMsg(business.error)}</p>

  const b = business.value
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link to="/app/crm" className="text-kumo-link hover:underline">
          ← all businesses
        </Link>
      </p>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold">{b.name}</h2>
        {b.website && (
          <a href={b.website} target="_blank" rel="noreferrer" className="text-sm text-kumo-link hover:underline">
            {b.website.replace(/^https?:\/\//, '')}
          </a>
        )}
        {b.industry && <Badge variant="secondary">{b.industry}</Badge>}
      </div>
      {b.notes && <p className="mb-4 text-sm text-slate-600">{b.notes}</p>}
      <div className="mb-4 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
          <PencilSimple className="size-4" />
          Edit
        </Button>
        <Button variant="secondary-destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash className="size-4" />
          Delete
        </Button>
      </div>
      <Hotels businessId={businessId} />
      <Contacts businessId={businessId} />
      <Deals businessId={businessId} />
      <BusinessEditDialog business={b} open={editOpen} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${b.name}”?`}
        description={`This permanently deletes the business and all of its hotels, contacts, and deals. This can't be undone.`}
        busy={remove.state === 'pending'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          void remove.mutateAsync({ id: b.id }).then((r) => {
            if (r.status === 'ok') void router.navigate({ to: '/app/crm' })
          })
        }}
      />
    </div>
  )
}

// --- Hotels --------------------------------------------------------------

const hotelSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
  address: v.optional(v.string()),
  roomCount: v.pipe(v.string(), v.regex(/^\d+$/, 'Rooms must be a whole number')),
  website: v.optional(v.string()),
})

function HotelForm({
  businessId,
  initial,
  onDone,
}: {
  businessId: string
  initial?: HotelRow
  onDone: () => void
}) {
  const add = useResultMutation(client.hotels.add)
  const update = useResultMutation(client.hotels.update)
  const pending = add.state === 'pending' || update.state === 'pending'
  const failure = add.state === 'failure' ? add.error : update.state === 'failure' ? update.error : null
  const form = useForm({
    schema: hotelSchema,
    initialInput: initial
      ? { name: initial.name, address: initial.address ?? '', roomCount: String(initial.roomCount ?? ''), website: initial.website ?? '' }
      : undefined,
  })

  const submit = async (input: v.InferInput<typeof hotelSchema>) => {
    const payload = {
      name: input.name.trim(),
      address: input.address?.trim() || undefined,
      roomCount: Number.parseInt(input.roomCount, 10),
      website: input.website?.trim() || undefined,
    }
    const result = initial
      ? await update.mutateAsync({ id: initial.id, ...payload })
      : await add.mutateAsync({ businessId, ...payload })
    if (result.status === 'ok') {
      reset(form)
      onDone()
    }
  }

  return (
    <div
      className="mb-3 rounded-md border border-slate-200 bg-slate-50/60 p-3"
      onKeyDown={escClose(onDone, pending)}
    >
      <PanelHeader title={initial ? 'Edit hotel' : 'Add hotel'} onCancel={onDone} busy={pending} />
      <Form of={form} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field of={form} path={['name']}>
          {(s) => (
            <KumoField label="Hotel name">
              <Input value={s.input} {...s.props} autoFocus placeholder="Hotel Hótel" error={s.errors?.[0]} />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['roomCount']}>
          {(s) => (
            <KumoField label="Rooms">
              <Input value={s.input} {...s.props} type="number" min={1} placeholder="120" error={s.errors?.[0]} />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['address']}>
          {(s) => (
            <KumoField label="Address (optional)">
              <Input value={s.input} {...s.props} placeholder="Laugavegur 1" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['website']}>
          {(s) => (
            <KumoField label="Website (optional)">
              <Input value={s.input} {...s.props} placeholder="https://example.com" autoComplete="url" />
            </KumoField>
          )}
        </Field>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            {initial ? 'Save' : 'Add hotel'}
          </Button>
          {failure && <span className="text-sm text-rose-700">{errMsg(failure)}</span>}
        </div>
      </Form>
    </div>
  )
}

function Hotels({ businessId }: { businessId: string }) {
  const hotels = useResultQuery(client.hotels.listByBusiness, { businessId }, { staleTime: 60_000 })
  const remove = useResultMutation(client.hotels.remove)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HotelRow | null>(null)
  const [confirming, setConfirming] = useState<HotelRow | null>(null)

  return (
    <Section
      title="Hotels"
      action={
        <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
          Add hotel
        </Button>
      }
    >
      {open && <HotelForm businessId={businessId} onDone={() => setOpen(false)} />}
      {editing && (
        <HotelForm businessId={businessId} initial={editing} onDone={() => setEditing(null)} />
      )}
      {hotels.state === 'pending' ? (
        <Loader size="sm" />
      ) : hotels.state === 'failure' ? (
        <p className="text-sm text-rose-700">{errMsg(hotels.error)}</p>
      ) : hotels.value.length === 0 ? (
        <Empty
          size="sm"
          title="No hotels yet"
          description="Add the first property — guides are generated per hotel."
          contents={
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Add hotel
            </Button>
          }
        />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Hotel</Table.Head>
              <Table.Head>Rooms</Table.Head>
              <Table.Head>Address</Table.Head>
              <Table.Head>Website</Table.Head>
              <Table.Head className="w-20" />
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
                    <a href={h.website} target="_blank" rel="noreferrer" className="text-sm text-kumo-link hover:underline">
                      site
                    </a>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label={`Edit ${h.name}`} onClick={() => { setOpen(false); setEditing(h) }}>
                      <PencilSimple className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${h.name}`} onClick={() => setConfirming(h)}>
                      <Trash className="size-4" />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={`Delete “${confirming?.name ?? ''}”?`}
        description="Contacts stay, but their link to this hotel is removed."
        busy={remove.state === 'pending'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) remove.mutate({ id: confirming.id })
          setConfirming(null)
        }}
      />
    </Section>
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

function ContactForm({
  businessId,
  initial,
  onDone,
}: {
  businessId: string
  initial?: ContactRow
  onDone: () => void
}) {
  const add = useResultMutation(client.contacts.add)
  const update = useResultMutation(client.contacts.update)
  const pending = add.state === 'pending' || update.state === 'pending'
  const failure = add.state === 'failure' ? add.error : update.state === 'failure' ? update.error : null
  const form = useForm({
    schema: contactSchema,
    initialInput: initial
      ? {
          firstName: initial.firstName ?? '',
          lastName: initial.lastName ?? '',
          email: initial.email ?? '',
          phone: initial.phone ?? '',
          title: initial.title ?? '',
          isDecisionMaker: initial.isDecisionMaker,
        }
      : undefined,
  })

  const submit = async (input: v.InferInput<typeof contactSchema>) => {
    const payload = {
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      title: input.title?.trim() || undefined,
      isDecisionMaker: input.isDecisionMaker ?? false,
    }
    const result = initial
      ? await update.mutateAsync({ id: initial.id, ...payload })
      : await add.mutateAsync({ businessId, ...payload })
    if (result.status === 'ok') {
      reset(form)
      onDone()
    }
  }

  return (
    <div
      className="mb-3 rounded-md border border-slate-200 bg-slate-50/60 p-3"
      onKeyDown={escClose(onDone, pending)}
    >
      <PanelHeader title={initial ? 'Edit contact' : 'Add contact'} onCancel={onDone} busy={pending} />
      <Form of={form} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field of={form} path={['firstName']}>
          {(s) => (
            <KumoField label="First name">
              <Input value={s.input} {...s.props} autoFocus autoComplete="given-name" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['lastName']}>
          {(s) => (
            <KumoField label="Last name">
              <Input value={s.input} {...s.props} autoComplete="family-name" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['title']}>
          {(s) => (
            <KumoField label="Title (optional)">
              <Input value={s.input} {...s.props} placeholder="General manager" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['email']}>
          {(s) => (
            <KumoField label="Email (optional)">
              <Input value={s.input} {...s.props} type="email" autoComplete="email" placeholder="name@example.com" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['phone']}>
          {(s) => (
            <KumoField label="Phone (optional)">
              <Input value={s.input} {...s.props} type="tel" autoComplete="tel" placeholder="+354 555 1234" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['isDecisionMaker']}>
          {(s) => (
            <label className="flex h-9 items-center gap-2 text-sm">
              <input {...s.props} type="checkbox" checked={s.input ?? false} className="size-4 accent-kumo-focus" />
              <span>Decision maker</span>
            </label>
          )}
        </Field>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            {initial ? 'Save' : 'Add contact'}
          </Button>
          {failure && <span className="text-sm text-rose-700">{errMsg(failure)}</span>}
        </div>
      </Form>
    </div>
  )
}

function Contacts({ businessId }: { businessId: string }) {
  const contacts = useResultQuery(client.contacts.listByBusiness, { businessId }, { staleTime: 60_000 })
  const remove = useResultMutation(client.contacts.remove)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContactRow | null>(null)
  const [confirming, setConfirming] = useState<ContactRow | null>(null)

  const displayName = (c: ContactRow) => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unnamed contact'

  return (
    <Section
      title="Contacts"
      action={
        <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
          Add contact
        </Button>
      }
    >
      {open && <ContactForm businessId={businessId} onDone={() => setOpen(false)} />}
      {editing && <ContactForm businessId={businessId} initial={editing} onDone={() => setEditing(null)} />}
      {contacts.state === 'pending' ? (
        <Loader size="sm" />
      ) : contacts.state === 'failure' ? (
        <p className="text-sm text-rose-700">{errMsg(contacts.error)}</p>
      ) : contacts.value.length === 0 ? (
        <Empty
          size="sm"
          title="No contacts yet"
          description="Add the people at this business — mark decision makers so the sales flow can reach the right person."
          contents={
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Add contact
            </Button>
          }
        />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Contact</Table.Head>
              <Table.Head>Title</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Phone</Table.Head>
              <Table.Head className="w-20" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {contacts.value.map((c) => (
              <Table.Row key={c.id}>
                <Table.Cell>
                  <span className="font-medium">{displayName(c)}</span>{' '}
                  {c.isDecisionMaker && <Badge variant="warning">decision maker</Badge>}
                </Table.Cell>
                <Table.Cell>{c.title && <span className="text-sm text-slate-500">{c.title}</span>}</Table.Cell>
                <Table.Cell>{c.email && <span className="text-sm text-slate-500">{c.email}</span>}</Table.Cell>
                <Table.Cell>{c.phone && <span className="text-sm text-slate-500">{c.phone}</span>}</Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label={`Edit ${displayName(c)}`} onClick={() => { setOpen(false); setEditing(c) }}>
                      <PencilSimple className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${displayName(c)}`} onClick={() => setConfirming(c)}>
                      <Trash className="size-4" />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={`Delete ${confirming ? displayName(confirming) : ''}?`}
        description="This removes the contact from the business."
        busy={remove.state === 'pending'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) remove.mutate({ id: confirming.id })
          setConfirming(null)
        }}
      />
    </Section>
  )
}

// --- Deals: pipeline board ------------------------------------------------

const dealSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Deal name is required')),
  stage: v.picklist(PIPELINE_STAGES),
  pricePerRoom: v.optional(v.string()),
  startDate: v.optional(v.string()),
  renewalDate: v.optional(v.string()),
  notes: v.optional(v.string()),
})

function DealForm({
  businessId,
  initial,
  onDone,
}: {
  businessId: string
  initial?: DealRow
  onDone: () => void
}) {
  const add = useResultMutation(client.deals.add)
  const update = useResultMutation(client.deals.update)
  const pending = add.state === 'pending' || update.state === 'pending'
  const failure = add.state === 'failure' ? add.error : update.state === 'failure' ? update.error : null
  const form = useForm({
    schema: dealSchema,
    initialInput: initial
      ? {
          name: initial.name,
          stage: initial.stage as (typeof PIPELINE_STAGES)[number],
          pricePerRoom: initial.pricePerRoom !== null && initial.pricePerRoom !== undefined ? String(initial.pricePerRoom) : '',
          startDate: initial.startDate ? new Date(initial.startDate).toISOString().slice(0, 10) : '',
          renewalDate: initial.renewalDate ? new Date(initial.renewalDate).toISOString().slice(0, 10) : '',
          notes: initial.notes ?? '',
        }
      : undefined,
  })

  const submit = async (input: v.InferInput<typeof dealSchema>) => {
    const payload = {
      name: input.name.trim(),
      stage: input.stage,
      pricePerRoom: input.pricePerRoom ? Number.parseInt(input.pricePerRoom, 10) : undefined,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      renewalDate: input.renewalDate ? new Date(input.renewalDate) : undefined,
      notes: input.notes?.trim() || undefined,
    }
    const result = initial
      ? await update.mutateAsync({ id: initial.id, ...payload })
      : await add.mutateAsync({ businessId, ...payload })
    if (result.status === 'ok') {
      reset(form)
      onDone()
    }
  }

  return (
    <div
      className="mb-3 rounded-md border border-slate-200 bg-slate-50/60 p-3"
      onKeyDown={escClose(onDone, pending)}
    >
      <PanelHeader title={initial ? 'Edit deal' : 'Add deal'} onCancel={onDone} busy={pending} />
      <Form of={form} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field of={form} path={['name']}>
          {(s) => (
            <KumoField label="Deal name">
              <Input value={s.input} {...s.props} autoFocus placeholder="Annual guide subscription" error={s.errors?.[0]} />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['stage']}>
          {(s) => (
            <KumoField label="Stage">
              <Select
                size="sm"
                aria-label="Stage"
                value={s.input ?? 'prospect'}
                onValueChange={(stage) => s.onChange(stage ?? 'prospect')}
                items={Object.fromEntries(PIPELINE_STAGES.map((st) => [st, stageLabel(st)]))}
              />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['pricePerRoom']}>
          {(s) => (
            <KumoField label="Price per room (optional)">
              <Input value={s.input} {...s.props} type="number" min={0} placeholder="3600" error={s.errors?.[0]} />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['notes']}>
          {(s) => (
            <KumoField label="Notes (optional)">
              <Input value={s.input} {...s.props} placeholder="What was discussed…" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['startDate']}>
          {(s) => (
            <KumoField label="Start date (optional)">
              <Input value={s.input} {...s.props} type="date" />
            </KumoField>
          )}
        </Field>
        <Field of={form} path={['renewalDate']}>
          {(s) => (
            <KumoField label="Renewal date (optional)">
              <Input value={s.input} {...s.props} type="date" />
            </KumoField>
          )}
        </Field>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            {initial ? 'Save' : 'Add deal'}
          </Button>
          {failure && <span className="text-sm text-rose-700">{errMsg(failure)}</span>}
        </div>
      </Form>
    </div>
  )
}

function DealCard({
  deal,
  pending,
  error,
  onMove,
  onEdit,
  onDelete,
}: {
  deal: DealRow
  pending: boolean
  error?: string | null
  onMove: (stage: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const idx = STAGE_ORDER.indexOf(deal.stage)
  const prev = idx > 0 ? STAGE_ORDER[idx - 1] : undefined
  const next = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : undefined
  const hasValue = deal.pricePerRoom !== null || deal.annualValue !== null
  const hasDates = deal.startDate !== null || deal.renewalDate !== null

  const arrow = (to: string | undefined, dir: 'prev' | 'next') => (
    <button
      type="button"
      disabled={!to || pending}
      aria-label={to ? `Move to ${stageLabel(to)}` : 'No further stage'}
      onClick={() => to && onMove(to)}
      className="rounded p-0.5 text-slate-400 transition-colors hover:bg-kumo-tint hover:text-kumo-default disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-kumo-focus"
    >
      {dir === 'prev' ? <CaretLeft className="size-4" /> : <CaretRight className="size-4" />}
    </button>
  )

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{deal.name}</p>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            aria-label={`Edit ${deal.name}`}
            onClick={onEdit}
            className="rounded p-0.5 text-slate-400 transition-colors hover:bg-kumo-tint hover:text-kumo-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-kumo-focus"
          >
            <PencilSimple className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${deal.name}`}
            onClick={onDelete}
            className="rounded p-0.5 text-slate-400 transition-colors hover:bg-kumo-tint hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-kumo-focus"
          >
            <Trash className="size-3.5" />
          </button>
        </div>
      </div>
      {hasValue && (
        <p className="mt-1 text-xs text-slate-500" title="Annual value = price per room × rooms, computed at deal time">
          {deal.pricePerRoom !== null ? `${kr(deal.pricePerRoom)}/room · ` : ''}
          {deal.annualValue !== null ? `${kr(deal.annualValue)}/yr` : ''}
        </p>
      )}
      {hasDates && (
        <p className="text-xs text-slate-400">
          {fmtDate(deal.startDate)} → {fmtDate(deal.renewalDate)}
        </p>
      )}
      {deal.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{deal.notes}</p>}
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5">
        {arrow(prev, 'prev')}
        {pending ? (
          <Loader size="sm" />
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-300">·</span>
        )}
        {arrow(next, 'next')}
      </div>
    </div>
  )
}

function Deals({ businessId }: { businessId: string }) {
  const deals = useResultQuery(client.deals.listByBusiness, { businessId }, { staleTime: 60_000 })
  const remove = useResultMutation(client.deals.remove)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DealRow | null>(null)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [stageError, setStageError] = useState<{ id: string; msg: string } | null>(null)
  const [confirmMove, setConfirmMove] = useState<{ deal: DealRow; to: string } | null>(null)
  const [confirming, setConfirming] = useState<DealRow | null>(null)

  const move = useResultMutation(client.deals.update, {
    optimistic: (input, cache) => {
      const rollback = cache.update(client.deals.listByBusiness, { businessId }, (rows) =>
        rows?.map((d) => (d.id === input.id ? { ...d, stage: input.stage ?? d.stage } : d)),
      )
      return { rollback }
    },
    onFailure: (error, input) => setStageError({ id: input.id, msg: errMsg(error) }),
    onSettled: (_result, input) => {
      setPendingIds((prev) => {
        if (!prev.has(input.id)) return prev
        const next = new Set(prev)
        next.delete(input.id)
        return next
      })
    },
  })

  const runMove = (deal: DealRow, to: string) => {
    setStageError(null)
    setPendingIds((prev) => new Set(prev).add(deal.id))
    move.mutate({ id: deal.id, stage: to as (typeof PIPELINE_STAGES)[number] })
  }

  const requestMove = (deal: DealRow, to: string) => {
    if (to === 'won' || to === 'lost') setConfirmMove({ deal, to })
    else runMove(deal, to)
  }

  return (
    <Section
      title="Deals"
      action={
        <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
          Add deal
        </Button>
      }
    >
      {open && <DealForm businessId={businessId} onDone={() => setOpen(false)} />}
      {editing && <DealForm businessId={businessId} initial={editing} onDone={() => setEditing(null)} />}
      {deals.state === 'pending' ? (
        <Loader size="sm" />
      ) : deals.state === 'failure' ? (
        <p className="text-sm text-rose-700">{errMsg(deals.error)}</p>
      ) : deals.value.length === 0 ? (
        <Empty
          size="sm"
          title="No deals yet"
          description="Track the subscription opportunity — the board follows it from prospect to won (or lost)."
          contents={
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Add deal
            </Button>
          }
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGE_ORDER.map((stage) => {
            const cards = deals.value.filter((d) => d.stage === stage)
            return (
              <div key={stage} className="min-w-[210px] flex-1 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stageLabel(stage)}</span>
                  <span className="text-xs tabular-nums text-slate-400">{cards.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {cards.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      pending={pendingIds.has(d.id)}
                      error={stageError?.id === d.id ? stageError.msg : null}
                      onMove={(to) => requestMove(d, to)}
                      onEdit={() => { setOpen(false); setEditing(d) }}
                      onDelete={() => setConfirming(d)}
                    />
                  ))}
                  {cards.length === 0 && <p className="px-1 text-xs text-slate-300">—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ConfirmDialog
        open={confirmMove !== null}
        title={`Move “${confirmMove?.deal.name ?? ''}” to ${confirmMove ? stageLabel(confirmMove.to) : ''}?`}
        description={
          confirmMove?.to === 'won'
            ? 'This marks the deal as won — the account should be moved into the live pipeline.'
            : 'This marks the deal as lost and removes it from active follow-up.'
        }
        confirmLabel={`Move to ${confirmMove ? stageLabel(confirmMove.to) : ''}`}
        busy={move.state === 'pending'}
        onCancel={() => setConfirmMove(null)}
        onConfirm={() => {
          if (confirmMove) runMove(confirmMove.deal, confirmMove.to)
          setConfirmMove(null)
        }}
      />
      <ConfirmDialog
        open={confirming !== null}
        title={`Delete “${confirming?.name ?? ''}”?`}
        description="This removes the deal from the pipeline."
        busy={remove.state === 'pending'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) remove.mutate({ id: confirming.id })
          setConfirming(null)
        }}
      />
    </Section>
  )
}
