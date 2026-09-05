import { useEffect, useMemo, useRef, useState } from "react";
import { setLandingActive } from "@/lib/landingMode";

/* ------------------------------------------------------------------ *
 * Fart Brains — landing page.
 *
 * The argument, in order:
 *
 *   1. The thing you need does not exist as a product. Someone explained
 *      how to build it in a reel you have already forgotten.
 *   2. Your agent cannot get into that reel. You can — the share sheet is
 *      a door that HTTP does not have.
 *   3. What comes back is not a summary. It is a brief your own agent
 *      builds from, carrying your one line about what you actually want.
 *
 * Deliberately self-contained: no app design tokens, no shadcn, so
 * restyling the app never silently restyles the marketing page. Hand-
 * rolled CSS and one canvas; no new dependencies.
 *
 * Every claim below is checked against what is actually shipped. Where
 * something is not built, it is not listed — see the note above CAPABILITIES.
 * ------------------------------------------------------------------ */

const AMBER = "#f2a53c";

/* ------------------------------------------------------------------ *
 * Hero: the drift field.
 *
 * Ideas rise, thin out and vanish. You can catch one, but you will miss
 * most of them, and the counter only ever counts what was lost — because
 * the thing about a forgotten idea is that you never learn what it was.
 * ------------------------------------------------------------------ */

const DRIFTING = [
  "the app idea from the shower",
  "why the second version was better",
  "the fix you thought of while driving",
  "that reel about SEO for LLMs",
  "the podcast tangent at 34:20",
  "what the client actually meant",
  "the cheaper way to do it",
  "a better opening line",
];

type Bubble = { text: string; x: number; y: number; w: number; v: number; a: number; wob: number };

const DriftField = ({ onLost }: { onLost: () => void }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let seed = 0;
    const bubbles: Bubble[] = [];

    // On wide screens the copy occupies the left half, so bubbles drift up
    // the empty right side rather than across the headline and buttons.
    const bandX = (bw: number) =>
      w >= 900
        ? w * 0.52 + Math.random() * Math.max(1, w * 0.44 - bw)
        : 20 + Math.random() * Math.max(1, w - bw - 40);

    const spawn = () => {
      const text = DRIFTING[seed % DRIFTING.length];
      seed += 1;
      ctx.font = "13px ui-monospace, SFMono-Regular, monospace";
      const bw = ctx.measureText(text).width + 26;
      bubbles.push({
        text,
        w: bw,
        x: bandX(bw),
        y: h + 30,
        v: 0.26 + Math.random() * 0.28,
        a: 1,
        wob: Math.random() * 6.28,
      });
    };

    // Seeding is deferred until the canvas has a real height. On mount it is
    // still inside the app's 430px frame and may measure zero, and bubbles
    // seeded against a zero height land off-canvas and are culled instantly —
    // which looks exactly like the animation being broken.
    let seeded = false;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (seeded) {
        // Width changed under us — re-band anything already on screen, or
        // bubbles seeded at the narrow width keep drifting over the text.
        for (const b of bubbles) b.x = bandX(b.w);
      }
      if (!seeded) {
        seeded = true;
        // Spread the first few up the canvas so the field reads as
        // already-running rather than filling in from the bottom edge.
        for (let i = 0; i < 4; i++) {
          spawn();
          bubbles[i].y = h - 90 - i * (h / 5);
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (!reduced) {
          b.y -= b.v;
          b.wob += 0.012;
          // Fade out in the upper third, so they dissolve rather than
          // hitting the top edge and disappearing abruptly.
          if (b.y < h * 0.36) b.a = Math.max(0, b.a - 0.0038);
        }
        if (b.a <= 0 || b.y < -40) {
          bubbles.splice(i, 1);
          onLost();
          continue;
        }
        const x = b.x + Math.sin(b.wob) * 7;
        const r = 4;
        ctx.globalAlpha = b.a * 0.9;
        ctx.beginPath();
        ctx.moveTo(x + r, b.y);
        ctx.arcTo(x + b.w, b.y, x + b.w, b.y + 30, r);
        ctx.arcTo(x + b.w, b.y + 30, x, b.y + 30, r);
        ctx.arcTo(x, b.y + 30, x, b.y, r);
        ctx.arcTo(x, b.y, x + b.w, b.y, r);
        ctx.closePath();
        ctx.fillStyle = "rgba(242,165,60,.06)";
        ctx.fill();
        ctx.strokeStyle = "rgba(242,165,60,.34)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(217,226,221,.85)";
        ctx.font = "13px ui-monospace, SFMono-Regular, monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(b.text, x + 13, b.y + 15);
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };

    // The app's phone frame unlocks after mount, which changes this canvas's
    // size without firing a window resize — so watch the element itself.
    // Without this the text renders stretched at the pre-unlock width.
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    size();
    draw();
    const timer = reduced
      ? undefined
      : window.setInterval(() => {
          if (bubbles.length < 7) spawn();
        }, 2200);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (timer) window.clearInterval(timer);
    };
  }, [onLost]);

  return <canvas ref={ref} className="fb-drift" aria-hidden="true" />;
};

