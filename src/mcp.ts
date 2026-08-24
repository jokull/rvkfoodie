/**
 * Stateless MCP (2026-07-28) over HTTP — hand-rolled JSON-RPC 2.0 engine.
 *
 * SERVER-ONLY. Mounted at POST/GET /api/mcp by src/routes/api.mcp.ts.
 * Bindings (D1/R2/agent-cms) are shared with the rest of the worker — this is
 * the fourth surface on the same worker, so the tool implementations in
 * src/mcp-tools.ts reuse the existing result-rpc router and the in-process
 * agent-cms handler directly.
 *
 * Protocol surface (SEP-2575, spec 2026-07-28):
 *  - No `initialize` handshake. Every stateless request carries its protocol
 *    version + client identity/capabilities in `params._meta` and the
 *    `MCP-Protocol-Version` header (both required, must match — else -32020).
 *  - `server/discover` advertises supported versions + capabilities.
 *  - `tools/list` / `tools/call` are the surface; `resources/list` and
 *    `prompts/list` answer empty so probing clients don't error. Results
 *    carry `resultType: "complete"` and `_meta.serverInfo`.
 *  - Legacy clients (2024-11-05 / 2025-06-18 streamable HTTP) are accepted:
 *    `initialize`/`ping` are answered without creating sessions, requests
 *    without the stateless `_meta` are processed directly, and GET serves a
 *    never-pushing SSE stream so clients that open one can connect.
 *  - Auth: `Authorization: Bearer <CMS_WRITE_KEY>` on every request —
 *    the same secret that gates agent-cms's own MCP endpoints.
 */
import { env } from 'cloudflare:workers'

export const MCP_VERSION = '2026-07-28'
export const LEGACY_VERSIONS = ['2025-06-18', '2024-11-05'] as const
export const SERVER_INFO = { name: 'rvkfoodie', version: '1.0.0' }

export const INSTRUCTIONS = `Aggregate MCP server for Reykjavík Foodie (one worker, four surfaces: consumer site, hotel guides, internal SPA, MCP).

Tool families:
- agent-cms editor tools (create_record, update_record, get_record, search_content, publish_record, unpublish_record, reorder_records, version restore, asset tools, get_site_settings, get_preview_url, ...) manage the CONSUMER-SITE content in agent-cms: product guides, blog editorials, changelog entries, site settings, and the venues embedded in product-guide sections. These are draft/publish records with version history.
- venues_* tools manage the EDITORIAL VENUE DATABASE (the canonical venue inventory that the per-hotel guide snapshots draw from). venues_add / venues_update / venues_set_status / venues_add_lifecycle_event are the everyday editorial actions; lifecycle events mechanically drive status + confidence (closure -> closed + 0).
- hotels_* / businesses_* / contacts_* / deals_* tools manage the HOTEL CRM (business-first: businesses -> hotels -> contacts -> deals with pipeline stages prospect/contacted/sample-sent/proposal/won/lost).
- guides_* tools manage the per-hotel guide SNAPSHOTS: guides_create drafts a guide from the drafting engine, guides_draft is the merge re-draft, guides_approve_candidates promotes generated rows, guides_publish makes it live at /g/<slug>, guides_digest diffs and emails affected hotels.
- upload_venue_photo stores an image in the media bucket and returns its CDN URL — put returned URLs into venue photos / agent-cms media fields.

All writes are staff-gated (bearer key) and audited in the audit log (audit_list). Guide pages are served publicly at https://rvkfoodie.is/g/<slug> — changes are immediately visible after publish.`

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpCallResult {
  text: string
  isError?: boolean
}

export interface McpServer {
  listTools(): Promise<McpTool[]>
  callTool(name: string, args: unknown): Promise<McpCallResult>
}

// --- JSON-RPC plumbing -----------------------------------------------------

type RpcId = string | number | null
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: RpcId
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

const UNSUPPORTED_PROTOCOL_VERSION = -32022
const HEADER_MISMATCH = -32020
const INVALID_PARAMS = -32602
const METHOD_NOT_FOUND = -32601

