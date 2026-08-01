/**
 * CRM — the business list (search) + add-business dialog. Business detail
 * (hotels / contacts / deals) lives at /app/crm/$businessId.
 */
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Dialog } from '@cloudflare/kumo'
import { Field, Form, reset, useForm } from '@formisch/react'
import { useState } from 'react'
import * as v from 'valibot'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import { prefetchCrm } from '../ssr.js'

export const Route = createFileRoute('/app/crm')({
  loader: () => prefetchCrm(),
  component: Crm,
})

const businessSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  website: v.optional(v.string()),
  industry: v.optional(v.string()),
  notes: v.optional(v.string()),
})

function AddBusinessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const add = useResultMutation(client.businesses.add)
  const form = useForm({ schema: businessSchema })

  const submit = async (input: v.InferInput<typeof businessSchema>) => {
    const result = await add.mutateAsync({
      name: input.name.trim(),
      website: input.website?.trim() || undefined,
      industry: input.industry?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    })
    if (result.ok) {
      reset(form)
      onClose()
      void router.navigate({ to: '/app/crm/$businessId', params: { businessId: result.value.id } })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <Dialog>
        <Dialog.Title>Add business</Dialog.Title>
        <Form of={form} onSubmit={submit} className="add-dialog">
          <Field of={form} path={['name']}>
            {(s) => (
              <label className="form-field">
                <span>Name</span>
                <input {...s.props} autoFocus />
                {s.errors && <em className="form-error">{s.errors[0]}</em>}
              </label>
            )}
          </Field>
          <Field of={form} path={['website']}>
            {(s) => (
              <label className="form-field">
                <span>Website (optional)</span>
                <input {...s.props} type="url" placeholder="https://…" />
              </label>
            )}
          </Field>
          <Field of={form} path={['industry']}>
            {(s) => (
              <label className="form-field">
                <span>Industry (optional)</span>
                <input {...s.props} placeholder="hotel-operator, tour…" />
              </label>
            )}
          </Field>
          <Field of={form} path={['notes']}>
            {(s) => (
              <label className="form-field">
                <span>Notes (optional)</span>
                <textarea {...s.props} rows={2} />
              </label>
            )}
          </Field>
          {add.state === 'failure' && <p className="error">Failed: {add.error._tag}</p>}
          <div className="form-actions">
            <button type="submit" disabled={add.state === 'pending'}>
              {add.state === 'pending' ? 'Adding…' : 'Add business'}
            </button>
            <Dialog.Close render={(props) => <button type="button" className="ghost" {...props}>Cancel</button>} />
          </div>
        </Form>
      </Dialog>
    </Dialog.Root>
  )
}

function Crm() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <CrmInner />
    </ResultRpcHydrationBoundary>
  )
}

function CrmInner() {
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const businesses = useResultQuery(client.businesses.list, {}, { staleTime: 60_000 })
  if (businesses.state === 'pending') return <p className="muted">Loading businesses…</p>
  if (businesses.state === 'failure') return <p className="error">Failed: {businesses.error._tag}</p>

  const rows = businesses.value.filter((b) =>
    q.trim() === '' || `${b.name} ${b.industry ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Businesses</h1>
        <span className="muted">{rows.length} shown</span>
        <button className="add-button" onClick={() => setAddOpen(true)}>
          Add business
        </button>
      </div>
      <div className="venue-filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search businesses…" aria-label="Search businesses" />
      </div>
      <ul className="venue-list">
        {rows.map((b) => (
          <li key={b.id}>
            <Link to="/app/crm/$businessId" params={{ businessId: b.id }} className="venue-row">
              <span className="venue-row-body">
                <strong>{b.name}</strong>
                <span className="muted small">
                  {[b.industry, b.website].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <span className="badge">{b.industry ?? 'business'}</span>
            </Link>
          </li>
        ))}
      </ul>
      <AddBusinessDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
