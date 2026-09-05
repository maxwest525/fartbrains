import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setLandingActive } from "@/lib/landingMode";

/* ------------------------------------------------------------------ *
 * Fart Brains — landing page.
 *
 * Positioning comes from docs/PRODUCT_TRUTH.md § "Positioning copy":
 * save the reel, get the build brief. Capture and folders are the middle
 * of the chain, not the pitch.
 *
 * Three live demos carry the page, because the product is hard to
 * describe and easy to show:
 *   1. the drift field — ideas escaping, click one to catch it
 *   2. the blend       — a link plus your wish, compiled into your build
 *   3. the clusters    — what a pile of captures assembles into
 *
 * Self-contained on purpose: no app design tokens, no shadcn, no new
 * dependencies, so restyling the app never restyles the marketing page.
 * ------------------------------------------------------------------ */

const REDUCED = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------ content ------------------------------ */

const DRIFTING = [
  "the app idea from the shower",
  "that guy's name",
  "why v2 was better",
  "the fix you had while driving",
  "podcast tangent @ 34:20",
  "a better opening line",
  "the cheaper way to do it",
  "what the client actually meant",
  "the perfect title",
  "the thing you were going to tell her",
];

const STAGES = [
  { label: "transcribe what they said", ms: 880 },
  { label: "extract what they DID", ms: 610 },
  { label: "follow every link mentioned", ms: 540 },
  { label: "research your platforms", ms: 930 },
  { label: "apply your twist", ms: 340 },
  { label: "write YOUR version", ms: 420 },
];

type Cluster = {
  tag: string;
  n: number;
  color: string;
  kind: string;
  items: string[];
  build: string;
  why: string;
};

const CLUSTERS: Cluster[] = [
  {
    tag: "#open-source",
    n: 16,
    color: "#63e6a0",
    kind: "infrastructure",
    items: [
      "Replacing paid scrapers with Crawl4AI",
      "LLM-ready markdown locally",
      "Self-hosted embeddings",
      "Agent skills, open weights",
      "Local vector store benchmarks",
    ],
    build:
      "Your own ingest pipeline — scrape, convert, embed and store locally, with zero per-page API fees.",
    why: "Five of these are people solving one slice each. Together they're a full pipeline, and you already have every piece of it.",
  },
  {
    tag: "#seo",
    n: 23,
    color: "#4dc9ff",
    kind: "missed opportunity",
    items: [
      "Programmatic SEO at 400 pages",
      "Optimizing URLs and titles",
      "AI search and AEO",
      "Reddit distribution",
      "Trustindex review widgets",
    ],
    build:
      "An answer-engine play: cluster pages generated from your own data, structured to be quoted by AI search rather than ranked by it.",
    why: "You saved the old SEO tactics and the AI-search ones in the same month. The overlap is the opportunity — nobody's optimizing for both.",
  },
  {
    tag: "#claude-code",
    n: 19,
    color: "#b18cff",
    kind: "a solution",
    items: [
      "Scaling Claude context",
      "Building a 2026 agentic OS",
      "Multimodal video with Claude",
      "Agent skills that compose",
      "The kernel: rigorous engineering",
    ],
    build:
      "A personal agent OS — your own skills, composed, running against your own brain instead of a marketplace of downloads.",
    why: "Nineteen captures about agents you never revisited. The through-line is that you keep saving other people's setups instead of building one.",
  },
  {
    tag: "#ai-agents",
    n: 12,
    color: "#ff6f9c",
    kind: "a business",
    items: [
      "Omni drone control",
      "Understanding anything",
      "Social agent swarms",
      "Marketing automation stacks",
      "Lead magnet mining",
    ],
    build:
      "One agent that watches your feeds, drafts the posts, and files what it learns back into the brain it came from.",
    why: "These are twelve separate automations. Chained, they're a loop that feeds itself — which is the thing none of the twelve videos mention.",
  },
];

const SOURCES: [string, string][] = [
  ["stripe.com/atlas/guides", "Usage pricing grew from 27% to 46% of SaaS contracts between 2023 and 2026."],
  ["a16z.com/pricing-in-the-age-of-agents", "Per-seat collapses when the seat is an agent that runs a thousand times a day."],
  ["openviewpartners.com/benchmarks", "Hybrid — a platform fee plus metered usage — retains best at enterprise."],
  ["paddle.com/resources/metered", "Unpredictable bills are the top cited reason procurement blocks a metered deal."],
];

const FOLDERS: [string, number][] = [
  ["Inbox", 4],
  ["Ideas", 61],
  ["Marketing", 23],
  ["Engineering", 38],
  ["Research", 12],
  ["Trash", 7],
];

const NOTES: [string, string, string, string][] = [
  ["Cold email teardown", "Lead with their problem. One ask per email. Follow up three times.", "youtube", "Marketing"],
  ["Streaming beats batching", "Stream partial results so the UI never sits blank. Backpressure is the whole game.", "transcript", "Engineering"],
  ["Forgot-it vending machine", "Sits by the grocery exit, stocks the twelve things people drive back for.", "voice note", "Ideas"],
  ["Charge for the outcome", "Seat pricing punishes the thing you want more of. Meter the result instead.", "share sheet", "Research"],
];

/* --------------------------- the blend brief --------------------------- */

type Brief = {
  subject: string;
  src: string;
  kind: string;
  inputs: [string, string][];
  prompt: string;
};

const PLATFORMS = [
  "instagram", "facebook", "linkedin", "tiktok", "youtube",
  "twitter", "threads", "reddit", "email", "newsletter", "shopify", "slack", "notion",
];

