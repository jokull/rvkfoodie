/**
 * SERVER-ONLY: the MCP tool registry for /api/mcp.
 *
 * Three tool sources, one surface:
 *
 *  1. RPC-backed tools — every staff-relevant procedure from the existing
 *     result-rpc router (venues, awards, audit, hotels, businesses, contacts,
 *     deals, guides, guide venues, stats) is exposed as an MCP tool. The
 *     handler dispatches through `createServerClient`, so middleware (the
 *     staff gate), input/output codecs, and error sanitization run exactly as
 *     they do for the SPA — no handler duplication. The client context
 *     carries a synthetic staff session: the whole endpoint is gated by the
 *     bearer key at the HTTP layer, and the audit log records the actor as
 *     `mcp@rvkfoodie.is`.
 *  2. upload_venue_photo — base64 image -> the R2 media bucket, mirroring
 *     src/routes/api.upload.ts (same key scheme, limits, and content types).
 *  3. agent-cms editor tools — proxied at runtime from the in-process
 *     agent-cms `/mcp/editor` endpoint (a tiny internal MCP client). Tool
 *     names and schemas flow through verbatim so CMS schema changes never
 *     need a code change here; they are merged into tools/list dynamically.
 */
import { env } from 'cloudflare:workers'
import { createServerClient, type ServerClientOf } from 'result-rpc/server'
import { getCmsHandler } from './cms.js'
import { db } from './db.js'
import type { McpCallResult, McpServer, McpTool } from './mcp.js'
import { router, type AppContext } from './rpc-server.js'
import {
  LIFECYCLE_TYPES,
  PIPELINE_STAGES,
  VENUE_AWARD_TYPES,
  VENUE_CATEGORIES,
  VENUE_STATUS,
} from './schema.js'

// --- RPC server client -----------------------------------------------------

/** Synthetic staff session: transport auth is the bearer key; this only
 * satisfies the staff gate and names the audit actor. */
const mcpSession = {
  user: {
    id: 'mcp',
    name: 'MCP editor',
    email: 'mcp@rvkfoodie.is',
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  session: {
    id: 'mcp',
    userId: 'mcp',
    token: 'mcp',
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
  },
} as unknown as NonNullable<AppContext['session']>

const rpcClient = createServerClient(router, {
  context: { db, session: mcpSession },
  onInternalError: (e) => console.error('mcp rpc internal', e.incidentId, e.cause),
})

type RpcClient = ServerClientOf<typeof router>
type RpcCall = (c: RpcClient, args: Record<string, unknown>) => Promise<unknown>

interface RpcToolDef {
  tool: McpTool
  call: RpcCall
}

const callRpc = async (def: RpcToolDef, args: Record<string, unknown>): Promise<McpCallResult> => {
  try {
    const res = await def.call(rpcClient, args)
    if (res && typeof res === 'object' && 'status' in res) {
      const r = res as { status: string; value?: unknown; error?: { _tag?: string; data?: unknown } }
      if (r.status === 'ok') return { text: JSON.stringify(r.value, null, 2) }
      return { text: `error ${r.error?._tag ?? 'unknown'}: ${JSON.stringify(r.error?.data ?? {})}`, isError: true }
    }
    return { text: JSON.stringify(res, null, 2) }
  } catch (e) {
    return { text: `internal error: ${e instanceof Error ? e.message : String(e)}`, isError: true }
  }
}

// --- JSON-schema helpers ---------------------------------------------------

const S = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})
const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) })
const num = (description?: string) => ({ type: 'number', ...(description ? { description } : {}) })
const integer = (description?: string) => ({ type: 'integer', ...(description ? { description } : {}) })
const bool = (description?: string) => ({ type: 'boolean', ...(description ? { description } : {}) })
const strArr = (description?: string) => ({ type: 'array', items: { type: 'string' }, ...(description ? { description } : {}) })
const enumV = (values: readonly string[]) => ({ type: 'string', enum: [...values] })
const date = (description?: string) => ({ type: 'string', ...(description ? { description } : { description: 'ISO 8601 date-time' }) })

