/**
 * Add-venue dialog. Minimal fields; the rest lands on the detail form.
 * On success the new venue (status draft) is patched into the feed cache
 * and the user is taken to its detail.
 */
import { Button } from '@cloudflare/kumo/components/button'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Field } from '@cloudflare/kumo/components/field'
import { Input } from '@cloudflare/kumo/components/input'
import { Select } from '@cloudflare/kumo/components/select'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useResultMutation } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import { VENUE_CATEGORIES } from '../schema.js'

export function AddVenueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const add = useResultMutation(client.venues.add)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(VENUE_CATEGORIES[0])
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !address.trim()) return
    const result = await add.mutateAsync({
      name: name.trim(),
      category: category as (typeof VENUE_CATEGORIES)[number],
      address: address.trim(),
      website: website.trim() || undefined,
    })
    if (result.status === 'ok') {
      setName('')
      setAddress('')
      setWebsite('')
      onClose()
      void router.navigate({ to: '/app/venues/$venueId', params: { venueId: result.value.id } })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <Dialog>
        <Dialog.Title>Add venue</Dialog.Title>
        <form className="flex flex-col gap-3 p-4" onSubmit={submit}>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Select label="Category" value={category} onValueChange={(v) => v !== null && setCategory(v)}>
            {VENUE_CATEGORIES.map((c) => (
              <Select.Option key={c} value={c}>
                {c}
              </Select.Option>
            ))}
          </Select>
          <Field label="Address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Website (optional)">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </Field>
          {add.state === 'failure' && (
            <p className="text-sm text-rose-600">
              {add.error._tag === 'venue/name-taken' ? 'Name already taken' : `Failed: ${add.error._tag}`}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" variant="primary" loading={add.state === 'pending'}>
              Add venue
            </Button>
            <Dialog.Close render={(props) => <Button {...props} type="button" variant="secondary">Cancel</Button>} />
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  )
}