/* ------------------------------------------------------------------ *
 * The mutation.
 *
 * The load-bearing demo. Their mechanism is fixed; your one line is the
 * variable. Editing the note visibly changes what comes out, because
 * that is the actual product: not the transcript, the brief built from
 * the transcript plus what you wanted.
 * ------------------------------------------------------------------ */

type Source = {
  id: string;
  tab: string;
  src: string;
  said: string[];
  note: string;
  /** Built from the note, so the output changes when the note changes. */
  build: (note: string) => { title: string; body: string };
};

const SOURCES: Source[] = [
  {
    id: "seo",
    tab: "A 47-second reel",
    src: "instagram.com/reel · aggressive SEO for LLMs",
    said: [
      "Answer the question in the first 40 words, before any preamble.",
      "One page per query shape, not one page per keyword.",
      "Mark up the claim so the model can quote it without reading the page.",
    ],
    note: "but for our docs site, and it has to survive our stack",
    build: (note) => ({
      title: "Query-shape routing for the docs site",
      body: note.trim()
        ? `Ten interceptor routes keyed to query shape, the metadata templates, and the prerender step the reel never mentions — adapted to ${note.trim().replace(/^but /i, "")}.`
        : "The three tactics from the reel, written out in order, with nothing adapted to your stack. Add a note above and it changes.",
    }),
  },
  {
    id: "tenancy",
    tab: "A podcast episode",
    src: "22 min · running single-tenant deployments by hand",
    said: [
      "One database per customer, provisioned manually on signup.",
      "Migrations run per tenant, in a loop, with a kill switch.",
      "Billing reads from a per-tenant usage table, not the app.",
    ],
    note: "same idea but multi-tenant, provisioning automatic",
    build: (note) => ({
      title: "A control plane for what they did by hand",
      body: note.trim()
        ? `A provisioning path, row-level isolation and per-tenant quotas — turning a story about hand-provisioning into ${note.trim().replace(/^same idea but /i, "")}.`
        : "Their manual process, transcribed accurately. Useful, but it is still their process. The note is what makes it yours.",
    }),
  },
  {
    id: "mcp",
    tab: "A stranger's recommendation",
    src: "a thread recommending an MCP server",
    said: [
      "Install the server, add it to your client config.",
      "It exposes eleven tools; you will use one.",
      "It reads your whole working directory on startup.",
    ],
    note: "I only want the one function. none of the supply chain.",
    build: (note) => ({
      title: "The one function, in your project",
      body: note.trim()
        ? `Your own short version of just that capability, living in your repo — ${note.trim()}`
        : "A faithful description of a package you would be installing into your context and your machine. That is the version without a note.",
    }),
  },
];

