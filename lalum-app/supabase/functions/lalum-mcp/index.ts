// lalum-mcp: Supabase Edge Function (Deno). The LALUM app as an MCP server, so
// Claude (as a custom connector) or any MCP client can search and read the
// public articles and the verified case law.
//
// Connector URL: https://<project-ref>.supabase.co/functions/v1/lalum-mcp
// No credential is needed, the content is what the site already publishes.
//
// Deploy: supabase functions deploy lalum-mcp --no-verify-jwt
// (the connector sends no Supabase JWT, so JWT verification must be off).
// Regenerate the content first: node scripts/sync-mcp-content.mjs

import { handleRequest } from "./handler.ts";

Deno.serve(handleRequest);