/** Builds a brief that visibly follows the wish, so editing it changes the output. */
function derive(input: string, wish: string): Brief {
  const text = (input || "").trim();
  const w = (wish || "").trim();
  const slug = /^https?:\/\//i.test(text)
    ? (text.split("/").filter(Boolean).pop() || "capture").replace(/[-_?=&]+/g, " ")
    : text;
  const what = slug.replace(/^i /i, "").trim() || "the thing they built";

  const targets = PLATFORMS.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(w)).map(
    (t) => t.charAt(0).toUpperCase() + t.slice(1),
  );
  const forWhat = targets.length ? targets.join(" and ") : "your setup";
  const voice = /sound like me|my voice|humaniz/i.test(w);

  return {
    subject: `Your version of ${what}`,
    src: text || "typed capture",
    kind: "video · 8 min · transcribed",
    inputs: [
      ["what they built", "a pipeline that drafts, humanizes and schedules — for LinkedIn only"],
      ["what they DID", "5 steps — pull the source, draft, de-slop the copy, queue, post on a cadence"],
      ["links they mentioned", "2 followed — the scheduler they used, and their prompt gist"],
      ["what you wished", w || "—"],
      [
        "so it researched",
        targets.length
          ? `${forWhat} posting limits, formats and what actually gets reach in 2026`
          : "the platforms and constraints your setup implies",
      ],
    ],
    prompt: [
      `Build my own version of ${what}, for ${forWhat}.`,
      "",
      "The shape that worked for them, kept:",
      "  1. Pull the source material I point it at.",
      "  2. Draft in the platform's native format.",
      "  3. Pass it through a de-slop step so it doesn't read as AI.",
      "  4. Queue it, and post on a cadence I set.",
      "",
      `What has to change for ${forWhat}:`,
      targets.includes("Instagram")
        ? "  · Instagram is caption + visual — generate the visual brief too, not just text."
        : "  · Match each platform's native format rather than reposting one draft everywhere.",
      targets.includes("Facebook")
        ? "  · Facebook rewards longer first-person posts; don't reuse the Instagram caption."
        : "  · Respect each platform's length and link rules.",
      voice
        ? "  · Train the voice on my last 30 posts, not on a generic humanizer prompt."
        : "  · Keep a consistent voice across platforms.",
      "",
      "Build it in this project, with my accounts and my scheduler.",
      "Not their template — mine.",
    ].join("\n"),
  };
}

/* ------------------------------ drift field ------------------------------ */

type Drop = { text: string; w: number; h: number; x: number; dx: number; y: number; v: number; a: number; wob: number };

const DriftField = ({ onCatch }: { onCatch: (text: string) => void }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(0);
  const [caught, setCaught] = useState(0);
  const [lost, setLost] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = REDUCED();
    let w = 0;
    let h = 0;
    let raf = 0;
    let seed = 0;
    const bubbles: Drop[] = [];
    let lostCount = 0;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = () => {
      const text = DRIFTING[seed % DRIFTING.length];
      seed++;
      ctx.font = '13px "IBM Plex Mono", monospace';
      const width = ctx.measureText(text).width + 26;
      // Keep the drift out of the headline column on wide screens.
      const leftEdge = w >= 900 ? w * 0.54 : 12;
      const span = Math.max(1, w - width - leftEdge - 16);
      bubbles.push({
        text,
        w: width,
        h: 28,
        x: leftEdge + Math.random() * span,
        dx: 0,
        y: h + 30,
        v: 0.26 + Math.random() * 0.28,
        a: 1,
        wob: Math.random() * 6.28,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (!reduced) {
          b.y -= b.v;
          b.wob += 0.011;
        }
        const x = b.x + Math.sin(b.wob) * 6;
        if (b.y < h * 0.3 && !reduced) b.a = Math.max(0, b.a - 0.0038);
        if (b.a <= 0 || b.y < -40) {
          bubbles.splice(i, 1);
          lostCount++;
          setLost(lostCount);
          continue;
        }
        b.dx = x;
        ctx.globalAlpha = b.a * 0.9;
        ctx.beginPath();
        const r = 3;
        ctx.moveTo(x + r, b.y);
        ctx.arcTo(x + b.w, b.y, x + b.w, b.y + b.h, r);
        ctx.arcTo(x + b.w, b.y + b.h, x, b.y + b.h, r);
        ctx.arcTo(x, b.y + b.h, x, b.y, r);
        ctx.arcTo(x, b.y, x + b.w, b.y, r);
        ctx.closePath();
        ctx.fillStyle = "rgba(242,165,60,.07)";
        ctx.fill();
        ctx.strokeStyle = "rgba(242,165,60,.42)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(217,226,221,.82)";
        ctx.font = '13px "IBM Plex Mono", monospace';
        ctx.textBaseline = "middle";
        ctx.fillText(b.text, x + 13, b.y + b.h / 2);
        ctx.globalAlpha = 1;
      }
      setLive(bubbles.length);
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (px >= b.dx && px <= b.dx + b.w && py >= b.y && py <= b.y + b.h) {
          bubbles.splice(i, 1);
          setCaught((c) => c + 1);
          onCatch(b.text);
          return;
        }
      }
    };

    size();
    for (let j = 0; j < 4; j++) {
      spawn();
      bubbles[j].y = h - 30 - j * 74;
    }
    draw();
    const timer = reduced ? 0 : window.setInterval(() => { if (bubbles.length < 7) spawn(); }, 2000);
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", size);
    };
  }, [onCatch]);

  return (
    <>
      <canvas id="drift" ref={ref} aria-label="Ideas drifting away — click one to catch it" />
      <div className="hud">
        <span>drifting <b>{live}</b></span>
        <span>caught <b>{caught}</b></span>
        <span>lost forever <b>{lost}</b></span>
      </div>
    </>
  );
};

/* ------------------------------ the blend ------------------------------ */

