/**
 * The MCP endpoint, as a TanStack Start SERVER ROUTE — POST/GET /api/mcp.
 *
 * Same pattern as api.rpc.ts: `server.handlers` bodies are stripped from the
 * client build, so importing the server-only MCP modules here is safe.
 *
 * The MCP server itself is stateless MCP (2026-07-28): POST carries JSON-RPC
 * requests with per-request version/capabilities in `_meta`; GET serves the
 * legacy never-pushing SSE stream so older streamable-HTTP clients can
 * connect. Every request must carry `Authorization: Bearer <CMS_WRITE_KEY>`.
 *
 * Register: `claude mcp add --transport http rvkfoodie <url>/api/mcp` (dev:
 * http://localhost:3000/api/mcp, prod: https://rvkfoodie.is/api/mcp) with a
 * headers entry `{ "Authorization": "Bearer <CMS_WRITE_KEY>" }`.
 */
import { createFileRoute } from '@tanstack/react-router'
import { mcpHttpHandler } from '../mcp.js'
import { createMcpServer } from '../mcp-tools.js'

const handler = mcpHttpHandler(createMcpServer())

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      GET: ({ request }) => handler(request),
    },
  },
})