const id = (description?: string) => (description ? str(description) : str())
const nullableStr = (description?: string) => ({ type: ['string', 'null'], ...(description ? { description } : {}) })

// --- RPC-backed tool registry (deterministic order) ------------------------

const RPC_TOOLS: RpcToolDef[] = [
  // venues
  {
    tool: {
      name: 'venues_feed',
      description:
        'Page through the curated venue feed — every venue in editorial order. Returns { items: venue[], nextCursor } where nextCursor is the last item\u2019s orderKey; pass it as cursor for the next page. One feed row = the full venue entity.',
      inputSchema: S({ cursor: str('Opaque cursor from the previous page\u2019s nextCursor (omit for the first page)') }),
    },
    // The paginated procedure input is { list, cursor: string|null } — accept
    // a bare optional cursor and normalize to the wire shape.
    call: (c, a) =>
      c.venues.feed({
        list: {},
        cursor: typeof a.cursor === 'string' ? a.cursor : null,
      } as never),
  },
  {
    tool: {
      name: 'venues_by_id',
      description: 'Get one venue by its CUID2 id (e.g. venue_01).',
      inputSchema: S({ id: id('The venue id') }, ['id']),
    },
    call: (c, a) => c.venues.byId(a as never),
  },
  {
    tool: {
      name: 'venues_add',
      description:
        'Create a new venue in the editorial database. category is the primary category (the guide template groups by it); categorySecondary is optional and used as a tag + balance tiebreak. Returns the created venue.',
      inputSchema: S(
        {
          name: str('Venue name'),
          category: { ...enumV(VENUE_CATEGORIES), description: 'Primary category' },
          address: str('Street address'),
          categorySecondary: str('Optional secondary category'),
          cuisine: str('Cuisine type, e.g. "soup, sandwiches"'),
          priceLevel: integer('1-4 price band'),
          note: str('Editorial note'),
          openingHours: str('Free-text opening hours, e.g. "Mo-Su 10:00-22:00"'),
          dineoutId: str('Dineout deep-link id'),
          googlePlacesId: str('Google Places id'),
          website: str('Website URL'),
          phone: str('Phone number'),
          lat: num('Latitude'),
          lon: num('Longitude'),
        },
        ['name', 'category', 'address'],
      ),
    },
    call: (c, a) => c.venues.add(a as never),
  },
  {
    tool: {
      name: 'venues_update',
      description:
        'Partial edit of a venue — absent fields are left untouched. Include id plus only the fields to change. confidence (0-1) and lastVerifiedAt are staff editorial fields set during the monthly pass.',
      inputSchema: S(
        {
          id: id('The venue id'),
          name: str(),
          category: { ...enumV(VENUE_CATEGORIES), description: 'Primary category' },
          address: str(),
          categorySecondary: nullableStr('Optional secondary category (null clears it)'),
          cuisine: nullableStr(),
          priceLevel: integer('1-4 price band'),
          note: nullableStr(),
          openingHours: nullableStr(),
          dineoutId: nullableStr(),
          googlePlacesId: nullableStr(),
          website: nullableStr(),
          phone: nullableStr(),
          confidence: num('Editorial confidence 0-1'),
          lastVerifiedAt: date('ISO 8601 date-time of last editorial verification'),
          lat: num(),
          lon: num(),
          tags: strArr('Editorial tags'),
          recommendedDishes: strArr('Recommended dishes'),
          photos: strArr('Photo CDN URLs (raw object URLs on the media CDN)'),
        },
        ['id'],
      ),
    },
    call: (c, a) => c.venues.update(a as never),
  },
  {
    tool: {
      name: 'venues_set_status',
      description: 'Set a venue\u2019s editorial status directly: draft | live | closed. For closures with history, prefer venues_add_lifecycle_event, which also zeroes confidence.',
      inputSchema: S(
        { id: id('The venue id'), status: { ...enumV(VENUE_STATUS), description: 'New status' } },
        ['id', 'status'],
      ),
    },
    call: (c, a) => c.venues.setStatus(a as never),
  },
  {
    tool: {
      name: 'venues_add_lifecycle_event',
      description:
        'Record a lifecycle event (closed | temporarily-closed | reopened). Mechanically drives venue status + confidence: closure -> status closed + confidence 0, reopened -> status live. Returns the event.',
      inputSchema: S(
        {
          venueId: id('The venue id'),
          type: { ...enumV(LIFECYCLE_TYPES), description: 'Event type' },
          startedAt: date('When the event started (ISO 8601)'),
          note: str('Optional note'),
        },
        ['venueId', 'type', 'startedAt'],
      ),
    },
    call: (c, a) => c.venues.addLifecycleEvent(a as never),
  },
  {
    tool: {
      name: 'venues_list_lifecycle',
      description: 'List the lifecycle event history for one venue.',
      inputSchema: S({ venueId: id('The venue id') }, ['venueId']),
    },
    call: (c, a) => c.venues.listLifecycle(a as never),
  },
  // venue awards
  {
    tool: {
      name: 'venues_list_awards',
      description: 'List the awards (editor\u2019s picks) on a venue.',
      inputSchema: S({ venueId: id('The venue id') }, ['venueId']),
    },
    call: (c, a) => c.venueAwards.list(a as never),
  },
  {
    tool: {
      name: 'venues_add_award',
      description: 'Add an award to a venue. awardType is currently grapevine-best-of; title is the award name shown on the venue card.',
      inputSchema: S(
        {
          venueId: id('The venue id'),
          awardType: { ...enumV(VENUE_AWARD_TYPES), description: 'Award type' },
          title: str('Award title, e.g. "Best of Grapevine 2024"'),
          url: str('Optional link URL'),
        },
        ['venueId', 'awardType', 'title'],
      ),
    },
    call: (c, a) => c.venueAwards.add(a as never),
  },
  {
    tool: {
      name: 'venues_remove_award',
      description: 'Remove an award by its id.',
      inputSchema: S({ id: id('The award id') }, ['id']),
    },
    call: (c, a) => c.venueAwards.remove(a as never),
  },
  // audit
  {
    tool: {
      name: 'audit_list',
      description: 'List the audit trail for one entity (actor, action, before/after snapshots). entityType examples: venue, business, hotel, contact, deal, guide.',
      inputSchema: S({ entityType: str('Entity type'), entityId: id('Entity id') }, ['entityType', 'entityId']),
    },
    call: (c, a) => c.audit.list(a as never),
  },
  // hotels
  {
    tool: {
      name: 'hotels_list',
      description: 'List every hotel property (the CRM hotels, one per guide).',
      inputSchema: S({}),
    },
    call: (c, a) => c.hotels.list(a as never),
  },
  {
    tool: {
      name: 'hotels_list_by_business',
      description: 'List the hotel properties belonging to one business.',
      inputSchema: S({ businessId: id('The business id') }, ['businessId']),
    },
    call: (c, a) => c.hotels.listByBusiness(a as never),
  },
  {
    tool: {
      name: 'hotels_add',
      description: 'Create a hotel property, optionally linked to a business. roomCount feeds the annual-value math on deals.',
      inputSchema: S(
        {
          businessId: id('Optional owning business id'),
          name: str('Hotel name'),
          address: str(),
          lat: num(),
          lon: num(),
          roomCount: integer('Number of rooms'),
          website: str(),
          notes: str('Free-text notes'),
        },
        ['name'],
      ),
    },
    call: (c, a) => c.hotels.add(a as never),
  },
  {
    tool: {
      name: 'hotels_update',
      description: 'Partial edit of a hotel property — absent fields are left untouched.',
      inputSchema: S(
        {
          id: id('The hotel id'),
          businessId: id('Optional owning business id'),
          name: str(),
          address: str(),
          lat: num(),
          lon: num(),
          roomCount: integer('Number of rooms'),
          website: str(),
          notes: str(),
        },
        ['id'],
      ),
    },
    call: (c, a) => c.hotels.update(a as never),
  },
  // businesses
  {
    tool: {
      name: 'businesses_list',
      description: 'List every CRM business (business-first: a business owns hotels, contacts, deals).',
      inputSchema: S({}),
    },
    call: (c, a) => c.businesses.list(a as never),
  },
  {
    tool: {
      name: 'businesses_by_id',
      description: 'Get one business by id.',
      inputSchema: S({ id: id('The business id') }, ['id']),
    },
    call: (c, a) => c.businesses.byId(a as never),
  },
  {
    tool: {
      name: 'businesses_add',
      description: 'Create a CRM business (e.g. a hotel chain or independent hotel).',
      inputSchema: S(
        {
          name: str('Business name'),
          website: str(),
          industry: str('Industry, e.g. "hotels"'),
          notes: str(),
        },
        ['name'],
      ),
    },
    call: (c, a) => c.businesses.add(a as never),
  },
  {
    tool: {
      name: 'businesses_update',
      description: 'Partial edit of a business — absent fields are left untouched.',
      inputSchema: S(
        { id: id('The business id'), name: str(), website: str(), industry: str(), notes: str() },
        ['id'],
      ),
    },
    call: (c, a) => c.businesses.update(a as never),
  },
  // contacts
  {
    tool: {
      name: 'contacts_list_by_business',
      description: 'List the contacts on a business (business-first; hotelId set when the contact is property-scoped).',
      inputSchema: S({ businessId: id('The business id') }, ['businessId']),
    },
    call: (c, a) => c.contacts.listByBusiness(a as never),
  },
  {
    tool: {
      name: 'contacts_add',
      description: 'Add a contact to a business. isDecisionMaker marks the buyer. Outreach history lives in notes.',
      inputSchema: S(
        {
          businessId: id('The business id'),
          hotelId: id('Optional hotel the contact is scoped to'),
          firstName: str(),
          lastName: str(),
          email: str(),
          phone: str(),
          title: str('Job title, e.g. "General Manager"'),
          isDecisionMaker: bool('Is this person the decision maker'),
          notes: str(),
        },
        ['businessId'],
      ),
    },
    call: (c, a) => c.contacts.add(a as never),
  },
  {
    tool: {
      name: 'contacts_update',
      description: 'Partial edit of a contact — absent fields are left untouched.',
      inputSchema: S(
        {
          id: id('The contact id'),
          hotelId: id(),
          firstName: str(),
          lastName: str(),
          email: str(),
          phone: str(),
          title: str(),
          isDecisionMaker: bool(),
          notes: str(),
        },
        ['id'],
      ),
    },
    call: (c, a) => c.contacts.update(a as never),
  },
  // deals
  {
    tool: {
      name: 'deals_list_by_business',
      description: 'List the deals (annual subscriptions) on a business.',
      inputSchema: S({ businessId: id('The business id') }, ['businessId']),
    },
    call: (c, a) => c.deals.listByBusiness(a as never),
  },
  {
    tool: {
      name: 'deals_add',
      description:
        'Create a deal — the annual guide subscription. Pipeline stages: prospect | contacted | sample-sent | proposal | won | lost. annualValue = pricePerRoom x rooms; it is also settable directly.',
      inputSchema: S(
        {
          businessId: id('The business id'),
          name: str('Deal name'),
          stage: { ...enumV(PIPELINE_STAGES), description: 'Pipeline stage' },
          pricePerRoom: integer('ISK per room per year'),
          annualValue: integer('ISK annual value'),
          startDate: date('Contract start (ISO 8601)'),
          renewalDate: date('Renewal date (ISO 8601)'),
          notes: str(),
        },
        ['businessId', 'name'],
      ),
    },
    call: (c, a) => c.deals.add(a as never),
  },
  {
    tool: {
      name: 'deals_update',
      description: 'Partial edit of a deal (stage moves, pricing, dates) — absent fields are left untouched.',
      inputSchema: S(
        {
          id: id('The deal id'),
          name: str(),
          stage: { ...enumV(PIPELINE_STAGES), description: 'Pipeline stage' },
          pricePerRoom: integer(),
          annualValue: integer(),
          startDate: date(),
          renewalDate: date(),
          notes: str(),
        },
        ['id'],
      ),
    },
    call: (c, a) => c.deals.update(a as never),
  },
  // guides
  {
    tool: {
      name: 'guides_list',
      description: 'List every guide snapshot (one per hotel) with its status.',
      inputSchema: S({}),
    },
    call: (c, a) => c.guides.list(a as never),
  },
  {
    tool: {
      name: 'guides_by_id',
      description: 'Get one guide\u2019s metadata by id.',
      inputSchema: S({ id: id('The guide id') }, ['id']),
    },
    call: (c, a) => c.guides.byId(a as never),
  },
  {
    tool: {
      name: 'guides_view',
      description: 'The full public guide view: guide + every live venue row with overrides (venue cards carry canonical copy, overridable per guide).',
      inputSchema: S({ id: id('The guide id') }, ['id']),
    },
    call: (c, a) => c.guides.view(a as never),
  },
  {
    tool: {
      name: 'guides_view_by_slug',
      description: 'Resolve a guide by its public slug (the /g/<slug> URL) and return the full guide view.',
      inputSchema: S({ slug: str('Guide slug, e.g. hotel-borg') }, ['slug']),
    },
    call: (c, a) => c.guides.viewBySlug(a as never),
  },
  {
    tool: {
      name: 'guides_create',
      description: 'Create a new guide for a hotel (draft). The drafting engine generates the initial snapshot from the venue pool around the hotel pin.',
      inputSchema: S(
        {
          hotelId: id('The hotel id'),
          radiusMin: integer('Walk radius in minutes (1-120, default ~20)'),
          targetCount: integer('Itinerary target venue count (1-60, default 24)'),
        },
        ['hotelId'],
      ),
    },
    call: (c, a) => c.guides.create(a as never),
  },
  {
    tool: {
      name: 'guides_builder',
      description: 'The guide builder view: guide + every snapshot row (pending/live/removed) with the venue attached, plus excluded venues. The working surface for curating one guide.',
      inputSchema: S({ guideId: id('The guide id') }, ['guideId']),
    },
    call: (c, a) => c.guides.builder(a as never),
  },
  {
    tool: {
      name: 'guides_draft',
      description:
        'Merge re-draft of a guide from the drafting engine: keeps qualifying live rows, drops closed venues (the only silent disqualifier), appends newly eligible venues as PENDING rows. Returns { kept, dropped, added }. Pending rows only enter the guide via guides_approve_candidates.',
      inputSchema: S({ id: id('The guide id') }, ['id']),
    },
    call: (c, a) => c.guides.draft(a as never),
  },
  {
    tool: {
      name: 'guides_approve_candidates',
      description: 'Promote generated PENDING rows to live in a guide — the maintenance-cycle approval step after guides_draft.',
      inputSchema: S(
        { guideId: id('The guide id'), venueIds: strArr('Venue ids to approve') },
        ['guideId', 'venueIds'],
      ),
    },
    call: (c, a) => c.guides.approveCandidates(a as never),
  },
  {
    tool: {
      name: 'guides_set_config',
      description: 'Update a guide\u2019s generator config (radius / target count); the next guides_draft uses it.',
      inputSchema: S(
        {
          guideId: id('The guide id'),
          radiusMin: integer('Walk radius in minutes (1-120)'),
          targetCount: integer('Target venue count (1-60)'),
        },
        ['guideId'],
      ),
    },
    call: (c, a) => c.guides.setConfig(a as never),
  },
  {
    tool: {
      name: 'guides_publish',
      description: 'Publish a guide — status to live, public at https://rvkfoodie.is/g/<slug>.',
      inputSchema: S({ id: id('The guide id') }, ['id']),
    },
    call: (c, a) => c.guides.publish(a as never),
  },
  {
    tool: {
      name: 'guides_add_exclude',
      description: 'Exclude a venue from a guide (never-in override; the drafting engine skips it).',
      inputSchema: S({ guideId: id('The guide id'), venueId: id('The venue id') }, ['guideId', 'venueId']),
    },
    call: (c, a) => c.guides.addExclude(a as never),
  },
  {
    tool: {
      name: 'guides_remove_exclude',
      description: 'Remove a venue exclusion from a guide.',
      inputSchema: S({ guideId: id('The guide id'), venueId: id('The venue id') }, ['guideId', 'venueId']),
    },
    call: (c, a) => c.guides.removeExclude(a as never),
  },
  {
    tool: {
      name: 'guide_venues_update',
      description:
        'Edit one snapshot row: reorder (pass a new fractional orderKey), pin (always-in), or set overrideText (per-guide copy override; null clears it back to the venue\u2019s canonical copy).',
      inputSchema: S(
        {
          id: id('The guide-venue row id'),
          orderKey: str('New fractional order key (e.g. "a1.5" between "a1" and "a2")'),
          pinned: bool('Pin the venue in place'),
          overrideText: nullableStr('Per-guide copy override (null = use venue canonical copy)'),
        },
        ['id'],
      ),
    },
    call: (c, a) => c.guideVenues.update(a as never),
  },
  {
    tool: {
      name: 'guides_digest',
      description:
        'The monthly-pass finish: diff every live guide against the last digest baseline and EMAIL affected hotels about removals/additions. First run snapshots the baseline silently; afterwards only real changes produce mail. Optional guideId restricts to one guide. This sends real email — use deliberately.',
      inputSchema: S({ guideId: id('Optional — restrict to one guide') }),
    },
    call: (c, a) => c.guides.digest(a as never),
  },
  // stats
  {
    tool: {
      name: 'stats_overview',
      description: 'One-off aggregates: venueCount, liveVenueCount, hotelCount.',
      inputSchema: S({}),
    },
    call: (c, a) => c.stats.overview(a as never),
  },
]