const rpcResult = (id: RpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
const rpcError = (id: RpcId, code: number, message: string, data?: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// --- Auth ------------------------------------------------------------------

const authOk = (request: Request): boolean => {
  const expected = `Bearer ${env.CMS_WRITE_KEY}`
  if (!env.CMS_WRITE_KEY) return false // fail closed
  const provided = request.headers.get('authorization')
  if (!provided || provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

// --- Dispatch --------------------------------------------------------------

interface RpcRequest {
  jsonrpc?: unknown
  id?: unknown
  method: string
  params?: unknown
}

const isRequest = (v: unknown): v is RpcRequest =>
  typeof v === 'object' && v !== null && typeof (v as RpcRequest).method === 'string' &&
  (v as RpcRequest).jsonrpc === '2.0'

/** Stateless results carry resultType; legacy results keep the old shape. */
const withStateless = (stateless: boolean, result: Record<string, unknown>): Record<string, unknown> =>
  stateless ? { ...result, resultType: 'complete', _meta: { serverInfo: SERVER_INFO } } : result

const dispatch = async (
  server: McpServer,
  req: RpcRequest,
  request: Request,
): Promise<JsonRpcResponse | null> => {
  const id = typeof req.id === 'string' || typeof req.id === 'number' ? req.id : null
  const method = req.method
  const params = (req.params && typeof req.params === 'object' && !Array.isArray(req.params)
    ? req.params
    : {}) as Record<string, unknown>

  if (method.startsWith('notifications/')) return null // 202 Accepted, no body
  if (method === 'ping') return rpcResult(id, {}) // legacy ping

  // Legacy initialize — answered without creating a session. Clients that
  // send it get our oldest compatible version and stateless handling from
  // then on (Mcp-Session-Id is optional for the server in streamable HTTP).
  if (method === 'initialize') {
    const requested = (params.protocolVersion as string | undefined) ?? ''
    const version = (LEGACY_VERSIONS as readonly string[]).includes(requested)
      ? requested
      : LEGACY_VERSIONS[0]
    return rpcResult(id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: SERVER_INFO })
  }

  const meta = (params._meta ?? {}) as Record<string, unknown>
  const metaVersion = meta['io.modelcontextprotocol/protocolVersion']
  const headerVersion = request.headers.get('mcp-protocol-version')
  const stateless = typeof metaVersion === 'string'

  if (stateless) {
    if (metaVersion !== MCP_VERSION) {
      return rpcError(id, UNSUPPORTED_PROTOCOL_VERSION, `unsupported protocol version: ${metaVersion}`, {
        supported: [MCP_VERSION],
        requested: metaVersion,
      })
    }
    if (headerVersion !== MCP_VERSION) {
      return rpcError(id, HEADER_MISMATCH, 'MCP-Protocol-Version header does not match _meta.protocolVersion', {
        header: headerVersion ?? null,
        meta: metaVersion,
      })
    }
    if (!meta['io.modelcontextprotocol/clientInfo'] || !meta['io.modelcontextprotocol/clientCapabilities']) {
      return rpcError(
        id,
        INVALID_PARAMS,
        'missing required _meta fields (io.modelcontextprotocol/clientInfo, io.modelcontextprotocol/clientCapabilities)',
      )
    }
  } else if (headerVersion) {
    // Header present but no _meta version — malformed stateless request.
    return rpcError(id, INVALID_PARAMS, 'missing io.modelcontextprotocol/protocolVersion in _meta', { header: headerVersion })
  }

  switch (method) {
    case 'server/discover':
      return rpcResult(
        id,
        withStateless(stateless, {
          supportedVersions: [MCP_VERSION],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        }),
      )
    case 'tools/list':
      try {
        return rpcResult(
          id,
          withStateless(stateless, { tools: await server.listTools(), ttlMs: 30_000, cacheScope: 'private' }),
        )
      } catch (e) {
        return rpcError(id, -32603, `tools/list failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    case 'tools/call': {
      const name = params.name
      const args = params.arguments
      if (typeof name !== 'string') return rpcError(id, INVALID_PARAMS, 'tools/call requires a string name')
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        return rpcError(id, INVALID_PARAMS, 'tools/call arguments must be an object')
      }
      try {
        const r = await server.callTool(name, args)
        return rpcResult(
          id,
          withStateless(stateless, {
            content: [{ type: 'text', text: r.text }],
            ...(r.isError ? { isError: true } : {}),
          }),
        )
      } catch (e) {
        return rpcError(id, -32603, `tools/call failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    case 'resources/list':
      return rpcResult(id, withStateless(stateless, { resources: [], ttlMs: 30_000, cacheScope: 'private' }))
    case 'prompts/list':
      return rpcResult(id, withStateless(stateless, { prompts: [], ttlMs: 30_000, cacheScope: 'private' }))
    default:
      return rpcError(id, METHOD_NOT_FOUND, `method not found: ${method}`)
  }
}

const errorStatus = (r: JsonRpcResponse): number => {
  if (!r.error) return 200
  switch (r.error.code) {
    case METHOD_NOT_FOUND:
      return 404
    case HEADER_MISMATCH:
    case UNSUPPORTED_PROTOCOL_VERSION:
    case INVALID_PARAMS:
      return 400
    default:
      return 200
  }
}

const post = async (server: McpServer, request: Request): Promise<Response> => {
  const raw = await request.text()
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json(rpcError(null, INVALID_PARAMS, 'invalid JSON body'), 400)
  }

  if (Array.isArray(body)) {
    // JSON-RPC batch: answer each request in order; notifications contribute
    // nothing. Batch envelope stays 200 even when individual ops error.
    const responses: JsonRpcResponse[] = []
    for (const item of body) {
      if (!isRequest(item)) continue
      const r = await dispatch(server, item, request)
      if (r) responses.push(r)
    }
    return json(responses, 200)
  }

  if (!isRequest(body)) {
    return json(rpcError(null, INVALID_PARAMS, 'body must be a JSON-RPC object or batch array'), 400)
  }
  const r = await dispatch(server, body, request)
  if (!r) return new Response(null, { status: 202 }) // notification
  return json(r, errorStatus(r))
}

/** Legacy streamable-HTTP GET: an open SSE stream that never pushes. Legacy
 * clients open it for server->client messages; we never send any, so the
 * stream just stays alive with keepalive comments. */
const legacySseResponse = (): Response => {
  let timer: ReturnType<typeof setInterval> | undefined
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          // client went away
        }
      }, 15_000)
    },
    cancel() {
      if (timer) clearInterval(timer)
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
  })
}

export const mcpHttpHandler = (server: McpServer) => async (request: Request): Promise<Response> => {
  if (!authOk(request)) return json({ error: 'unauthorized' }, 401)
  if (request.method === 'GET') return legacySseResponse()
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
  return post(server, request)
}