const Mutation = () => {
  const [active, setActive] = useState(0);
  const source = SOURCES[active];
  const [note, setNote] = useState(source.note);

  // Switching source swaps in that source's example note, so the panel is
  // never left showing a note that belongs to a different mechanism.
  const pick = (i: number) => {
    setActive(i);
    setNote(SOURCES[i].note);
  };

  const out = useMemo(() => source.build(note), [source, note]);

  return (
    <>
      <div className="fb-mut-tabs" role="tablist" aria-label="Sources">
        {SOURCES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            className="fb-mut-tab"
            onClick={() => pick(i)}
          >
            {s.tab}
          </button>
        ))}
      </div>

      <div className="fb-mut">
        <div className="fb-mut-noterow">
          <span className="fb-caret" aria-hidden="true">✱</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            aria-label="What you want instead"
            placeholder="what you actually want — try clearing this"
          />
        </div>
        <div className="fb-mut-grid">
          <div className="fb-mut-left">
            <p className="fb-mut-src">{source.src}</p>
            <p className="fb-mini">what they described</p>
            <ul className="fb-said">
              {source.said.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="fb-mut-right">
            <p className="fb-mini fb-mini--amber">what you get back</p>
            <h3>{out.title}</h3>
            <p className="fb-mut-body">{out.body}</p>
            <span className="fb-never">your agent builds it — never us</span>
          </div>
        </div>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ *
 * What it actually does.
 *
 * Every line here was checked against the code before being written.
 * Three claims from the draft copy were cut rather than softened:
 *
 *   - "MCP or REST" — there is no REST API. The endpoint speaks MCP.
 *   - "Write-back" as an automatic feature — an agent can write back
 *     with create_idea / update_idea, but nothing does it on its own,
 *     so it is described as something your agent can do, not something
 *     that happens.
 *   - "A Windows build" — electron packager is a devDependency and the
 *     app runs on the desktop, but no packaged installer ships today.
 *
 * If a capability is not here, it is because it is not built. That rule
 * is the whole reason this list is worth reading.
 * ------------------------------------------------------------------ */

const CAPABILITIES: Array<{ group: string; why: string; items: Array<[string, string]> }> = [
  {
    group: "Getting it in",
    why: "The material is worthless if capturing it costs you anything at all.",
    items: [
      ["Share sheet", "Hit share on a reel, a post or a page from any app on your phone."],
      ["Locked platforms", "Instagram and YouTube get transcribed from the link alone."],
      ["Voice capture", "Hold the mic, talk, get it back written down."],
      ["Paste anything", "A URL, a transcript, a wall of text, half a sentence."],
      ["Duplicate check", "Tells you when you have saved that link before."],
    ],
  },
  {
    group: "Making it usable",
    why: "A transcript is not knowledge. The processing is what makes it worth keeping.",
    items: [
      ["Summary", "The key points and the claims the source actually makes."],
      ["Auto-tags and folder", "Tagged and filed on arrival, without you naming anything."],
      ["References", "The links, tools and citations they mentioned, pulled out."],
      ["Deep research", "Send an item out to be researched; it comes back with sources."],
      ["House rules", "Your own instructions, followed by every summary and brief."],
    ],
  },
  {
    group: "Making it connect",
    why: "One save is a note. Sixteen related saves are a plan you never wrote down.",
    items: [
      ["Related items", "Surfaces the saves that belong with this one."],
      ["Cross-pollination", "Points at the older idea that belongs with the new one."],
      ["The graph", "The whole library as a map you can pan and isolate."],
      ["Ask anything", "Chat with any item months later, and keep the answer."],
      ["Search", "Half a word you half-remember, and it comes back with its source."],
    ],
  },
  {
    group: "Turning it into something",
    why: "This is the part nobody else does. The rest of the market stops at storage.",
    items: [
      ["The brief", "Summary, references and your note, compiled into one thing to act on."],
      ["Your note leads", "What you wanted when you saved it is the primary instruction."],
      ["Build mode", "Written for a coding agent, with your stack and your other saves in view."],
      ["A do-not list", "Every brief names what would be unsafe, expensive or wrong to install."],
      ["Marked improvements", "Anything it adds beyond the source is labelled as such."],
    ],
  },
  {
    group: "Attaching it to your work",
    why: "One endpoint, so the brief lands where the building actually happens.",
    items: [
      ["21 tools, one endpoint", "No client library, no plugin, nothing installed on your machine."],
      ["Your agent builds", "It runs on your filesystem, in your project, with your keys."],
      ["Recall mid-build", "Your agent can pull related saves while it works."],
      ["It can write back", "Your agent can file what it built, so the next brief knows."],
      ["Sign-in, not a key", "Connecting signs you in; the endpoint refuses anything else."],
    ],
  },
  {
    group: "Keeping it yours",
    why: "One account is one private brain. No feed, no team, no algorithm.",
    items: [
      ["Reminders", "Alarms, push and email, so an idea can come find you instead."],
      ["Projects and to-dos", "Boards, priorities, and the tasks an idea turned into."],
      ["Share exactly one", "A revocable read-only link to a single item, and nothing else."],
      ["Trash and restore", "Soft delete with 30-day retention. Deleting is never instant."],
      ["Export and delete", "JSON or Markdown out. Account deletion behind re-auth."],
    ],
  },
];

/* Scoped to .fb-root so the marketing page and the app never restyle
   each other. The app paints a fixed aurora behind everything, so the
   root carries its own opaque ground or it shows through. */
const CSS = `
/* Unlock the app's desktop phone frame. #root is 430px wide, overflow
   hidden, rounded and transformed; body::before paints the aurora behind
   it. Without this the page renders as a narrow column with the app's
   background showing down both sides. */
html.fb-landing,
html.fb-landing body,
html.fb-landing #root {
  height:auto !important; min-height:100%; width:auto !important;
  max-width:none !important; overflow:visible !important;
  border-radius:0 !important; box-shadow:none !important;
  transform:none !important; padding-right:0 !important;
  scroll-behavior:smooth;
}
html.fb-landing body::before,
html.fb-landing body::after { display:none !important; }

.fb-root {
  --bg:#06080a; --panel:#0b0f12; --panel2:#0e1417;
  --ink:#d9e2dd; --ink2:#b9c6c0; --dim:#6e7f78; --faint:#46534e;
  --amber:${AMBER}; --green:#63e6a0; --red:#e5624a;
  --rule:rgba(217,226,221,.12); --rule2:rgba(217,226,221,.06);
  --sp:clamp(16px,4vw,44px);
  position:relative; z-index:1; min-height:100vh;
  background:var(--bg); color:var(--ink); overflow-x:hidden;
  font-family:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.fb-root *{box-sizing:border-box}
.fb-root a{color:inherit;text-decoration:none}
.fb-wrap{max-width:1200px;margin:0 auto;padding-left:var(--sp);padding-right:var(--sp)}
.fb-root section{padding-top:clamp(44px,7vw,92px)}
.fb-label{font-family:ui-monospace,SFMono-Regular,monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:0}
.fb-on{color:var(--green)}
.fb-amber{color:var(--amber)}
.fb-mini{font-family:ui-monospace,SFMono-Regular,monospace;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin:0 0 8px}
.fb-mini--amber{color:var(--amber)}
.fb-caret{color:var(--amber);font-family:ui-monospace,monospace}

/* buttons */
.fb-root .fb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  background:var(--amber);color:#10130f;font-weight:700;font-size:14px;padding:11px 18px;
  border:1px solid var(--amber);border-radius:2px;min-height:42px;cursor:pointer;white-space:nowrap;
  font-family:inherit;transition:filter .18s,transform .18s}
.fb-root .fb-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.fb-root .fb-btn--sm{padding:8px 14px;min-height:36px;font-size:13px}
.fb-root .fb-btn--lg{padding:15px 28px;min-height:52px;font-size:16px}
.fb-root .fb-btn--full{width:100%}
.fb-root .fb-btn--ghost{background:transparent;color:var(--ink);border-color:var(--rule);font-weight:500}
.fb-root .fb-btn--ghost:hover{border-color:var(--amber)}

/* nav */
.fb-nav{position:sticky;top:0;z-index:40;background:rgba(6,8,10,.86);backdrop-filter:blur(10px);border-bottom:1px solid var(--rule2)}
.fb-nav-in{display:flex;align-items:center;gap:18px;padding-top:13px;padding-bottom:13px}
.fb-brand{display:inline-flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.02em;margin-right:auto}
.fb-brand i{width:11px;height:11px;border-radius:50%;background:var(--amber);box-shadow:0 0 12px rgba(242,165,60,.8)}
.fb-nav-links{display:none;gap:22px;font-family:ui-monospace,monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
@media(min-width:900px){.fb-nav-links{display:flex}}
.fb-nav-links a:hover{color:var(--ink)}

/* hero */
.fb-hero{position:relative;padding:clamp(34px,6vw,76px) 0 clamp(28px,4vw,52px);min-height:clamp(520px,74vh,720px)}
.fb-drift{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.fb-hero-in{position:relative;z-index:2}
@media(min-width:900px){.fb-hero-in>*{max-width:54%}}
.fb-hero h1{font-size:clamp(34px,6.4vw,76px);line-height:1;letter-spacing:-.04em;font-weight:700;margin:18px 0 0;max-width:17ch;text-wrap:balance}
.fb-lede{color:var(--dim);margin:18px 0 0;font-size:clamp(15px,2vw,17px);line-height:1.6}
.fb-heronote{margin:26px 0 0;padding:14px 16px;border-left:2px solid var(--amber);background:rgba(242,165,60,.05);
  font-family:ui-monospace,monospace;font-size:13px;line-height:1.6;color:var(--amber)}
.fb-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.fb-hud{display:flex;flex-wrap:wrap;gap:8px;margin-top:30px;font-family:ui-monospace,monospace;font-size:11.5px}
.fb-hud span{border:1px solid var(--rule);padding:6px 12px;color:var(--dim);background:rgba(6,8,10,.7)}
.fb-hud b{color:var(--amber);font-variant-numeric:tabular-nums;font-weight:500}
.fb-hint{margin:14px 0 0;font-size:12.5px;color:var(--faint);font-family:ui-monospace,monospace}

/* section heads */
.fb-sec-head{display:grid;gap:12px;margin-bottom:24px}
.fb-sec-head h2{font-size:clamp(24px,3.6vw,38px);letter-spacing:-.035em;margin:0;font-weight:700;text-wrap:balance}
.fb-sec-head p{margin:0;color:var(--dim);max-width:64ch;line-height:1.6;font-size:15.5px}

/* mutation */
.fb-mut-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.fb-root .fb-mut-tab{padding:9px 15px;border:1px solid var(--rule);font-size:13px;color:var(--dim);
  background:rgba(255,255,255,.015);cursor:pointer;font-family:inherit;transition:color .2s,border-color .2s,background .2s}
.fb-root .fb-mut-tab:hover{color:var(--ink)}
.fb-root .fb-mut-tab[aria-selected="true"]{background:var(--amber);border-color:var(--amber);color:#10130f;font-weight:600}
.fb-mut{border:1px solid var(--rule);background:var(--panel)}
.fb-mut-noterow{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--rule);background:rgba(242,165,60,.05)}
.fb-mut-noterow input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--amber);
  font-family:ui-monospace,monospace;font-size:13.5px}
.fb-mut-noterow input::placeholder{color:var(--faint)}
.fb-mut-grid{display:grid;grid-template-columns:1fr}
@media(min-width:940px){.fb-mut-grid{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr)}}
.fb-mut-left{padding:20px;border-bottom:1px solid var(--rule)}
@media(min-width:940px){.fb-mut-left{border-bottom:0;border-right:1px solid var(--rule)}}
.fb-mut-src{font-family:ui-monospace,monospace;font-size:11.5px;color:var(--dim);margin:0 0 12px}
.fb-said{margin:0;padding:0;list-style:none;display:grid;gap:9px}
.fb-said li{padding-left:20px;position:relative;font-size:13.5px;line-height:1.5;color:var(--ink2)}
.fb-said li::before{content:"·";position:absolute;left:6px;color:var(--dim)}
.fb-mut-right{padding:20px;display:grid;gap:10px;align-content:start}
.fb-mut-right h3{margin:0;font-size:19px;letter-spacing:-.02em}
.fb-mut-body{margin:0;font-size:14px;line-height:1.55;color:var(--ink2)}
.fb-never{display:inline-flex;align-items:center;align-self:start;justify-self:start;font-family:ui-monospace,monospace;
  font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--green);
  border:1px solid rgba(99,230,160,.4);padding:4px 10px}

/* wall */
.fb-wall{display:grid;gap:1px;background:var(--rule2);border:1px solid var(--rule);grid-template-columns:1fr}
@media(min-width:820px){.fb-wall{grid-template-columns:1fr 1fr}}
.fb-wall-col{background:var(--bg);padding:20px;display:grid;gap:12px;align-content:start}
.fb-term{font-family:ui-monospace,monospace;font-size:12px;line-height:1.7;background:var(--panel2);
  border:1px solid var(--rule);padding:14px;white-space:pre-wrap;overflow-x:auto;margin:0}
.fb-err{color:var(--red)} .fb-ok{color:var(--green)} .fb-faint{color:var(--faint)}
.fb-why{margin:0;font-size:12.5px;line-height:1.5;color:var(--dim)}

/* loop */
.fb-loop{display:grid;gap:1px;background:var(--rule2);border:1px solid var(--rule);
  grid-template-columns:1fr;margin:0;padding:0;list-style:none;counter-reset:s}
@media(min-width:820px){.fb-loop{grid-template-columns:repeat(4,1fr)}}
.fb-loop li{background:var(--bg);padding:20px;display:grid;gap:6px;align-content:start;counter-increment:s}
.fb-loop b{font-family:ui-monospace,monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber);font-weight:500}
.fb-loop b::before{content:counter(s) " / "}
.fb-loop span{font-size:13px;color:var(--dim);line-height:1.55}

/* capability catalogue */
.fb-cat{margin-top:clamp(30px,5vw,54px)}
.fb-cat-head{border-top:1px solid var(--rule);padding-top:18px;margin-bottom:18px}
.fb-cat-head h3{margin:0 0 6px;font-size:clamp(19px,2.4vw,24px);letter-spacing:-.025em}
.fb-cat-head p{margin:0;color:var(--dim);font-size:14px;line-height:1.5;max-width:64ch}
.fb-cat-grid{display:grid;gap:1px;background:var(--rule2);border:1px solid var(--rule);grid-template-columns:1fr}
@media(min-width:680px){.fb-cat-grid{grid-template-columns:1fr 1fr}}
@media(min-width:1040px){.fb-cat-grid{grid-template-columns:repeat(3,1fr)}}
.fb-cat-card{background:var(--bg);padding:18px;display:grid;gap:6px;align-content:start}
.fb-cat-card h4{margin:0;font-size:15.5px;letter-spacing:-.01em}
.fb-cat-card p{margin:0;font-size:13px;line-height:1.5;color:var(--dim)}

/* pricing */
.fb-plans{display:grid;gap:16px;grid-template-columns:1fr}
@media(min-width:760px){.fb-plans{grid-template-columns:1fr 1fr}}
.fb-plan{border:1px solid var(--rule);padding:24px;background:var(--panel);display:grid;align-content:start}
.fb-plan--featured{border-color:rgba(242,165,60,.55);background:linear-gradient(180deg,rgba(242,165,60,.06),transparent 60%),var(--panel)}
.fb-price{font-size:42px;font-weight:700;letter-spacing:-.04em;margin:0 0 18px;font-variant-numeric:tabular-nums}
.fb-price span{font-size:15px;font-weight:400;color:var(--dim);letter-spacing:0}
.fb-plan ul{margin:0 0 22px;padding:0;list-style:none;display:grid;gap:10px;font-size:14px;color:var(--ink2);line-height:1.45}
.fb-plan li{padding-left:22px;position:relative}
.fb-plan li::before{content:"→";position:absolute;left:0;color:var(--green);font-family:ui-monospace,monospace}
.fb-fine{margin:14px 0 0;font-size:12px;color:var(--faint);line-height:1.5}
.fb-promises{display:grid;gap:1px;background:var(--rule2);border:1px solid var(--rule);margin-top:16px;grid-template-columns:1fr}
@media(min-width:820px){.fb-promises{grid-template-columns:repeat(3,1fr)}}
.fb-promises>div{background:var(--bg);padding:18px 20px;display:grid;gap:5px}
.fb-promises b{font-size:14px}
.fb-promises span{font-size:12.5px;color:var(--dim);line-height:1.5}

/* close */
.fb-close{text-align:center;padding:clamp(52px,9vw,110px) 0 clamp(40px,6vw,72px)}
.fb-close h2{font-size:clamp(28px,5vw,56px);letter-spacing:-.04em;margin:0 0 24px;font-weight:700;text-wrap:balance}
.fb-foot{border-top:1px solid var(--rule);padding:22px 0 40px;color:var(--faint);font-size:12.5px;font-family:ui-monospace,monospace}
.fb-foot-in{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
.fb-foot a:hover{color:var(--ink)}

@media (prefers-reduced-motion: reduce){.fb-root *,.fb-root *::before,.fb-root *::after{animation:none!important;transition:none!important}}
.fb-root :focus-visible{outline:2px solid var(--amber);outline-offset:2px}
`;

/* ------------------------------------------------------------------ *
 * The page.
 * ------------------------------------------------------------------ */

const Landing = ({ onEnter }: { onEnter?: () => void }) => {
  const [lost, setLost] = useState(0);
  const bump = useRef(() => setLost((n) => n + 1)).current;

  // The app shell is a 430px desktop "phone frame": #root is fixed-width,
  // overflow-hidden and transformed, with a fixed aurora painted behind it.
  // The landing page is a long full-bleed document, so it unlocks that frame
  // for as long as it is mounted and hides the app chrome.
  useEffect(() => {
    setLandingActive(true);
    document.documentElement.classList.add("fb-landing");
    return () => {
      setLandingActive(false);
      document.documentElement.classList.remove("fb-landing");
    };
  }, []);

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      <nav className="fb-nav">
        <div className="fb-wrap fb-nav-in">
          <span className="fb-brand">
            <i aria-hidden="true" />
            Fart Brains
          </span>
          <div className="fb-nav-links">
            <a href="#mutation">the mutation</a>
            <a href="#wall">the wall</a>
            <a href="#loop">the loop</a>
            <a href="#everything">everything</a>
            <a href="#pricing">pricing</a>
          </div>
          <button type="button" className="fb-btn fb-btn--sm" onClick={onEnter}>
            Open the vault
          </button>
        </div>
      </nav>

      <header className="fb-hero">
        <DriftField onLost={bump} />
        <div className="fb-wrap fb-hero-in">
          <p className="fb-label">
            <span className="fb-on">●</span> every play you scrolled past is still gone
          </p>
          <h1>
            The tools you actually need <span className="fb-amber">aren&rsquo;t for sale.</span>
          </h1>
          <p className="fb-lede">
            Someone explains exactly how they did it — the tactic, the order, the reason it works.
            It is a 47-second reel or a 22-minute talk, and by Thursday it is gone. There is no
            product to buy that does the thing they described. Fart Brains catches it, and one line
            from you turns it into something that did not exist.
          </p>
          <p className="fb-heronote">✱ &ldquo;I want this, but with multi-tenancy and automated provisioning.&rdquo;</p>
          <div className="fb-cta">
            <button type="button" className="fb-btn" onClick={onEnter}>
              Open the vault
            </button>
            <a className="fb-btn fb-btn--ghost" href="#mutation">
              See what that makes
            </a>
          </div>
          <div className="fb-hud">
            <span>
              gone while you read this <b>{lost}</b>
            </span>
            <span>
              you will never know which <b>—</b>
            </span>
          </div>
          <p className="fb-hint">↑ nobody counts these. that is what a brain fart is.</p>
        </div>
      </header>

      <section id="mutation">
        <div className="fb-wrap">
          <div className="fb-sec-head">
            <p className="fb-label">01 / the mutation</p>
            <h2>Their mechanism. Your one line. Something that did not exist.</h2>
            <p>
              The source gives you a mechanism that already works, explained by whoever ran it. Your
              note is the mutation — the part they never said, because they were not building your
              thing. Edit the note and watch the output change. Clear it and watch what is left.
            </p>
          </div>
          <Mutation />
        </div>
      </section>

      <section id="wall">
        <div className="fb-wrap">
          <div className="fb-sec-head">
            <p className="fb-label">02 / the wall</p>
            <h2>Your AI cannot open the reel. You can.</h2>
            <p>
              The plays live on platforms that do not let agents in. Hand that link to any assistant
              and it hits a wall. Hit share on your phone and it is already inside.
            </p>
          </div>
          <div className="fb-wall">
            <div className="fb-wall-col">
              <p className="fb-mini">an agent, given the link</p>
              <pre className="fb-term">
{`$ fetch https://instagram.com/reel/…
`}<span className="fb-err">net::ERR_CONNECTION_RESET</span>{`
$ curl -sL https://instagram.com/reel/…
`}<span className="fb-faint">{`621 KB of JavaScript shell
no caption, no transcript, no og tags`}</span>
              </pre>
              <p className="fb-why">Not an illustration. That is what happens.</p>
            </div>
            <div className="fb-wall-col">
              <p className="fb-mini fb-mini--amber">you, hitting share</p>
              <pre className="fb-term">
{`share sheet → Fart Brains
`}<span className="fb-ok">{`✓ transcribed
✓ summarized, with the claims kept
✓ references followed
✓ filed, tagged, searchable`}</span>{`
`}<span className="fb-faint">done before the screen locked</span>
              </pre>
              <p className="fb-why">Anyone can summarize a web page. Almost nobody gets in here.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="loop">
        <div className="fb-wrap">
          <div className="fb-sec-head">
            <p className="fb-label">03 / the loop</p>
            <h2>We do not build anything. That is the point.</h2>
            <p>
              The brief goes to whatever you already work in, over one endpoint. Your agent builds
              against its own filesystem — nothing of ours ever runs on your machine — and it can
              file what it built back here, so the next brief knows what you already shipped.
            </p>
          </div>
          <ol className="fb-loop">
            <li>
              <b>capture</b>
              <span>The reel you scrolled past. Share sheet, link, voice or paste.</span>
            </li>
            <li>
              <b>brief</b>
              <span>What the source does, what to build, how it changes for your stack, how to verify it worked.</span>
            </li>
            <li>
              <b>build</b>
              <span>Your agent, your repo, your keys. We never touch the filesystem.</span>
            </li>
            <li>
              <b>back</b>
              <span>Your agent can file what it built, so the next brief is not a repeat.</span>
            </li>
          </ol>
        </div>
      </section>

      <section id="everything">
        <div className="fb-wrap">
          <div className="fb-sec-head">
            <p className="fb-label">04 / everything it does</p>
            <h2>If it is on this list, it is built.</h2>
            <p>
              Nothing here is planned, coming soon, or a roadmap item. Three lines from an earlier
              draft of this page were removed rather than softened, because they described things
              that do not exist yet.
            </p>
          </div>
          {CAPABILITIES.map((g) => (
            <div className="fb-cat" key={g.group}>
              <div className="fb-cat-head">
                <h3>{g.group}</h3>
                <p>{g.why}</p>
              </div>
              <div className="fb-cat-grid">
                {g.items.map(([name, does]) => (
                  <article className="fb-cat-card" key={name}>
                    <h4>{name}</h4>
                    <p>{does}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing">
        <div className="fb-wrap">
          <div className="fb-sec-head">
            <p className="fb-label">05 / pricing</p>
            <h2>Free forever, or nine dollars.</h2>
            <p>
              The free plan is permanent, not a trial with a countdown. Export everything or delete
              the account whenever you want, on either plan.
            </p>
          </div>
          <div className="fb-plans">
            <div className="fb-plan">
              <p className="fb-mini">Free</p>
              <p className="fb-price">
                $0 <span>/month</span>
              </p>
              <ul>
                <li>Unlimited saves, folders, tags and reminders</li>
                <li>Full search and share links</li>
                <li>50 AI actions a month</li>
                <li>Full export and account deletion</li>
              </ul>
              <button type="button" className="fb-btn fb-btn--full" onClick={onEnter}>
                Start free
              </button>
            </div>
            <div className="fb-plan fb-plan--featured">
              <p className="fb-mini fb-mini--amber">Pro</p>
              <p className="fb-price">
                $9 <span>/month</span>
              </p>
              <ul>
                <li>Everything in Free</li>
                <li>1,000 AI actions a month</li>
                <li>Longer transcripts and bigger pages</li>
                <li>Connect your own agent to the endpoint</li>
              </ul>
              <button type="button" className="fb-btn fb-btn--full" onClick={onEnter}>
                Start free, upgrade later
              </button>
              <p className="fb-fine">
                Billing is not switched on yet — Pro is in setup, and nothing will charge you today.
                Start on Free and you will keep everything you save.
              </p>
            </div>
          </div>
          <div className="fb-promises">
            <div>
              <b>One brain, yours.</b>
              <span>No teams, no shared folders, no workspace. One account is one private brain.</span>
            </div>
            <div>
              <b>Share exactly one thing.</b>
              <span>A read-only link to a single item, revocable any time. The recipient sees nothing else.</span>
            </div>
            <div>
              <b>Leave whenever.</b>
              <span>Export to JSON or Markdown, or delete the account outright. Both are one click.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="fb-close">
        <div className="fb-wrap">
          <h2>You cannot miss what you cannot remember.</h2>
          <button type="button" className="fb-btn fb-btn--lg" onClick={onEnter}>
            Open the vault
          </button>
        </div>
      </section>

      <footer className="fb-foot">
        <div className="fb-wrap fb-foot-in">
          <span>Fart Brains</span>
          <span>
            <a href="/privacy">privacy</a> · <a href="/terms">terms</a>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