const rpcByName = new Map(RPC_TOOLS.map((d) => [d.tool.name, d]))

// --- upload_venue_photo ----------------------------------------------------

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB, same as /api/upload

const UPLOAD_TOOL: McpTool = {
  name: 'upload_venue_photo',
  description:
    'Store an image in the media bucket and return its raw CDN URL + key. Mirrors the /api/upload route. Pass the image bytes base64-encoded in data. The returned url (https://media.rvkfoodie.is/...) is what goes into a venue\u2019s photos array or an agent-cms media field; renderers append cdn-cgi/image options to it.',
  inputSchema: S(
    {
      venueId: str('The venue the photo belongs to (key prefix)'),
      filename: str('Original filename (sanitized server-side)'),
      contentType: { ...enumV([...ALLOWED_TYPES]), description: 'Image MIME type' },
      data: str('Base64-encoded image bytes (max 10 MB)'),
    },
    ['venueId', 'filename', 'contentType', 'data'],
  ),
}

const uploadVenuePhoto = async (args: Record<string, unknown>): Promise<McpCallResult> => {
  const venueId = typeof args.venueId === 'string' ? args.venueId : ''
  const filename = typeof args.filename === 'string' ? args.filename : ''
  const contentType = typeof args.contentType === 'string' ? args.contentType : ''
  const data = typeof args.data === 'string' ? args.data : ''
  if (!venueId || !filename) return { text: 'venueId and filename are required', isError: true }
  if (!ALLOWED_TYPES.has(contentType)) return { text: `unsupported content type: ${contentType}`, isError: true }
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(data.replace(/\s/g, '')), (c) => c.charCodeAt(0))
  } catch {
    return { text: 'data must be base64-encoded image bytes', isError: true }
  }
  if (bytes.byteLength === 0) return { text: 'empty image data', isError: true }
  if (bytes.byteLength > MAX_BYTES) return { text: `image too large (max ${MAX_BYTES} bytes)`, isError: true }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-60)
  const key = `venues/${venueId}/${Date.now()}-${safeName}`
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } })
  return { text: JSON.stringify({ url: `${env.ASSET_BASE_URL}/${key}`, key }, null, 2) }
}

