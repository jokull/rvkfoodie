/**
 * End-to-end MCP smoke test against the running dev server — real wire
 * protocol over HTTP, stateless MCP (2026-07-28) plus the legacy
 * streamable-HTTP compat path. Run with the dev server up:
 * pnpm dev, then npx tsx scripts/mcp-e2e.test.ts
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Dev server URL: hangar owns the port per worktree ($PORT, proxied at
 * https://web.rvkfoodie.localhost:<port>); MCP_URL overrides; plain `pnpm dev`
 * outside hangar falls back to localhost:3000.
 */
const hangarUrl = (() => {
  try {
    const out = execFileSync('hangar', ['services', '--json'], { encoding: 'utf8', timeout: 10_000 })
    const services = JSON.parse(out) as Array<{ url?: string; port?: number; hostname?: string; state?: string }>
    const web = services.find((s) => s.state === 'healthy' && s.hostname === 'web.rvkfoodie.localhost')
    if (web?.port) return `http://${web.hostname}:${web.port}`
  } catch {
    // no hangar / not running — fall through
  }
  return undefined
})()

const base = process.env.MCP_URL ?? hangarUrl ?? 'http://localhost:3000'
const endpoint = `${base}/api/mcp`
console.log(`MCP endpoint: ${endpoint}`)

// The same key that gates agent-cms's own MCP — from .dev.vars locally.
const writeKey = (process.env.CMS_WRITE_KEY ??
  readFileSync('.dev.vars', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('CMS_WRITE_KEY='))
    .map((l) => l.slice('CMS_WRITE_KEY='.length).trim())[0]) as string
if (!writeKey) throw new Error('CMS_WRITE_KEY not found (set it or add to .dev.vars)')

const META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'mcp-e2e', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
}

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log('ok:', msg)
}

interface RpcRes {
  jsonrpc: string
  id: unknown
  result?: Record<string, unknown>
  error?: { code: number; message: string; data?: unknown }
}

/** Stateless JSON-RPC POST. Returns the parsed body + HTTP status. */
const rpc = async (
  method: string,
  params: Record<string, unknown> = {},
  opts: { meta?: Record<string, unknown> | null; header?: string | null; auth?: string } = {},
): Promise<{ body: RpcRes | RpcRes[]; status: number }> => {
  const body: Record<string, unknown> = { jsonrpc: '2.0', id: 1, method, params }
  const useMeta = opts.meta === undefined ? META : opts.meta
  if (useMeta) body.params = { ...params, _meta: useMeta }
  // Stateless requests MUST send MCP-Protocol-Version matching _meta.
  let useHeader = opts.header
  if (useHeader === undefined && useMeta) {
    const v = (useMeta as Record<string, unknown>)['io.modelcontextprotocol/protocolVersion']
    if (typeof v === 'string') useHeader = v
  }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: opts.auth ?? `Bearer ${writeKey}`,
  }
  if (useHeader !== null && useHeader !== undefined) headers['mcp-protocol-version'] = useHeader
  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await res.text()
  let parsed: RpcRes | RpcRes[]
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { jsonrpc: '2.0', id: null, error: { code: -1, message: `non-JSON response (${res.status}): ${text.slice(0, 120)}` } }
  }
  return { body: parsed, status: res.status }
}

const single = (b: RpcRes | RpcRes[]): RpcRes => (Array.isArray(b) ? b[0] : b)

