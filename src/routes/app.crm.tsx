/**
 * CRM — the business list (search + pipeline roll-up) + add-business dialog.
 * Business detail (hotels / contacts / deals) lives at /app/crm/$businessId.
 */
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Button } from '@cloudflare/kumo/components/button'
import { Input, Textarea } from '@cloudflare/kumo/components/input'
import { Field as KumoField } from '@cloudflare/kumo/components/field'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Table } from '@cloudflare/kumo/components/table'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Field, Form, reset, useForm } from '@formisch/react'
import { useState } from 'react'
import * as v from 'valibot'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import { prefetchCrm } from '../ssr.js'
import { errMsg, kr, stageLabel } from '../components/crm-shared.js'

export const Route = createFileRoute('/app/crm')({
  loader: () => prefetchCrm(),
  component: Crm,
})

const businessSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
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
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) add.reset()
        else onClose()
      }}
    >
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
          {add.state === 'failure' && <p className="text-sm text-rose-700">{errMsg(add.error)}</p>}
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

type DealSummary = { businessId: string; stage: string; annualValue: number; dealCount: number }

function CrmInner() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const businesses = useResultQuery(client.businesses.list, {}, { staleTime: 60_000 })
  const summaries = useResultQuery(client.businesses.summaries, {}, { staleTime: 60_000 })
  if (businesses.state === 'pending')
    return (
      <div className="flex items-center gap-2">
        <Loader size="sm" />
        <span className="text-sm text-slate-500">Loading businesses…</span>
      </div>
    )
  if (businesses.state === 'failure')
    return <p className="text-sm text-rose-700">{errMsg(businesses.error)}</p>

  const byId = new Map((summaries.state === 'success' ? summaries.value : []).map((s) => [s.businessId, s]))
  const all = businesses.value
  const rows = all.filter((b) =>
    q.trim() === '' || `${b.name} ${b.industry ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  )
  const openRow = (id: string) => void router.navigate({ to: '/app/crm/$businessId', params: { businessId: id } })

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          Businesses <span className="text-sm font-normal text-slate-500">{rows.length} of {all.length}</span>
        </h2>
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
          className="w-full max-w-xs"
        />
      </div>
      {rows.length === 0 ? (
        q.trim() !== '' ? (
          <Empty
            title={`No businesses match “${q}”`}
            description="Try a different name or industry, or add the business you're looking for."
            contents={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setQ('')}>
                  Clear search
                </Button>
                <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                  Add business
                </Button>
              </div>
            }
          />
        ) : (
          <Empty
            title="No businesses yet"
            description="Add the first account to start tracking hotels, contacts, and deals."
            contents={
              <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                Add business
              </Button>
            }
          />
        )
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Industry</Table.Head>
              <Table.Head>Pipeline</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((b) => {
              const s: DealSummary | undefined = byId.get(b.id)
              return (
                <Table.Row
                  key={b.id}
                  className="cursor-pointer hover:bg-kumo-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-kumo-focus"
                  tabIndex={0}
                  role="link"
                  onClick={() => openRow(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openRow(b.id)
                    }
                  }}
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
                    {b.industry ? (
                      <span className="text-sm text-slate-500">{b.industry}</span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {s && s.dealCount > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                        <Badge variant={s.stage === 'won' ? 'success' : s.stage === 'lost' ? 'warning' : 'secondary'}>
                          {stageLabel(s.stage)}
                        </Badge>
                        <span>
                          {s.dealCount} deal{s.dealCount === 1 ? '' : 's'} · {kr(s.annualValue)}/yr
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
      <AddBusinessDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
