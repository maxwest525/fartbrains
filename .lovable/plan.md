# YouTube transcription (audio-only pipeline)

Mirror the existing Instagram flow: dedicated source tile → edge function that downloads the YouTube video via Apify → ElevenLabs Scribe transcribes the audio → preview + summarize + save like other URL captures. Captions are intentionally ignored per your choice.

## Scope

- New `youtube` source tile in the composer.
- New `transcribe-youtube` edge function (Apify + ElevenLabs).
- Auto-routing in `ComposeIdea` so YouTube URLs hit the new function instead of `extract-url`.
- Preview/save reuses existing `normalizeExtraction` / preview UI — no schema changes, no list/detail changes.

## Files

**New**
- `supabase/functions/transcribe-youtube/index.ts` — POST `{ url }` → `{ transcript, title, author, thumbnail, finalUrl, videoUrl, durationSeconds }`. Structure copied from `transcribe-instagram` with a different Apify actor and YouTube host validation. Validates `youtube.com` / `youtu.be`, rejects playlists, caps download at 50 MB, sends the audio/video blob to `scribe_v2`.

**Edited**
- `src/components/app/SourcePicker.tsx` — add a `youtube` tile (Youtube icon, enabled) between `link` and `list`.
- `src/components/app/ComposeIdea.tsx`
  - Add `youtube` to `PLACEHOLDERS` and to the URL-input branches (`needsUrl` becomes `instagram | link | youtube`).
  - Auto-focus + paste handling for `youtube` like `link`.
  - In `handleExtract`, route YouTube URLs to `transcribe-youtube` (same pattern as the existing Instagram branch) and feed the result into `normalizeExtraction("youtube", ext, url)`.
  - When the user is on the `link` tile but pastes a YouTube URL, keep current behavior but call `transcribe-youtube` instead of `extract-url` (so auto-detect still works either way).
- `src/lib/extractedContent.ts` — extend the `youtube` branch of `normalizeExtraction` to consume `{ transcript, title, author, thumbnail }` and set `hasTranscript: true` when transcript is present (no schema change, just shape mapping).

## Edge function details

```text
POST /transcribe-youtube  { url }
  1. Validate host ∈ {youtube.com, youtu.be, m.youtube.com}; reject /playlist URLs.
  2. Apify run-sync-get-dataset-items against a YouTube downloader actor
     (default: streamers/youtube-video-downloader — returns direct mp4 URL,
     title, channel, duration, thumbnail). Actor ID lives in a constant
     so it can be swapped without code changes elsewhere.
  3. Reject if reported duration > 30 min (configurable) to bound ElevenLabs cost.
  4. fetch(videoUrl) with 50 MB cap, same guard as Instagram.
  5. POST to https://api.elevenlabs.io/v1/speech-to-text with model_id=scribe_v2.
  6. Return JSON shaped like the Instagram function so the client can reuse it.
  Errors: 400 invalid URL, 413 too large, 422 no downloadable video, 502 upstream.
```

Secrets reused: `APIFY_API_TOKEN`, `ELEVENLABS_API_KEY` (already present).

## Cost / UX notes

- Audio-only via ElevenLabs Scribe costs ~$0.0025/min; 30 min cap = ~$0.075 per video. Worth surfacing in the tile hint ("Will transcribe audio — long videos take a minute").
- Apify actor charges per video; the chosen actor's pricing is pay-per-result.
- A loading state already exists for URL extraction; we'll show "Transcribing audio…" copy when the active source is `youtube` so users know it's slower than a normal URL scrape.

## Out of scope

- Caption fallback (per your choice).
- Chapter/segment splitting, speaker diarization, translation.
- Background job queue — kept synchronous like Instagram; 30 min cap keeps it under the edge function timeout.

## Manual step for you

After I write the code, you'll need to confirm the Apify YouTube actor we use is enabled on your Apify account (most are free to enable, pay-per-run). I'll call out the exact actor name in the implementation message so you can one-click enable it.
