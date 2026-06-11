
# Swap YouTube transcription to Hyperfx MCP

Right now `transcribe-youtube` does the work itself (Apify download → ElevenLabs Scribe). Hyperfx already has a `youtube-transcriber` agent that does the whole thing. We rip out the local pipeline and just call Hyperfx.

## The auth reality (read this)

Hyperfx's MCP endpoint (`https://backend.hyperfx.ai/mcp/`) is OAuth-only. OAuth means a human clicks "Authorize" in a browser — it's designed for Claude/Cursor/ChatGPT, not server-to-server.

Two ways through it:
1. **You authorize once, we store the token as a secret.** App reuses it forever (until it expires). Fastest. What I'll plan for.
2. **Per-user OAuth flow inside your app.** Login button → Hyperfx consent screen → token per user. Way more work and your single-user app doesn't need it.

Going with option 1. You'll have to do a one-time OAuth dance to get an access token, then paste it as `HYPERFX_ACCESS_TOKEN`. I'll write you a ChatGPT-agent-mode prompt to do the OAuth flow and hand you back the token.

## Changes

**Replace** `supabase/functions/transcribe-youtube/index.ts`:
- Drop all Apify + ElevenLabs code.
- Open an MCP streamable-http session against `https://backend.hyperfx.ai/mcp/` with `Authorization: Bearer ${HYPERFX_ACCESS_TOKEN}`.
- `initialize` → `tools/list` → find the `youtube-transcriber` tool (or whatever Hyperfx names it) → `tools/call` with `{ url }`.
- Parse the tool result. Hyperfx's agent returns either a transcript string or a JSON object containing one. Normalize to `{ transcript, title, author, thumbnail, finalUrl, videoUrl: null, durationSeconds: null }` so the existing frontend (`fromYoutube` in `src/lib/extractedContent.ts`) keeps working with zero changes.
- Errors from Hyperfx → 502 with the message; 401 from Hyperfx → 401 with "Hyperfx token expired, re-authorize".

**No changes** to:
- `src/lib/extractedContent.ts` — the YouTube branch already accepts `{ transcript, title, author, thumbnail }`.
- `src/components/app/ComposeIdea.tsx` — still invokes `transcribe-youtube`.
- `src/components/app/SourcePicker.tsx` — YouTube tile stays.
- DB schema — none needed.

**Secret to add:** `HYPERFX_ACCESS_TOKEN` (after you do the OAuth dance).

**Secrets to remove later** (only if nothing else uses them): `APIFY_API_TOKEN`. `ELEVENLABS_API_KEY` is still used by `transcribe-instagram` and `transcribe-deliverables` — keep it.

## Technical detail — MCP over HTTP without a library

Deno edge functions don't get the AI SDK MCP client cleanly, and we only need one tool call. I'll do raw JSON-RPC over the streamable-http transport:

```text
POST https://backend.hyperfx.ai/mcp/
Headers:
  Authorization: Bearer <HYPERFX_ACCESS_TOKEN>
  Content-Type: application/json
  Accept: application/json, text/event-stream
  MCP-Protocol-Version: 2025-06-18

Body sequence (each is a separate POST, session id reused via Mcp-Session-Id response header):
  1. { jsonrpc:"2.0", id:1, method:"initialize", params:{ protocolVersion:"2025-06-18", clientInfo:{name:"lovable-app",version:"1"}, capabilities:{} } }
  2. { jsonrpc:"2.0", method:"notifications/initialized" }
  3. { jsonrpc:"2.0", id:2, method:"tools/list" }
  4. { jsonrpc:"2.0", id:3, method:"tools/call", params:{ name:"<resolved tool name>", arguments:{ url } } }
```

Response may be SSE-framed (`text/event-stream`) or plain JSON depending on server — handle both: if `Content-Type` starts with `text/event-stream`, parse `data: ` lines; else `await resp.json()`.

Total ~120 lines of Deno. No npm deps.

## What you'll do manually

After I write the code I'll give you a ChatGPT agent-mode prompt that performs the OAuth flow against `https://backend.hyperfx.ai/mcp/` and returns the access token. You paste it into the secrets tool when prompted.

## Out of scope

- Per-user OAuth.
- Token auto-refresh (we'll handle expiry by surfacing a clean error; you re-paste when it dies).
- Caching (Hyperfx's agent already caches in its own `youtube_transcripts` table).