const BlendConsole = ({ seeded }: { seeded: { text: string; nonce: number } }) => {
  const [url, setUrl] = useState("https://youtu.be/i-automated-my-linkedin-posts");
  const [wish, setWish] = useState("but for Instagram and Facebook, and it has to sound like me");
  const [state, setState] = useState<string[]>(() => STAGES.map(() => "idle"));
  const [brief, setBrief] = useState<Brief | null>(null);
  const timers = useRef<number[]>([]);
  const token = useRef(0);

  const run = useCallback((sourceUrl: string, sourceWish: string) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const mine = ++token.current;
    const result = derive(sourceUrl, sourceWish);

    if (REDUCED()) {
      setState(STAGES.map(() => "done"));
      setBrief(result);
      return;
    }

    setBrief(null);
    const next = STAGES.map(() => "idle");
    setState([...next]);
    let i = 0;
    const step = () => {
      if (mine !== token.current) return;
      if (i >= STAGES.length) {
        setBrief(result);
        return;
      }
      next[i] = "run";
      setState([...next]);
      timers.current.push(
        window.setTimeout(() => {
          if (mine !== token.current) return;
          next[i] = "done";
          i++;
          setState([...next]);
          step();
        }, STAGES[i].ms),
      );
    };
    step();
  }, []);

  useEffect(() => {
    run(url, wish);
    return () => timers.current.forEach(clearTimeout);
    // Only on mount: later runs are driven by the buttons and the drift field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A caught idea from the hero becomes the next thing blended.
  useEffect(() => {
    if (!seeded.nonce) return;
    setUrl(seeded.text);
    run(seeded.text, wish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded.nonce]);

  return (
    <div className="console">
      <div className="console-in">
        <span className="caret">›</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(url, wish)}
          aria-label="Paste a link, or share one in"
        />
      </div>
      <div className="console-in wish-row">
        <span className="caret wish-caret">✱</span>
        <input
          id="c-wish"
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(url, wish)}
          aria-label="What you wish you had"
        />
        <button type="button" className="btn sm" onClick={() => run(url, wish)}>
          Build mine
        </button>
      </div>
      <div className="console-body">
        <div className="stages">
          {STAGES.map((s, i) => (
            <div key={s.label} className={`stage ${state[i] === "run" ? "run" : state[i] === "done" ? "done" : ""}`}>
              <span className="tick">{state[i] === "done" ? "✓" : state[i] === "run" ? "▮" : "·"}</span>
              <span>{s.label}</span>
              <span className="ms">{state[i] === "done" ? `${s.ms}ms` : ""}</span>
            </div>
          ))}
        </div>
        <div className="out">
          {!brief ? (
            <p className="empty">working…</p>
          ) : (
            <article className="card">
              <h3>{brief.subject}</h3>
              <div className="src">{brief.kind} · {brief.src}</div>
              <p className="mini-label">blended from</p>
              <div className="blend">
                {brief.inputs.map(([tag, val], i) => (
                  <div className="blend-row" key={tag} style={{ animationDelay: `${i * 90}ms` }}>
                    <span className="blend-tag">{tag}</span>
                    <span className="blend-val">{val}</span>
                  </div>
                ))}
              </div>
              <p className="mini-label out-label">↓ your custom build — not their template</p>
              <pre className="prompt">{brief.prompt}</pre>
              <div className="card-meta">
                <span>pushed to <strong>your project</strong></span>
                <span>not a downloaded markdown</span>
                <span>kept in your library</span>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- the clusters ----------------------------- */

type CNode = { c: number; x: number; y: number; hx: number; hy: number; r: number; ph: number };

const ClusterField = () => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = REDUCED();
    let w = 0;
    let h = 0;
    let raf = 0;
    let nodes: CNode[] = [];

    const layout = () => {
      const cols = w < 640 ? 2 : 4;
      nodes.forEach((n, i) => {
        const cx = (w * ((n.c % cols) + 0.5)) / cols;
        const cy = h * (w < 640 ? (Math.floor(n.c / cols) + 0.5) / 2 : 0.5);
        const spread = Math.min(w, h) * (n.c === activeRef.current ? 0.17 : 0.1);
        const a = i * 2.399;
        n.hx = cx + Math.cos(a) * spread * 0.8;
        n.hy = cy + Math.sin(a) * spread * 0.8;
      });
    };

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
    };

    nodes = CLUSTERS.flatMap((cl, ci) =>
      Array.from({ length: cl.n }, () => ({
        c: ci,
        x: Math.random() * 400,
        y: Math.random() * 300,
        hx: 0,
        hy: 0,
        r: 2 + Math.random() * 4,
        ph: Math.random() * 6.28,
      })),
    );

    const draw = () => {
      layout();
      ctx.clearRect(0, 0, w, h);
      const act = nodes.filter((n) => n.c === activeRef.current);
      ctx.strokeStyle = "rgba(242,165,60,.22)";
      ctx.lineWidth = 1;
      for (let i = 0; i < act.length; i++) {
        for (let j = i + 1; j < act.length; j++) {
          const d = Math.hypot(act[i].x - act[j].x, act[i].y - act[j].y);
          if (d > 78) continue;
          ctx.globalAlpha = 1 - d / 78;
          ctx.beginPath();
          ctx.moveTo(act[i].x, act[i].y);
          ctx.lineTo(act[j].x, act[j].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      nodes.forEach((n) => {
        n.ph += 0.01;
        n.x += (n.hx + Math.cos(n.ph) * 4 - n.x) * 0.06;
        n.y += (n.hy + Math.sin(n.ph) * 4 - n.y) * 0.06;
        const on = n.c === activeRef.current;
        ctx.globalAlpha = on ? 1 : 0.22;
        ctx.fillStyle = CLUSTERS[n.c].color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, on ? n.r + 1 : n.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    size();
    draw();
    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  const cl = CLUSTERS[active];

  return (
    <div className="cluster-wrap">
      <canvas id="constellation" ref={ref} aria-label="Your saved ideas, grouped into clusters" />
      <div className="cluster-tabs" role="tablist">
        {CLUSTERS.map((c, i) => (
          <button
            key={c.tag}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
          >
            {c.tag} · {c.n}
          </button>
        ))}
      </div>
      <div className="cluster-card">
        <div className="cc-head">
          <span className="cc-dot" style={{ background: cl.color }} />
          <span>{cl.tag} cluster · {cl.n} links</span>
        </div>
        <div className="cc-items">
          {cl.items.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <p className="cc-title">→ {cl.kind} · scaffolded from {cl.n} captures</p>
        <p className="cc-build">{cl.build}</p>
        <p className="cc-why">{cl.why}</p>
      </div>
    </div>
  );
};

/* ---------------------------- deep research ---------------------------- */

const ResearchPanel = () => {
  const [question, setQuestion] = useState("what actually drives SaaS pricing in 2026");
  const [shown, setShown] = useState(0);
  const [report, setReport] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const token = useRef(0);

  const run = useCallback((q: string) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const mine = ++token.current;
    if (REDUCED()) {
      setShown(SOURCES.length);
      setReport(q);
      return;
    }
    setReport(null);
    setShown(0);
    for (let i = 1; i <= SOURCES.length; i++) {
      timers.current.push(
        window.setTimeout(() => {
          if (mine === token.current) setShown(i);
        }, i * 620),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        if (mine === token.current) setReport(q);
      }, SOURCES.length * 620 + 900),
    );
  }, []);

  useEffect(() => {
    run(question);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="console">
      <div className="console-in">
        <span className="caret">?</span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(question)}
          aria-label="Research question"
        />
        <button type="button" className="btn sm" onClick={() => run(question)}>
          Research
        </button>
      </div>
      <div className="console-body">
        <div className="stages">
          {SOURCES.map(([domain, snippet], i) => (
            <div className={`srcrow ${i < shown ? "" : "pending"}`} key={domain}>
              <span className="num">[{i + 1}]</span>
              <div>
                <span className="dom">{domain}</span>
                {i < shown && <span className="snip">{snippet}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="out">
          {!report ? (
            <p className="empty">{shown < SOURCES.length ? "searching the web…" : "synthesizing…"}</p>
          ) : (
            <div className="report">
              <h4>Deep research — {report}</h4>
              <p>
                Seat pricing is being abandoned where the user is an agent rather than a person; usage now
                appears in roughly half of new contracts<span className="cite">[1]</span>. The mechanism is
                simple — a seat that runs a thousand times a day stops being a seat
                <span className="cite">[2]</span>.
              </p>
              <p>
                The retained pattern is hybrid: a platform fee for predictability plus metered usage for
                expansion<span className="cite">[3]</span>. Pure metering is what procurement blocks, because
                an unpredictable bill cannot be approved in advance<span className="cite">[4]</span>.
              </p>
              <div className="append">
                appended to the item as “## Deep research — {report}” · 4 sources saved alongside it
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- app tour ------------------------------- */

type Panel = "vault" | "ash" | "graph" | "cal" | "pad";

const AppTour = () => {
  const [panel, setPanel] = useState<Panel>("vault");
  const [folder, setFolder] = useState("Ideas");

  const graph = useMemo(
    () => ({
      nodes: [
        [70, 80, "pricing"],
        [190, 50, "positioning"],
        [300, 110, "cold email"],
        [140, 180, "streaming"],
        [285, 215, "backpressure"],
        [62, 235, "vending"],
      ] as [number, number, string][],
      edges: [[0, 1], [1, 2], [3, 4], [0, 2], [1, 3]] as [number, number][],
    }),
    [],
  );

  return (
    <div className="app">
      <div className="tabs" role="tablist">
        {([
          ["vault", "Library"],
          ["ash", "Ask"],
          ["graph", "Connections"],
          ["cal", "Calendar"],
          ["pad", "Scratchpad"],
        ] as [Panel, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={panel === id} onClick={() => setPanel(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="app-body">
        <div className="side">
          {FOLDERS.map(([name, n]) => (
            <button key={name} type="button" aria-current={folder === name} onClick={() => setFolder(name)}>
              <span>{name}</span>
              <span className="n">{n}</span>
            </button>
          ))}
        </div>
        <div className="main">
          {panel === "vault" &&
            NOTES.map(([title, body, src, tag]) => (
              <article className="note" key={title} onClick={() => setPanel("ash")}>
                <h4>{title}</h4>
                <p>{body}</p>
                <div className="note-meta">
                  <span className="chip a">{tag}</span>
                  <span className="chip">from {src}</span>
                  <span className="chip g">summarized</span>
                </div>
              </article>
            ))}

          {panel === "ash" && (
            <div className="chat">
              <div className="bub me">what did I decide about pricing again?</div>
              <div className="think">
                <div>› searching 134 ideas…</div>
                <div>› 3 matches · 2 in Research</div>
                <div>› reading “Charge for the outcome”</div>
              </div>
              <div className="bub ai">
                Three notes touch it. The clearest is “Charge for the outcome” from March — seat pricing
                punishes the thing you want more of, so meter the result. Two weeks later you argued against
                yourself: metered bills are unpredictable, which kills enterprise deals. You never resolved it.
              </div>
              <div className="bub me">save that as a new idea</div>
              <div className="bub ai">
                Saved to Research as “Pricing: the unresolved argument”, linked to both sources.
              </div>
            </div>
          )}

          {panel === "graph" && (
            <>
              <svg className="graph" viewBox="0 0 420 300" role="img" aria-label="Ideas connected to one another">
                {graph.edges.map(([a, b]) => (
                  <line
                    key={`${a}-${b}`}
                    x1={graph.nodes[a][0]}
                    y1={graph.nodes[a][1]}
                    x2={graph.nodes[b][0]}
                    y2={graph.nodes[b][1]}
                    stroke="rgba(242,165,60,.4)"
                    strokeWidth="1"
                  />
                ))}
                {graph.nodes.map(([x, y, label], i) => (
                  <g key={label}>
                    <circle cx={x} cy={y} r={i < 2 ? 7 : 5} fill={i < 2 ? "#63e6a0" : "#f2a53c"} />
                    <text x={x + 11} y={y + 4} fill="#6e7f78" fontSize="11" fontFamily="IBM Plex Mono, monospace">
                      {label}
                    </text>
                  </g>
                ))}
              </svg>
              <p className="count">134 ideas · 61 links · cross-pollination found 4 pairs you hadn't connected</p>
            </>
          )}

          {panel === "cal" && (
            <>
              <div className="cal">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <div key={d} className={d === 17 ? "has today" : [4, 9, 23].includes(d) ? "has" : undefined}>
                    {d}
                  </div>
                ))}
              </div>
              <p className="count">17th — Mum's birthday · gift list attached</p>
              <div className="gift">
                {([["Pottery class voucher", "£65", true], ["The Lehman Trilogy tickets", "£110", false], ["Espresso tamper", "£28", false]] as [string, string, boolean][]).map(
                  ([name, price, bought]) => (
                    <div className="gift-row" key={name}>
                      <span className="box">{bought ? "✓" : ""}</span>
                      <span>{name}</span>
                      <span className="price">{price}</span>
                    </div>
                  ),
                )}
              </div>
            </>
          )}

          {panel === "pad" && (
            <>
              <div className="pad">
                {([["Reply to the pricing thread", true], ["Draft the cold email sequence", false], ["Ask about onboarding", false]] as [string, boolean][]).map(
                  ([task, done]) => (
                    <div className={`todo${done ? " done" : ""}`} key={task}>
                      <span className="box">{done ? "✓" : ""}</span>
                      <span>{task}</span>
                    </div>
                  ),
                )}
                <div className="jot">
                  {"jot pad — syncs as you type\n\nvending machine idea: the margin is the\nconvenience, not the goods. check if\nanyone's done it at airports."}
                </div>
              </div>
              <p className="count">desktop only — sits in a resizable column beside the library</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* --------------------------------- page --------------------------------- */

const Landing = ({ onEnter }: { onEnter?: () => void }) => {
  const [scrolled, setScrolled] = useState(false);
  const [seeded, setSeeded] = useState({ text: "", nonce: 0 });

  const onCatch = useCallback((text: string) => {
    setSeeded((s) => ({ text, nonce: s.nonce + 1 }));
    document.getElementById("capture")?.scrollIntoView({
      behavior: REDUCED() ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The app shell locks body/#root to the viewport (it's a desktop-style
  // window). This is a long scrolling document, so it unlocks page scroll
  // while mounted and hides the app chrome.
  useEffect(() => {
    setLandingActive(true);
    document.documentElement.classList.add("fb-landing");
    return () => {
      setLandingActive(false);
      document.documentElement.classList.remove("fb-landing");
    };
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Fart Brains — save the reel, get the build brief";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      <nav className="nav">
        <div className="wrap nav-in">
          <span className="brand">
            <i />
            Fart Brains
          </span>
          <div className="nav-links label">
            <a href="#capture">the blend</a>
            <a href="#clusters">clusters</a>
            <a href="#research">research</a>
            <a href="#rebuild">rebuild</a>
            <a href="#pricing">pricing</a>
          </div>
          <button type="button" className="btn sm" onClick={onEnter}>
            Start free
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap hero-in">
          <p className="label">
            external brain drive · <span className="on">● connected</span> · yours alone
          </p>
          <h1>
            You saw it work for them. <span className="amber">Get your own version.</span>
          </h1>
          <p className="lede">
            A video goes past: someone's built a thing that writes their LinkedIn posts, humanizes them, and
            schedules them. You think <em>damn, I want that for Instagram and Facebook</em>. Share the link,
            say that out loud, and you get your own custom build — not their template, not a downloaded
            markdown. Yours.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn" onClick={onEnter}>
              Start free
            </button>
            <a className="btn ghost" href="#capture">
              See it work
            </a>
          </div>
          <DriftField onCatch={onCatch} />
          <p className="hint">↑ hit share on a reel and it lands here. click one to see what it becomes.</p>
        </div>
      </header>

      <section id="capture">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">01 / the blend</p>
            <h2>A link, plus the thing you wished. That's the whole input.</h2>
            <p>
              It transcribes what they said, extracts what they actually <em>did</em>, follows every link they
              mentioned, researches the gaps, and folds in your twist — the “but for Instagram” part. What
              comes out is a build for your situation, aimed at your project. Change the wish and the whole
              thing changes with it.
            </p>
          </div>
          <BlendConsole seeded={seeded} />
        </div>
      </section>

      <section id="clusters">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">02 / the cluster</p>
            <h2>It connected the dots and built the scaffolding.</h2>
            <p>
              Sixteen things you saved months apart, sitting next to each other. Your brain drive reads across
              them, finds the through-line, and stands up the infrastructure — a business, a solution, or the
              opportunity you already walked past once. You don't get a reading list. You get the thing,
              scaffolded, ready to build.
            </p>
          </div>
          <ClusterField />
        </div>
      </section>

      <section id="research">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">03 / ask it anything</p>
            <h2>Ask in your words. Not the file's.</h2>
            <p>
              You don't remember the title, the folder, or what you called it — you remember roughly what it
              was about. Ask that. It searches across everything you've saved, answers in a straight line, and
              shows the source behind every claim. When your own library doesn't cover it, it goes out to the
              web and brings back the rest, cited.
            </p>
          </div>
          <ResearchPanel />
        </div>
      </section>

      <section id="attach">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">04 / point it at anything</p>
            <h2>One brain. Aim it at whatever you're working on.</h2>
            <p>
              Connect your own AI and it works with everything you've saved — your research, your transcripts,
              your half-finished thinking — inside the project you're already in. No plugin zoo, nothing new on
              your machine, and a record of everything it read.
            </p>
          </div>
          <div className="attach">
            <div className="attach-col">
              <p className="mini-label">without it</p>
              <ul className="bad">
                <li>Re-explaining context you already wrote down</li>
                <li>Pasting the same notes in again and again</li>
                <li>A different plugin for every tool you use</li>
                <li>No idea what it read or did</li>
              </ul>
            </div>
            <div className="attach-col">
              <p className="mini-label out-label">with it</p>
              <ul className="good">
                <li>It already knows what you saved</li>
                <li>One connection, set up once</li>
                <li>Nothing of ours on your machine</li>
                <li>A record of everything it read</li>
              </ul>
              <pre className="prompt attach-code">
                {"connect your AI to:\n  https://fartbrains.app/mcp\n\nthat's the whole setup."}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section id="rebuild">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">05 / rebuild, don't install</p>
            <h2>Someone recommends an MCP server. You don't have to trust it.</h2>
            <p>
              Send it here instead. Your brain reads what the thing actually does, triages whether you need all
              of it or one function of it, and then — unless it's genuinely complex — writes you your own
              version from scratch. You get the capability. You don't get a stranger's code running next to
              your keys.
            </p>
          </div>
          <div className="triage">
            <div className="tri-step">
              <p className="mini-label">1 · read</p>
              <p>What does it actually do, what does it touch, and what does it send out? Stated plainly, before anything runs.</p>
            </div>
            <div className="tri-arrow" aria-hidden="true">→</div>
            <div className="tri-step">
              <p className="mini-label">2 · triage</p>
              <p>You wanted one function out of forty. That's the only part worth having, and it's a hundred lines.</p>
            </div>
            <div className="tri-arrow" aria-hidden="true">→</div>
            <div className="tri-step featured">
              <p className="mini-label out-label">3 · rebuild</p>
              <p>Your own implementation, in your own project, matching your conventions. Same capability, none of the supply chain.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="library">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">06 / your library</p>
            <h2>Findable in a year, not just this week.</h2>
            <p>
              Folders, tags and search that works on half a remembered word. Ideas that come back to find you.
              And a map of how the things you saved connect to each other.
            </p>
          </div>
          <AppTour />
        </div>
      </section>

      <section id="pricing">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">07 / pricing</p>
            <h2>Free forever, or nine dollars.</h2>
            <p>
              The free plan is real and permanent, not a trial with a countdown. Export everything or delete
              the account whenever you want, on either plan.
            </p>
          </div>
          <div className="plans">
            <div className="plan">
              <p className="mini-label">Free</p>
              <p className="price">$0<span>/month</span></p>
              <ul>
                <li>Unlimited saves, folders, tags, reminders</li>
                <li>Full search and share links</li>
                <li>50 AI actions a month</li>
                <li>Full export and account deletion</li>
              </ul>
              <button type="button" className="btn ghost full" onClick={onEnter}>
                Start free
              </button>
              <p className="fine">
                Saving a popular video usually costs nothing at all — cached and caption-based transcripts
                don't count against it.
              </p>
            </div>
            <div className="plan featured">
              <p className="mini-label out-label">Pro</p>
              <p className="price">$9<span>/month</span></p>
              <ul>
                <li>Everything in Free</li>
                <li>1,000 AI actions a month</li>
                <li>Longer transcripts, bigger pages</li>
                <li>Priority support</li>
              </ul>
              <button type="button" className="btn full" onClick={onEnter}>
                Try Pro free for 14 days
              </button>
              <p className="fine">No card required. $90 a year if you'd rather — two months free.</p>
            </div>
          </div>
          <div className="promises">
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
              <span>Export to JSON or Markdown, or delete the account outright. Both are one click in settings.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <h2>Stop losing the good ones.</h2>
          <button type="button" className="btn" onClick={onEnter}>
            Start free
          </button>
          <div className="foot">
            <span>fart brains — an external brain drive</span>
            <span>web · installable · windows desktop</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;

/* -------------------------------- styles -------------------------------- */

const CSS = `
:root {
    color-scheme: dark;
    /* Direction A palette, now carrying the whole page */
    --bg: #06080a;
    --panel: #0b0f12;
    --panel-2: #0e1417;
    --ink: #d9e2dd;
    --ink-2: #b9c6c0;
    --dim: #6e7f78;
    --faint: #46534e;
    --amber: #f2a53c;
    --green: #63e6a0;
    --rule: rgba(217,226,221,.12);
    --rule-2: rgba(217,226,221,.06);
    --sp: clamp(16px, 4vw, 44px);
    --max: 1200px;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; overflow-x: hidden;
  }
  a { color: inherit; text-decoration: none; }
  button { font: inherit; color: inherit; cursor: pointer; background: none; border: 0; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace; }
  .wrap { max-width: var(--max); margin: 0 auto; padding-left: var(--sp); padding-right: var(--sp); }
  .label {
    font-family: "IBM Plex Mono", monospace; font-size: 11.5px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--dim); margin: 0;
  }
  .label .on { color: var(--green); }
  .amber { color: var(--amber); }

  /* ---------- placeholder marker: these blocks are the ones to swap for templates ---------- */
  .slot { position: relative; }
  .slot::before {
    content: attr(data-slot);
    position: absolute; top: -9px; left: 0; z-index: 3;
    font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .12em;
    text-transform: uppercase; color: var(--faint);
    background: var(--bg); padding: 0 8px;
  }

  /* ---------- nav ---------- */
  .nav {
    position: sticky; top: 0; z-index: 40; background: rgba(6,8,10,.86);
    backdrop-filter: blur(10px); border-bottom: 1px solid var(--rule-2);
  }
  .nav-in { display: flex; align-items: center; gap: 18px; padding-top: 13px; padding-bottom: 13px; }
  .brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -0.02em; margin-right: auto; }
  .brand i { width: 11px; height: 11px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 12px rgba(242,165,60,.8); }
  .nav-links { display: none; gap: 22px; }
  @media (min-width: 900px) { .nav-links { display: flex; } }
  .nav-links a:hover { color: var(--ink); }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: var(--amber); color: #10130f; font-weight: 700; font-size: 14px;
    padding: 11px 18px; border-radius: 2px; min-height: 42px; white-space: nowrap;
    transition: filter .18s, transform .18s;
  }
  .btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .btn.sm { padding: 8px 14px; min-height: 36px; font-size: 13px; }
  .btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--rule); font-weight: 500; }
  .btn.ghost:hover { border-color: var(--amber); }

  /* ---------- 1. hero + drift field (animation C, restyled) ---------- */
  .hero { position: relative; padding: clamp(34px, 6vw, 76px) 0 clamp(28px, 4vw, 52px); min-height: clamp(520px, 74vh, 720px); }
  .hero-in { max-width: 100%; }
  @media (min-width: 900px) { .hero-in .label, .hero h1, .hero p.lede, .hero-cta, .hud, .hint { max-width: 52%; } }
  #drift {
    position: absolute; inset: 0; width: 100%; height: 100%;
    z-index: 0; cursor: crosshair;
  }
  .hero-in { position: relative; z-index: 2; pointer-events: none; }
  .hero-in a, .hero-in button { pointer-events: auto; }
  .hero h1 {
    font-size: clamp(34px, 6.4vw, 76px); line-height: 1.0; letter-spacing: -0.04em;
    font-weight: 700; margin: 18px 0 0; max-width: 17ch; text-wrap: balance;
  }
  .hero p.lede { color: var(--dim); max-width: 54ch; margin: 18px 0 0; font-size: clamp(15px,2vw,17px); line-height: 1.6; }
  .hero-cta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
  .hud { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 30px; font-family: "IBM Plex Mono", monospace; font-size: 11.5px; }
  .hud span { border: 1px solid var(--rule); padding: 6px 12px; color: var(--dim); background: rgba(6,8,10,.7); }
  .hud b { color: var(--amber); font-variant-numeric: tabular-nums; font-weight: 500; }
  .hint { margin: 14px 0 0; font-size: 12.5px; color: var(--faint); font-family: "IBM Plex Mono", monospace; }

  /* ---------- 2. console (animation A) ---------- */
  section { padding-top: clamp(44px, 7vw, 92px); }
  .sec-head { display: grid; gap: 12px; margin-bottom: 24px; }
  .sec-head h2 { font-size: clamp(24px, 3.6vw, 38px); letter-spacing: -0.035em; margin: 0; font-weight: 700; text-wrap: balance; }
  .sec-head p { margin: 0; color: var(--dim); max-width: 60ch; line-height: 1.6; font-size: 15.5px; }

  .console { border: 1px solid var(--rule); background: var(--panel); }
  .console-in { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--rule); }
  .console-in .caret { color: var(--green); font-family: "IBM Plex Mono", monospace; }
  .console-in input {
    flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--ink);
    font-family: "IBM Plex Mono", monospace; font-size: 14px;
  }
  .console-in input::placeholder { color: var(--faint); }
  .console-body { display: grid; grid-template-columns: 1fr; }
  @media (min-width: 900px) { .console-body { grid-template-columns: 268px 1fr; } }
  .stages { padding: 16px; display: grid; gap: 1px; align-content: start; border-bottom: 1px solid var(--rule); }
  @media (min-width: 900px) { .stages { border-bottom: 0; border-right: 1px solid var(--rule); } }
  .stage {
    display: grid; grid-template-columns: 16px 1fr auto; gap: 10px; align-items: center;
    padding: 8px 4px; font-family: "IBM Plex Mono", monospace; font-size: 12.5px; color: var(--dim);
  }
  .stage .tick { color: #35423d; }
  .stage.run { color: var(--ink); } .stage.run .tick { color: var(--amber); animation: blink .7s steps(2) infinite; }
  .stage.done { color: var(--ink); } .stage.done .tick { color: var(--green); }
  .stage .ms { font-size: 11px; color: var(--faint); font-variant-numeric: tabular-nums; }
  @keyframes blink { 50% { opacity: .2; } }
  .out { padding: 18px; min-height: 300px; }
  .out .empty { color: var(--faint); font-size: 13px; font-family: "IBM Plex Mono", monospace; }
  .card { border: 1px solid var(--rule); background: var(--panel-2); padding: 17px; }
  .card h3 { margin: 0 0 5px; font-size: 18px; letter-spacing: -0.02em; }
  .card .src { font-family: "IBM Plex Mono", monospace; font-size: 11.5px; color: var(--dim); word-break: break-all; }
  .card ul { margin: 14px 0 0; padding-left: 17px; display: grid; gap: 7px; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 15px; }
  .tag { font-family: "IBM Plex Mono", monospace; font-size: 11px; padding: 3px 9px; border: 1px solid rgba(242,165,60,.4); color: var(--amber); }
  .card-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 15px; padding-top: 13px; border-top: 1px solid var(--rule); font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--dim); }
  .card-meta strong { color: var(--green); font-weight: 500; }
  .wish-row { background: rgba(242,165,60,.04); }
  .wish-caret { color: var(--amber) !important; }
  #c-wish { color: var(--amber); }
  .blend { display: grid; gap: 7px; }
  .blend-row {
    display: grid; grid-template-columns: 150px 1fr; gap: 12px; align-items: baseline;
    font-size: 12.5px; line-height: 1.5; animation: blendin .4s cubic-bezier(.2,.8,.2,1) both;
  }
  @media (max-width: 640px) { .blend-row { grid-template-columns: 1fr; gap: 2px; } }
  @keyframes blendin { from { opacity: 0; transform: translateX(-6px); } }
  .blend-tag {
    font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .1em;
    text-transform: uppercase; color: var(--amber);
  }
  .blend-val { color: var(--ink-2); }
  .mini-label { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .13em; text-transform: uppercase; color: var(--faint); margin: 16px 0 8px; }
  .mini-label.out-label { color: var(--amber); }
  .evidence { display: grid; gap: 6px; }
  .ev-row { display: grid; grid-template-columns: 74px 1fr; gap: 10px; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
  .ev-loc { font-family: "IBM Plex Mono", monospace; color: var(--green); font-variant-numeric: tabular-nums; }
  .prompt {
    margin: 0; padding: 14px; border: 1px solid rgba(242,165,60,.35); background: rgba(242,165,60,.05);
    font-family: "IBM Plex Mono", monospace; font-size: 12.5px; line-height: 1.65; color: var(--ink);
    white-space: pre-wrap; overflow-x: auto;
  }

  /* ---------- 3. app tour (animation B, restyled) ---------- */
  .srcrow { display: grid; grid-template-columns: 18px 1fr; gap: 10px; padding: 8px 4px; font-size: 12.5px; color: var(--dim); align-items: start; }
  .srcrow .num { font-family: "IBM Plex Mono", monospace; color: var(--amber); }
  .srcrow .dom { color: var(--ink-2); display: block; }
  .srcrow .snip { color: var(--faint); font-size: 11.5px; line-height: 1.45; }
  .srcrow.pending { opacity: .35; }
  .report { font-size: 13.5px; line-height: 1.65; color: var(--ink-2); }
  .report h4 { margin: 0 0 10px; font-size: 16px; color: var(--ink); letter-spacing: -0.02em; }
  .report p { margin: 0 0 11px; }
  .cite { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; color: var(--amber); vertical-align: super; }
  .report .append { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rule); font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--dim); }

  .cluster-wrap { position: relative; border: 1px solid var(--rule); background: var(--panel); overflow: hidden; }
  #constellation { display: block; width: 100%; height: clamp(340px, 52vw, 480px); }
  .cluster-tabs { position: absolute; left: 14px; top: 14px; display: flex; flex-wrap: wrap; gap: 6px; }
  .cluster-tabs button {
    font-family: "IBM Plex Mono", monospace; font-size: 11.5px; padding: 6px 11px;
    border: 1px solid var(--rule); background: rgba(6,8,10,.8); color: var(--dim);
  }
  .cluster-tabs button[aria-selected="true"] { color: #10130f; background: var(--amber); border-color: var(--amber); }
  .cluster-card {
    position: absolute; right: 14px; bottom: 14px; left: 14px;
    border: 1px solid var(--rule); background: rgba(11,15,18,.96); backdrop-filter: blur(6px);
    padding: 16px; display: grid; gap: 10px;
  }
  @media (min-width: 900px) { .cluster-card { left: auto; width: 460px; } }
  .cc-head { display: flex; align-items: center; gap: 9px; font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--dim); }
  .cc-dot { width: 9px; height: 9px; border-radius: 50%; }
  .cc-items { display: flex; flex-wrap: wrap; gap: 5px; }
  .cc-items span { font-size: 11px; color: var(--ink-2); border: 1px solid var(--rule); padding: 3px 8px; }
  .cc-title { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--amber); margin: 2px 0 0; }
  .cc-build { margin: 0; font-size: 14px; line-height: 1.55; color: var(--ink); }
  .cc-why { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--dim); }

  .triage { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; }
  @media (min-width: 900px) { .triage { grid-template-columns: 1fr 24px 1fr 24px 1fr; } }
  .tri-step { border: 1px solid var(--rule); padding: 20px; background: var(--panel); }
  .tri-step.featured { border-color: rgba(242,165,60,.5); background: linear-gradient(180deg, rgba(242,165,60,.06), transparent 70%), var(--panel); }
  .tri-step p:last-child { margin: 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.55; }
  .tri-step .mini-label { margin-top: 0; }
  .tri-arrow { display: none; align-items: center; justify-content: center; color: var(--faint); font-family: "IBM Plex Mono", monospace; }
  @media (min-width: 900px) { .tri-arrow { display: flex; } }

  .attach { display: grid; gap: 1px; background: var(--rule-2); border: 1px solid var(--rule); grid-template-columns: 1fr; }
  @media (min-width: 820px) { .attach { grid-template-columns: 1fr 1.2fr; } }
  .attach-col { background: var(--bg); padding: 20px; }
  .attach-col ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; font-size: 14px; line-height: 1.5; }
  .attach-col li { padding-left: 24px; position: relative; color: var(--dim); }
  .attach-col li::before { position: absolute; left: 0; font-family: "IBM Plex Mono", monospace; }
  .bad li::before { content: "×"; color: #e5624a; }
  .good li::before { content: "→"; color: var(--green); }
  .good li { color: var(--ink-2); }
  .attach-code { margin-top: 18px; font-size: 12px; }

  .app { border: 1px solid var(--rule); background: var(--panel); }
  .tabs { display: flex; overflow-x: auto; border-bottom: 1px solid var(--rule); background: var(--panel-2); }
  .tabs button {
    padding: 12px 16px; font-size: 13px; color: var(--dim); white-space: nowrap;
    border-bottom: 2px solid transparent;
  }
  .tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--amber); }
  .app-body { display: grid; grid-template-columns: 1fr; min-height: 340px; }
  @media (min-width: 660px) { .app-body { grid-template-columns: 158px 1fr; } }
  .side { display: none; padding: 12px; border-right: 1px solid var(--rule); gap: 1px; align-content: start; }
  @media (min-width: 660px) { .side { display: grid; } }
  .side button {
    display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px;
    font-size: 13px; color: var(--dim); text-align: left; width: 100%;
  }
  .side button[aria-current="true"] { background: rgba(242,165,60,.12); color: var(--ink); }
  .side .n { font-family: "IBM Plex Mono", monospace; font-size: 11px; font-variant-numeric: tabular-nums; }
  .main { padding: 14px; display: grid; gap: 10px; align-content: start; }
  .note { border: 1px solid var(--rule); padding: 13px 14px; display: grid; gap: 7px; cursor: pointer; transition: border-color .18s; background: rgba(255,255,255,.015); }
  .note:hover { border-color: rgba(242,165,60,.5); }
  .note h4 { margin: 0; font-size: 14.5px; font-weight: 600; }
  .note p { margin: 0; font-size: 13px; color: var(--dim); line-height: 1.5; }
  .note-meta { display: flex; flex-wrap: wrap; gap: 8px; font-family: "IBM Plex Mono", monospace; font-size: 10.5px; color: var(--dim); }
  .chip { border: 1px solid var(--rule); padding: 2px 8px; }
  .chip.a { color: var(--amber); border-color: rgba(242,165,60,.4); }
  .chip.g { color: var(--green); border-color: rgba(99,230,160,.4); }
  .chat { display: grid; gap: 9px; }
  .bub { max-width: 82%; padding: 10px 13px; font-size: 13.5px; line-height: 1.5; }
  .bub.me { justify-self: end; background: var(--amber); color: #10130f; }
  .bub.ai { border: 1px solid var(--rule); background: var(--panel-2); }
  .think { font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--faint); border-left: 2px solid var(--rule); padding: 6px 0 6px 10px; display: grid; gap: 4px; }
  .graph { display: block; width: 100%; height: 300px; }
  .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
  .cal div { aspect-ratio: 1; border: 1px solid var(--rule); font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--dim); padding: 5px; position: relative; }
  .cal div.has::after { content: ""; position: absolute; left: 5px; bottom: 5px; width: 5px; height: 5px; border-radius: 50%; background: var(--green); }
  .cal div.today { border-color: var(--amber); color: var(--ink); }
  .gift { display: grid; gap: 8px; }
  .gift-row { display: flex; align-items: center; gap: 10px; border: 1px solid var(--rule); padding: 10px 12px; font-size: 13px; }
  .gift-row .price { margin-left: auto; font-family: "IBM Plex Mono", monospace; color: var(--dim); font-variant-numeric: tabular-nums; }
  .gift-row .box { width: 14px; height: 14px; border: 1px solid var(--rule); display: grid; place-items: center; font-size: 10px; color: var(--green); }
  .pad { display: grid; gap: 10px; }
  .pad .todo { display: flex; gap: 10px; align-items: center; font-size: 13.5px; padding: 8px 0; border-bottom: 1px solid var(--rule-2); }
  .pad .todo .box { width: 14px; height: 14px; border: 1px solid var(--rule); display: grid; place-items: center; font-size: 10px; color: var(--green); flex: none; }
  .pad .todo.done { color: var(--faint); text-decoration: line-through; }
  .jot { border: 1px solid var(--rule); padding: 12px; font-family: "IBM Plex Mono", monospace; font-size: 12.5px; color: var(--ink-2); line-height: 1.6; background: var(--panel-2); white-space: pre-wrap; }

  /* ---------- 4. full inventory ---------- */
  .inv { display: grid; gap: 1px; background: var(--rule-2); border: 1px solid var(--rule); grid-template-columns: 1fr; }
  @media (min-width: 700px) { .inv { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1020px) { .inv { grid-template-columns: repeat(3, 1fr); } }
  .inv-col { background: var(--bg); padding: 20px; display: grid; gap: 3px; align-content: start; }
  .inv-col h3 {
    font-family: "IBM Plex Mono", monospace; font-size: 11.5px; letter-spacing: .14em;
    text-transform: uppercase; margin: 0 0 12px; font-weight: 500;
    display: flex; align-items: center; gap: 8px;
  }
  .inv-col h3::before { content: ""; width: 8px; height: 8px; border-radius: 50%; }
  .inv-ok h3 { color: var(--green); } .inv-ok h3::before { background: var(--green); }
  .inv-warn h3 { color: var(--amber); } .inv-warn h3::before { background: var(--amber); }
  .inv-no h3 { color: #e5624a; } .inv-no h3::before { background: #e5624a; }
  .inv-item { display: grid; gap: 3px; padding: 9px 0; border-bottom: 1px solid var(--rule-2); }
  .inv-item:last-child { border-bottom: 0; }
  .inv-item b { font-size: 14px; font-weight: 600; }
  .inv-item span { font-size: 12.5px; color: var(--dim); line-height: 1.5; }
  .count { font-family: "IBM Plex Mono", monospace; font-size: 12px; color: var(--dim); }

  .plans { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 760px) { .plans { grid-template-columns: 1fr 1fr; } }
  .plan { border: 1px solid var(--rule); padding: 24px; display: grid; gap: 0; align-content: start; background: var(--panel); }
  .plan.featured { border-color: rgba(242,165,60,.55); background: linear-gradient(180deg, rgba(242,165,60,.06), transparent 60%), var(--panel); }
  .plan .mini-label { margin-top: 0; }
  .price { font-size: 42px; font-weight: 700; letter-spacing: -0.04em; margin: 0 0 18px; font-variant-numeric: tabular-nums; }
  .price span { font-size: 15px; font-weight: 400; color: var(--dim); letter-spacing: 0; }
  .plan ul { margin: 0 0 22px; padding: 0; list-style: none; display: grid; gap: 10px; font-size: 14px; color: var(--ink-2); line-height: 1.45; }
  .plan li { padding-left: 22px; position: relative; }
  .plan li::before { content: "→"; position: absolute; left: 0; color: var(--green); font-family: "IBM Plex Mono", monospace; }
  .btn.full { width: 100%; }
  .fine { margin: 14px 0 0; font-size: 12px; color: var(--faint); line-height: 1.5; }
  .promises { display: grid; gap: 1px; background: var(--rule-2); border: 1px solid var(--rule); margin-top: 16px; grid-template-columns: 1fr; }
  @media (min-width: 820px) { .promises { grid-template-columns: repeat(3, 1fr); } }
  .promises > div { background: var(--bg); padding: 18px 20px; display: grid; gap: 5px; }
  .promises b { font-size: 14px; }
  .promises span { font-size: 12.5px; color: var(--dim); line-height: 1.5; }

  /* ---------- close ---------- */
  .close { text-align: center; padding: clamp(52px, 9vw, 110px) 0 clamp(40px,6vw,72px); }
  .close h2 { font-size: clamp(28px, 5vw, 56px); letter-spacing: -0.04em; margin: 0 0 20px; font-weight: 700; }
  .foot { border-top: 1px solid var(--rule); padding: 22px 0 40px; color: var(--faint); font-size: 12.5px; font-family: "IBM Plex Mono", monospace; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; }
  .note-box { border: 1px dashed var(--rule); padding: 16px 18px; margin-top: 30px; color: var(--dim); font-size: 13.5px; line-height: 1.65; }
  .note-box b { color: var(--ink); }

  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
  :focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
`;
