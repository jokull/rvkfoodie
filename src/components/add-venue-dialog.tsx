/**
 * Add-venue dialog. Minimal fields; the rest lands on the detail form.
 * On success the new venue (status draft) is patched into the feed cache
 * and the user is taken to its detail.
 */
import { Dialog } from '@cloudflare/kumo'
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
    if (result.ok) {
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
        <form className="add-dialog" onSubmit={submit}>
        <label className="form-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="form-field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {VENUE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Website (optional)</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
        </label>
        {add.state === 'failure' && (
          <p className="error">
            {add.error._tag === 'venue/name-taken' ? 'Name already taken' : `Failed: ${add.error._tag}`}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" disabled={add.state === 'pending'}>
            {add.state === 'pending' ? 'Adding…' : 'Add venue'}
          </button>
          <Dialog.Close render={(props) => <button type="button" className="ghost" {...props}>Cancel</button>} />
        </div>
        </form>
      </Dialog>
    </Dialog.Root>
  )
}