const main = async () => {
  // 1) auth
  const noAuth = await rpc('server/discover', {}, { meta: null, auth: '' })
  assert(noAuth.status === 401, `no auth -> 401 (got ${noAuth.status})`)
  const badAuth = await rpc('server/discover', {}, { auth: 'Bearer wrong-key' })
  assert(badAuth.status === 401, `bad key -> 401 (got ${badAuth.status})`)

  // 2) stateless server/discover
  const discover = single((await rpc('server/discover')).body)
  assert(discover.result && (discover.result.resultType as string) === 'complete', 'discover resultType complete')
  const supported = (discover.result?.supportedVersions as string[]) ?? []
  assert(supported.includes('2026-07-28'), `discover supports 2026-07-28 (${supported.join(', ')})`)
  assert((discover.result?.capabilities as { tools?: unknown })?.tools !== undefined, 'discover advertises tools capability')
  assert(typeof discover.result?.instructions === 'string' && discover.result.instructions.length > 100, 'discover carries instructions')

  // 3) stateless tools/list — merged RPC + upload + agent-cms editor tools
  const list = single((await rpc('tools/list')).body)
  const tools = (list.result?.tools as Array<{ name: string; description: string; inputSchema: unknown }>) ?? []
  const names = new Set(tools.map((t) => t.name))
  assert(names.has('venues_by_id'), 'RPC read tool present (venues_by_id)')
  assert(names.has('venues_add') && names.has('guides_draft') && names.has('guides_digest'), 'RPC mutation tools present')
  assert(names.has('upload_venue_photo'), 'upload tool present')
  assert(names.has('stats_overview'), 'stats tool present')
  for (const t of tools) assert(typeof t.description === 'string' && t.description.length > 0, `tool ${t.name} has a description`)
  const cmsEditorTools = ['create_record', 'update_record', 'get_record', 'list_assets', 'get_site_settings', 'search_content', 'get_preview_url']
  const cmsHit = tools.find((t) => cmsEditorTools.includes(t.name))
  assert(cmsHit !== undefined, `agent-cms editor tools merged (found ${cmsHit?.name ?? 'none'})`)
  console.log(`  merged tool count: ${tools.length}`)

  // 4) RPC read
  const venue = single((await rpc('tools/call', { name: 'venues_by_id', arguments: { id: 'venue_01' } })).body)
  assert(venue.result && !(venue.result as { isError?: boolean }).isError, 'venues_by_id call ok')
  assert(JSON.stringify(venue.result).includes('Svarta Kaffið'), 'venues_by_id returns the seeded venue')

  const overview = single((await rpc('tools/call', { name: 'stats_overview', arguments: {} })).body)
  assert(overview.result && ((overview.result.content as Array<{ text: string }>)[0]?.text ?? '').includes('venueCount'), 'stats_overview call ok')

  // 5) RPC mutation + audit trail records the write (handlers hardcode the
  // actor as 'system'/'staff'; the MCP session email flows where handlers
  // read it, e.g. the digest audit)
  const stamp = Date.now()
  const added = single((await rpc('tools/call', { name: 'venues_add', arguments: { name: `MCP e2e ${stamp}`, category: 'cafe', address: 'Testavegur 1' } })).body)
  assert(added.result && !(added.result as { isError?: boolean }).isError, 'venues_add call ok')
  const created = JSON.parse((added.result?.content as Array<{ text: string }>)[0].text) as { id: string }
  const audit = single((await rpc('tools/call', { name: 'audit_list', arguments: { entityType: 'venue', entityId: created.id } })).body)
  const auditEntries = JSON.parse((audit.result?.content as Array<{ text: string }>)[0].text) as Array<{ action: string }>
  assert(auditEntries.some((e) => e.action === 'create'), 'audit records the venue create')

  // 6) guide surface
  const guide = single((await rpc('tools/call', { name: 'guides_view_by_slug', arguments: { slug: 'hotel-borg' } })).body)
  assert(guide.result && !(guide.result as { isError?: boolean }).isError, 'guides_view_by_slug call ok')

  // 7) upload_venue_photo — 1x1 transparent PNG
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const up = single((await rpc('tools/call', { name: 'upload_venue_photo', arguments: { venueId: created.id, filename: 'pixel.png', contentType: 'image/png', data: png } })).body)
  assert(up.result && !(up.result as { isError?: boolean }).isError, 'upload_venue_photo call ok')
  const upText = (up.result?.content as Array<{ text: string }>)[0].text
  assert(upText.startsWith('{\n  "url": "https://media.rvkfoodie.is/venues/'), `upload returns a media CDN url (${upText.slice(0, 60)}…)`)

  // 8) agent-cms proxy call — a read that must exist on the editor surface
  const cmsCall = await rpc('tools/call', { name: cmsHit!.name, arguments: cmsHit!.name === 'list_assets' ? {} : { modelApiKey: 'guide' } })
  const cmsRes = single(cmsCall.body)
  assert(!cmsRes.error, `agent-cms proxy call ${cmsHit!.name} ok (${cmsRes.error?.message ?? 'no error'})`)

  // 9) version negotiation errors
  const badVer = await rpc('server/discover', {}, { meta: { ...META, 'io.modelcontextprotocol/protocolVersion': '2024-11-05' } })
  assert(single(badVer.body).error?.code === -32022 && badVer.status === 400, 'unsupported version -> -32022 / 400')
  const mismatch = await rpc('server/discover', {}, { header: '2025-06-18' })
  assert(single(mismatch.body).error?.code === -32020, 'header/_meta mismatch -> -32020')

  // 10) unknown method -> -32601 / 404
  const unknown = await rpc('bogus/method', {}, {})
  assert(single(unknown.body).error?.code === -32601 && unknown.status === 404, 'unknown method -> -32601 / 404')

  // 11) batch — two requests, two responses
  const batchRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${writeKey}`, 'mcp-protocol-version': '2026-07-28' },
    body: JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: META } },
      { jsonrpc: '2.0', id: 2, method: 'ping', params: { _meta: META } },
    ]),
  })
  const batch = { body: (await batchRes.json()) as RpcRes[], status: batchRes.status }
  assert(Array.isArray(batch.body) && batch.body.length === 2, 'batch returns one response per request')

  // 12) legacy streamable-HTTP compat: initialize + tools/list without _meta
  const init = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${writeKey}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-e2e', version: '1.0.0' } } }),
  })
  const initBody = (await init.json()) as RpcRes
  assert(initBody.result?.protocolVersion === '2025-06-18', 'legacy initialize answered without a session')
  const legacyList = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${writeKey}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
  })
  const legacyTools = ((await legacyList.json()) as RpcRes).result?.tools as Array<{ name: string }> | undefined
  assert(Array.isArray(legacyTools) && legacyTools.length > 0, 'legacy tools/list works without _meta')

  // 13) legacy GET SSE (cancel the stream so the script can exit)
  const sse = await fetch(endpoint, { headers: { authorization: `Bearer ${writeKey}` } })
  assert(sse.status === 200 && (sse.headers.get('content-type') ?? '').includes('text/event-stream'), 'GET serves text/event-stream')
  await sse.body?.cancel()

  console.log('\nAll MCP e2e assertions passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
