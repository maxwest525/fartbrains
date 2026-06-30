# IdeaVault — next build wave

Organized into **ship-now** (small/clear) and **configure-later** (needs setup or scope decisions). Nothing built yet — confirm or trim before I start.

---

## A. Ship-now (small, scoped, no extra config)

1. **"+ Add" everywhere it should exist**
   - Add button inside every Idea detail (adds a sub-note / linked sub-idea to the same parent)
   - Add button inside every Folder (creates a new idea pre-assigned to that folder)
   - Add button inside Project view (creates a task/idea scoped to that project)

2. **Dark-glass modals globally**
   - Audit every Dialog/Sheet/Popover and force the `strong` dark-glass variant (currently mixed).

3. **Better loading states**
   - Replace plain spinners with one of: shimmering skeleton previews, animated gradient progress bar, or a "neural pulse" orb. I'll pick one and apply to: research, scrape, summarize, generate-prompt, deep-research.

4. **Calendar → gift idea generator** *(extends existing EventGiftsSection)*
   - Multi-question wizard ("budget? their vibe? last gift?") → generates 3–5 gift ideas with links, saves them as ideas tagged to the event.

5. **Idea-from-image upload**
   - Drop an image on capture → Gemini vision describes it → becomes the seed idea. Supports lists/receipts/coupons/screenshots ("scan from phone").

6. **"Better alternatives with facts" action on any idea**
   - New button inside idea detail → finds 3 alternatives with side-by-side fact comparison (price, features, ratings).

---

## B. Project memory architecture (medium, needs schema)

7. **Projects = folders with memory**
   - Promote `folders` to optionally act as "projects" with:
     - **Internal memory**: scoped vector store of that project's ideas only
     - **Shared memory**: opt-in pool every project can read from
   - Ash chat inside a project auto-loads internal memory; toggle to "include shared brain" surfaces cross-project connections (with a "from project X" badge).
   - Graph view gets a "project lens" — show only this project, or this project + dotted lines to cross-project matches.

---

## C. Templates & guided flows (list — pick which to build first)

8. **Idea-type templates** — when creating an idea, optional template picker:
   - Brand kit (name, tagline, palette, logo brief)
   - Logo brief
   - Marketing kit (audience, channels, hook, CTAs)
   - Deep research report
   - Competitor analysis
   - Grow my business / marketing strategy
   - Product launch checklist
   - Each template = preset fields + a tuned prompt + auto-runs the right edge function.

---

## D. Integrations (configure-later — each needs OAuth/API setup)

9. **Google Calendar** — two-way sync (already have connector available)
10. **Gmail** — pull emails into ideas, send recap digests
11. **Photos** — Google Photos / iCloud Shared Album → auto-create idea from new photos
12. **Import from other LLM chats** — paste ChatGPT/Claude share link → extract conversation → idea + memory
13. **Push from phone share sheet** — PWA share target (already partially wired via push-sw)

---

## E. Polish backlog

14. Animated loading "preview of research" — stream partial findings as they come in instead of blank spinner.
15. Consistent dark-glass for toasts, command palette, dropdowns.
16. Empty states with one-tap template suggestions.

---

## How I want to proceed

Reply with:
- **"Ship A + 7"** to do all of section A plus project memory now
- **"A only"** for the quick wins first
- **A list of specific numbers** (e.g. "1, 3, 5, 8") to cherry-pick
- **"Plan C templates"** if you want me to spec the template system in detail first

I won't touch integrations (D) until you tell me which one and confirm the OAuth setup path.