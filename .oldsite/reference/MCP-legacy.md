# MCP — Organization-Level Custom Connectors in Claude Desktop

## Overview

Claude Desktop (Team/Enterprise) supports org-level MCP server configuration via **Custom Connectors** in the Admin Console under **Organization Settings > Connectors**.

The config has exactly four fields:

| Field                | Required |
| -------------------- | -------- |
| `name`               | Yes      |
| `url`                | Yes      |
| `oauth_client_id`    | No       |
| `oauth_client_secret`| No       |

## MCP Spec Subset

This maps to the **Streamable HTTP transport** from the **2025-03-26 MCP spec**. One URL, POST JSON-RPC to it, get back JSON or SSE streams. No stdio, no subprocess.

### Auth Flow

- **OAuth 2.1** with PKCE (mandatory)
- Without client_id/secret → Claude uses **Dynamic Client Registration (RFC 7591)** to auto-register
- With client_id/secret → skips DCR, uses those credentials directly
- Server must expose `/.well-known/oauth-protected-resource` (RFC 9728) for auth server discovery
- Callback URL: `https://claude.ai/api/mcp/auth_callback`
- "Authless" servers (no OAuth at all) also work

### Relevant RFCs

- RFC 8414 — OAuth 2.0 Authorization Server Metadata
- RFC 9728 — OAuth 2.0 Protected Resource Metadata
- RFC 7591 — OAuth 2.0 Dynamic Client Registration
- OAuth 2.1 draft (draft-ietf-oauth-v2-1-13) with PKCE

## Reference Repos

- **[cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider)** — OAuth 2.1 provider library for Workers. Implements RFC 8414, RFC 9728, RFC 7591, and PKCE. Handles both DCR and pre-configured credentials.
- **[coleam00/remote-mcp-server-with-auth](https://github.com/coleam00/remote-mcp-server-with-auth)** — Remote MCP server template on Workers with GitHub OAuth. Supports Streamable HTTP and SSE.
- **[iceener/streamable-mcp-server-template](https://github.com/iceener/streamable-mcp-server-template)** — Production-ready Streamable HTTP + OAuth 2.1 template.

## Documentation

- [Building custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