// --- agent-cms editor proxy ------------------------------------------------

const CMS_INTERNAL = 'http://internal'
let cmsSessionId: string | null = null
let cmsToolCache: McpTool[] | null = null
let cmsToolCacheAt = 0
let cmsNames = new Set<string>()
const CMS_TOOL_TTL_MS = 60_000

/**
 * Wire mode negotiated against the in-process agent-cms MCP.
 *
 * - `stateless` (MCP 2026-07-28, agent-cms >= 0.5): every request carries
 *   `_meta` with the protocol version + client info and the
 *   `MCP-Protocol-Version` header; responses are single JSON-RPC objects.
 * - `legacy` (agent-cms 0.4.x Effect MCP): plain JSON-RPC POST, no `_meta` —
 *   the Effect layer rejects unknown params and answers with batch arrays.
 *
 * The first call tries stateless; a transport-level failure (thrown HTTPError
 * or non-200 — the Effect MCP's signature for undecodable requests) retries
 * once in legacy mode and the winner is cached for the isolate. JSON-RPC
 * error RESPONSES are never retried (the server understood the request).
 */
let cmsMode: 'stateless' | 'legacy' | null = null

const STATELESS_META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'rvkfoodie-mcp', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
}

const parseSsePayload = (text: string): unknown => {
  let payload: unknown = null
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data) continue
    try {
      payload = JSON.parse(data)
    } catch {
      // skip keepalives / non-JSON frames
    }
  }
  return payload
}

