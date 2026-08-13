/**
 * CRM — the business list (search) + add-business dialog. Business detail
 * (hotels / contacts / deals) lives at /app/crm/$businessId.
 */
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Button } from '@cloudflare/kumo/components/button'
import { Input, Textarea } from '@cloudflare/kumo/components/input'
import { Field as KumoField } from '@cloudflare/kumo/components/field'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Table } from '@cloudflare/kumo/components/table'
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
    if (result.status === 'ok') {
      reset(form)
      onClose()
      void router.navigate({ to: '/app/crm/$businessId', params: { businessId: result.value.id } })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <Dialog>
        <Dialog.Title>Add business</Dialog.Title>
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
                <Input value={s.input} {...s.props} type="url" placeholder="https://…" />
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
          {add.state === 'failure' && <p className="text-sm text-rose-600">Failed: {add.error._tag}</p>}
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" variant="primary" loading={add.state === 'pending'}>
              Add business
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

function Crm() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <CrmInner />
    </ResultRpcHydrationBoundary>
  )
}

function CrmInner() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const businesses = useResultQuery(client.businesses.list, {}, { staleTime: 60_000 })
  if (businesses.state === 'pending')
    return (
      <div className="flex items-center gap-2">
        <Loader size="sm" />
        <span className="text-sm text-slate-500">Loading businesses…</span>
      </div>
    )
  if (businesses.state === 'failure') return <p className="text-sm text-rose-600">Failed: {businesses.error._tag}</p>

  const rows = businesses.value.filter((b) =>
    q.trim() === '' || `${b.name} ${b.industry ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Businesses</h1>
        <span className="text-sm text-slate-500">{rows.length} shown</span>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          Add business
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search businesses…"
          aria-label="Search businesses"
        />
      </div>
      {rows.length > 0 && (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Industry</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((b) => (
              <Table.Row
                key={b.id}
                className="cursor-pointer hover:bg-kumo-tint"
                onClick={() => void router.navigate({ to: '/app/crm/$businessId', params: { businessId: b.id } })}
              >
                <Table.Cell>
                  <Link
                    to="/app/crm/$businessId"
                    params={{ businessId: b.id }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-kumo-link"
                  >
                    {b.name}
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-slate-500">{[b.industry, b.website].filter(Boolean).join(' · ') || '—'}</span>{' '}
                  <Badge variant="secondary">{b.industry ?? 'business'}</Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
      <AddBusinessDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
