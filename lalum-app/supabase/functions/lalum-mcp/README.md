# lalum-mcp

The LALUM app as an MCP server (Model Context Protocol, Streamable HTTP, stateless).
Claude, or any MCP client, connects to it and can search and read the public
articles and the verified case law database.

## Scope

Public content only: what lalumapp.com already shows to any visitor. No sign-in,
no client records, no leads. That is why the endpoint takes no credential.
Widening it to client data means adding OAuth with the user's Supabase session
and Row Level Security, and is a separate decision.

## Tools

| Tool | Purpose |
| --- | --- |
| `search_articles` | Keyword search over the articles, optional topic filter |
| `get_article` | Full text of one article by slug |
| `list_topics` | The four topics and their article counts |
| `search_rulings` | Search the verified case law, or look up by citation or docket number |
| `get_ruling` | Facts, issue, holding and implications of one ruling |

All five are read only. An empty ruling search tells the model not to cite a
ruling from memory, the same rule the chat assistant follows.

## Deploy

```
node scripts/sync-mcp-content.mjs          # refresh content.data.ts from the site corpus
supabase functions deploy lalum-mcp --no-verify-jwt
```

`--no-verify-jwt` is required: a connector sends no Supabase JWT.

`content.data.ts` is generated, like `lalum-assistant/rulings.data.ts`. After an
article or a ruling is added, regenerate it and redeploy, or the connector serves
the old corpus. `node scripts/sync-mcp-content.mjs --check` fails when it is stale.

## Connect it to Claude

Claude settings, Connectors, Add custom connector, then the URL:

```
https://<project-ref>.supabase.co/functions/v1/lalum-mcp
```

Leave the authentication fields empty.

## Test

```
npm run mcp-check
```

Runs the real handler under Node: handshake, version negotiation, notifications,
batching, transport errors, and every tool including the failure paths.