type CmsRpcMessage = { result?: Record<string, unknown>; error?: { code: number; message: string } }

/** The legacy Effect MCP answers with a JSON-RPC batch array even for a
 * single request ([{...}]) — pick the message for our request id. The
 * stateless MCP answers with a single object. Handles plain JSON, NDJSON,
 * and SSE-framed payloads defensively. */
const pickRpcMessage = (payload: unknown, id: number): CmsRpcMessage => {
  const candidates = Array.isArray(payload)
    ? (payload as Array<CmsRpcMessage & { id?: unknown }>)
    : ([payload] as Array<CmsRpcMessage & { id?: unknown }>)
  const byId = candidates.find((m) => (m as { id?: unknown }).id === id)
  const chosen = byId ?? candidates[0]
  return chosen && typeof chosen === 'object' ? chosen : {}
}

const parseRpcBody = (text: string, ct: string, id: number): CmsRpcMessage => {
  if (ct.includes('text/event-stream')) {
    const payload = parseSsePayload(text)
    return pickRpcMessage(payload, id)
  }
  try {
    return pickRpcMessage(JSON.parse(text), id)
  } catch {
    // NDJSON fallback: parse each non-empty line
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        return pickRpcMessage(JSON.parse(trimmed), id)
      } catch {
        // keep scanning
      }
    }
    return {}
  }
}

