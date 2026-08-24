/**
 * Shared CRM copy + formatting helpers (internal SPA). Kept dependency-free:
 * raw error tags from result-rpc are mapped to human copy here — the
 * critique flagged `Failed: {error._tag}` leaking everywhere.
 */
import { PIPELINE_STAGES } from '../schema.js'

export const STAGE_LABEL: Record<string, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  'sample-sent': 'Sample sent',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

export const STAGE_ORDER = PIPELINE_STAGES as readonly string[]

export const stageLabel = (stage: string) => STAGE_LABEL[stage] ?? stage

export const errMsg = (e: unknown): string => {
  const tag = (e as { _tag?: string } | null | undefined)?._tag ?? ''
  const map: Record<string, string> = {
    'auth/unauthorized': 'Signed out — log in again.',
    'business/not-found': 'This business no longer exists.',
    'business/name-taken': 'A business with this name already exists.',
    'hotel/not-found': 'This hotel no longer exists.',
    'contact/not-found': 'This contact no longer exists.',
    'deal/not-found': 'This deal no longer exists.',
  }
  return map[tag] ?? 'Something went wrong — please try again.'
}

export const kr = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('is-IS')} kr`

export const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('is-IS', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