type CmsFetchResult =
  | { kind: 'ok'; result: Record<string, unknown>; raw: string }
  | { kind: 'http-error'; status: number; raw: string }
  | { kind: 'rpc-error'; error: { code: number; message: string }; raw: string }

const cmsFetch = async (body: Record<string, unknown>): Promise<CmsFetchResult> => {
  const stateless = cmsMode !== 'legacy'
  const params = (body.params as Record<string, unknown> | undefined) ?? {}
  const wireBody = stateless
    ? { ...body, params: { ...params, _meta: STATELESS_META } }
    : body
  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
    authorization: `Bearer ${env.CMS_WRITE_KEY}`,
  })
  if (stateless) headers.set('mcp-protocol-version', '2026-07-28')
  if (cmsSessionId) headers.set('mcp-session-id', cmsSessionId)
  let res: Response
  try {
    res = await getCmsHandler().fetch(
      new Request(`${CMS_INTERNAL}/mcp/editor`, { method: 'POST', headers, body: JSON.stringify(wireBody) }),
    )
  } catch (e) {
    throw new Error(`agent-cms MCP fetch failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  const sid = res.headers.get('mcp-session-id')
  if (sid) cmsSessionId = sid
  const ct = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (!res.ok) return { kind: 'http-error', status: res.status, raw: text.slice(0, 300) }
  if (!text.trim()) return { kind: 'http-error', status: 0, raw: `empty body (${ct})` }
  const parsed = parseRpcBody(text, ct, (body.id as number) ?? 0)
  if (parsed.error) return { kind: 'rpc-error', error: parsed.error, raw: text.slice(0, 300) }
  if (!parsed.result) return { kind: 'http-error', status: 0, raw: `unparseable body (${ct}): ${text.slice(0, 300)}` }
  return { kind: 'ok', result: parsed.result, raw: text }
}

/** One JSON-RPC round trip with mode negotiation: try stateless first, and
 * on a TRANSPORT-level failure (throw or non-200 — never on a JSON-RPC error
 * response) retry once in legacy mode. The working mode sticks. */
const cmsRequest = async (body: Record<string, unknown>): Promise<CmsRpcMessage> => {
  const attempt = async (): Promise<CmsFetchResult> => {
    try {
      return await cmsFetch(body)
    } catch (e) {
      if (cmsMode === null) {
        cmsMode = 'legacy'
        return cmsFetch(body)
      }
      throw e
    }
  }
  let res = await attempt()
  if (res.kind === 'http-error' && cmsMode === null) {
    cmsMode = 'legacy'
    res = await attempt()
  }
  if (res.kind === 'ok') {
    cmsMode ??= 'stateless'
    return res
  }
  if (res.kind === 'rpc-error') return { error: res.error }
  return { error: { code: -1, message: `agent-cms /mcp/editor transport error: ${res.raw}` } }
}

const cmsListTools = async (): Promise<McpTool[]> => {
  if (cmsToolCache && Date.now() - cmsToolCacheAt < CMS_TOOL_TTL_MS) return cmsToolCache
  // agent-cms's MCP is plain JSON-RPC POST — per its own docs, tools/call
  // works directly with no initialize round-trip, so we skip the handshake
  // in both wire modes.
  const res = await cmsRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  if (res.error) throw new Error(`agent-cms tools/list failed: ${res.error.message}`)
  const tools = Array.isArray(res.result?.tools)
    ? (res.result.tools as Array<{ name?: unknown; description?: unknown; inputSchema?: unknown }>).map((t) => ({
        name: String(t.name ?? ''),
        description: typeof t.description === 'string' ? t.description : '',
        inputSchema:
          typeof t.inputSchema === 'object' && t.inputSchema !== null
            ? (t.inputSchema as Record<string, unknown>)
            : { type: 'object', properties: {} },
      }))
    : []
  cmsToolCache = tools
  cmsToolCacheAt = Date.now()
  cmsNames = new Set(tools.map((t) => t.name))
  return tools
}

const cmsCall = async (name: string, args: Record<string, unknown>): Promise<McpCallResult> => {
  const res = await cmsRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name, arguments: args },
  })
  if (res.error) return { text: `CMS error ${res.error.code}: ${res.error.message}`, isError: true }
  const r = res.result ?? {}
  const content = Array.isArray(r.content)
    ? (r.content as Array<{ type?: string; text?: unknown }>)
        .map((c) => (c.type === 'text' ? String(c.text ?? '') : JSON.stringify(c)))
        .filter((s) => s !== '')
        .join('\n')
    : JSON.stringify(r)
  return { text: content || JSON.stringify(r), isError: r.isError === true }
}

// --- the composed server ---------------------------------------------------

export const createMcpServer = (): McpServer => ({
  listTools: async () => {
    const cms = await cmsListTools()
    return [...RPC_TOOLS.map((d) => d.tool), UPLOAD_TOOL, ...cms]
  },
  callTool: async (name, args) => {
    const record = (args ?? {}) as Record<string, unknown>
    if (name === UPLOAD_TOOL.name) return uploadVenuePhoto(record)
    const def = rpcByName.get(name)
    if (def) return callRpc(def, record)
    await cmsListTools() // ensure the current CMS surface is known
    if (cmsNames.has(name)) return cmsCall(name, record)
    return { text: `unknown tool: ${name}`, isError: true }
  },
})
