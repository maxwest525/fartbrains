import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setLandingActive } from "@/lib/landingMode";

/* ------------------------------------------------------------------ *
 * Fart Brains — landing page.
 *
 * The pitch: the capabilities worth having are not for sale. Somebody
 * describes a mechanism once, in a reel or a talk, and it is gone by
 * Thursday. Caught here, one line of your own intent mutates it into
 * something that has never existed.
 *
 * Three live pieces carry it, because this is easier to show than say:
 *   1. the drift    — what leaves your head while you scroll
 *   2. the mutation — their mechanism + your note = a new thing
 *   3. the clusters — what a pile of saves assembles into
 *
 * Self-contained on purpose: no app design tokens, no shadcn, no new
 * dependencies, so restyling the app never restyles the marketing page.
 * ------------------------------------------------------------------ */

const REDUCED = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------ content ------------------------------ */

const DRIFTING = [
  "the SEO play from that reel",
  "how they did multi-tenancy",
  "the hooks-and-loops talk",
  "why their onboarding converts",
  "the pricing thing at 34:20",
  "that scraper nobody pays for",
  "the cold open that worked",
  "what the client actually meant",
  "the architecture from the podcast",
  "the one you had in the shower",
];

type Mutation = {
  id: string;
  label: string;
  source: string;
  said: string[];
  note: string;
  title: string;
  summary: string;
  parts: [string, string][];
  diagram: "routes" | "loops" | "tenancy";
};

const MUTATIONS: Mutation[] = [
  {
    id: "loops",
    label: "A talk on how agents work",
    source: "conference talk · 22 min · transcribed",
    said: [
      "An agent is a loop: observe, act, check the result, go again.",
      "Hooks are where you interrupt the loop to enforce something.",
      "Most failures are a loop that never checks its own output.",
    ],
    note: "I want this, plus a second one wrapped around it that challenges its ideas",
    title: "A self-critiquing agent architecture",
    summary:
      "The talk described one loop. Your note put a second loop around it, so the brief has to solve everything that only exists once two loops disagree — none of which was in the source.",
    parts: [
      ["from the talk", "The builder loop: observe → act → check → repeat, with hooks at the act boundary."],
      ["from your note", "A critic loop that reads the builder's output and argues against it before anything lands."],
      ["neither said this", "A disagreement protocol — who wins, how many rounds, and the stop condition when they deadlock."],
      ["neither said this", "Arbitration: escalate to you only when the critic blocks twice on the same claim."],
    ],
    diagram: "loops",
  },
  {
    id: "routes",
    label: "A 47-second SEO reel",
    source: "instagram reel · 47s · transcribed",
    said: [
      "Register brandnamereviews.com and link it from the main site.",
      "Put the platform name at the end of the title and the URL slug.",
      "Use “cheap” in titles — nobody does, and it wins the click.",
    ],
    note: "but for fartbrains.app, and it has to survive our stack",
    title: "Ten interceptor routes and the pipeline that makes them visible",
    summary:
      "Three tactics from a stranger, aimed at your repo. The last line is the one that matters, and the reel could not have known it.",
    parts: [
      ["from the reel", "Slug and title pattern with the platform name last, across ten routes."],
      ["from the reel", "A reviews microsite carrying video reviews with full transcripts."],
      ["from your note", "Priced at $9 and written in your voice, not a generic template."],
      ["neither said this", "A prerender step first — your SPA serves an empty shell to every crawler these tactics target."],
    ],
    diagram: "routes",
  },
  {
    id: "tenancy",
    label: "A founder explaining their setup",
    source: "podcast · 51 min · transcribed",
    said: [
      "Every customer gets their own deployment, provisioned by hand.",
      "Isolation is the selling point; nobody shares a database.",
      "Onboarding costs them two days of engineering time.",
    ],
    note: "same idea but multi-tenant, and provisioning has to be automatic",
    title: "A control plane they explicitly said they don't have",
    summary:
      "They described the single-tenant version because that's what they built. Your note turns it into a platform, which creates problems the podcast never had to answer.",
    parts: [
      ["from the podcast", "Per-customer isolation as the product promise, not an implementation detail."],
      ["from your note", "One database, row-level isolation, tenant id on every path."],
      ["neither said this", "Provisioning as an API call, so onboarding is a signup rather than two engineer-days."],
      ["neither said this", "Per-tenant quotas and noisy-neighbour limits, which only exist once tenants share anything."],
    ],
    diagram: "tenancy",
  },
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
    tag: "#llm-optimization",
    n: 16,
    color: "#63e6a0",
    kind: "a missed opportunity",
    items: [
      "Aggressive SEO tactics for LLMs and CTR",
      "The Reddit keyword hack",
      "URLs and titles for fan-out queries",
      "How to rank in AI search results",
      "AEO analytics and visibility tracking",
    ],
    build:
      "A complete answer-engine program: interceptor routes built on the tactics, structured for fan-out, ranked against the model, measured by the analytics node.",
    why: "Tactics, mechanism, ranking model and measurement — saved weeks apart by you, never once looked at together.",
  },
  {
    tag: "#open-source",
    n: 14,
    color: "#4dc9ff",
    kind: "infrastructure",
    items: [
      "Replacing paid scrapers with Crawl4AI",
      "LLM-ready markdown locally",
      "Self-hosted embeddings",
      "Local vector store benchmarks",
      "Agent skills, open weights",
    ],
    build:
      "Your own ingest pipeline — scrape, convert, embed and store locally, with zero per-page API fees.",
    why: "Five people each solving one slice. Together they are the whole pipeline, and you already hold every piece.",
  },
  {
    tag: "#claude-code",
    n: 19,
    color: "#b18cff",
    kind: "a solution",
    items: [
      "Scaling context without losing the thread",
      "Building a 2026 agentic OS",
      "Multimodal video pipelines",
      "Agent skills that compose",
      "The kernel: rigorous engineering",
    ],
    build:
      "A personal agent OS: your own skills, composed, running against your own material instead of a marketplace of downloads.",
    why: "Nineteen captures about agents you never revisited. The through-line is that you keep saving other people's setups instead of building one.",
  },
  {
    tag: "#ai-agents",
    n: 12,
    color: "#ff6f9c",
    kind: "a business",
    items: [
      "Social agent swarms",
      "Marketing automation stacks",
      "Lead magnet mining",
      "Understanding anything",
      "Omni drone control",
    ],
    build:
      "One agent that watches your feeds, drafts the work, and files what it learns back into the thing it came from.",
    why: "Twelve separate automations. Chained, they are a loop that feeds itself, which is the part none of the twelve mention.",
  },
];

/* ------------------------------ drift field ------------------------------ */

type Drop = { text: string; w: number; h: number; x: number; dx: number; y: number; v: number; a: number; wob: number };

const DriftField = ({ onCatch, onLost }: { onCatch: (text: string) => void; onLost: (n: number) => void }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = REDUCED();
    let w = 0;
    let h = 0;
    let raf = 0;
    let seed = 0;
    let lostCount = 0;
    const bubbles: Drop[] = [];

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
        if (b.y < h * 0.34 && !reduced) b.a = Math.max(0, b.a - 0.004);
        if (b.a <= 0 || b.y < -40) {
          bubbles.splice(i, 1);
          lostCount++;
          onLost(lostCount);
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
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", size);
    };
  }, [onCatch, onLost]);

  return <canvas id="drift" ref={ref} aria-label="Ideas drifting away — click one to catch it" />;
};

/* ------------------------------ diagrams ------------------------------ */

const MONO = "IBM Plex Mono, monospace";

const LoopsDiagram = () => (
  <svg className="mut-diagram" viewBox="0 0 460 210" role="img" aria-label="A builder loop wrapped by a critic loop, with a disagreement protocol and arbitration">
    <defs>
      <marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 z" fill="#6e7f78" />
      </marker>
    </defs>
    <ellipse cx="150" cy="108" rx="94" ry="58" fill="none" stroke="#f2a53c" strokeWidth="1.2" />
    <ellipse cx="150" cy="108" rx="128" ry="84" fill="none" stroke="#63e6a0" strokeWidth="1.2" strokeDasharray="5 5" />
    {([
      [150, 56, "observe"],
      [220, 108, "act"],
      [150, 160, "check"],
      [80, 108, "repeat"],
    ] as [number, number, string][]).map(([x, y, label]) => (
      <g key={label}>
        <circle cx={x} cy={y} r="4.5" fill="#f2a53c" />
        <text x={x} y={y - 10} textAnchor="middle" fill="#b9c6c0" fontSize="10" fontFamily={MONO}>{label}</text>
      </g>
    ))}
    <text x="150" y="112" textAnchor="middle" fill="#6e7f78" fontSize="10" fontFamily={MONO}>builder loop</text>
    <text x="150" y="18" textAnchor="middle" fill="#63e6a0" fontSize="10" fontFamily={MONO}>critic loop · from your note</text>
    <line x1="280" y1="108" x2="328" y2="108" stroke="#6e7f78" strokeWidth="1" markerEnd="url(#ar)" />
    <rect x="332" y="64" width="116" height="34" fill="none" stroke="#f2a53c" strokeWidth="1" />
    <text x="390" y="85" textAnchor="middle" fill="#f2a53c" fontSize="10" fontFamily={MONO}>disagreement</text>
    <rect x="332" y="118" width="116" height="34" fill="none" stroke="#63e6a0" strokeWidth="1" />
    <text x="390" y="139" textAnchor="middle" fill="#63e6a0" fontSize="10" fontFamily={MONO}>arbitration → you</text>
    <text x="390" y="172" textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>neither of these was said</text>
  </svg>
);

const RoutesDiagram = () => (
  <svg className="mut-diagram" viewBox="0 0 460 210" role="img" aria-label="A prerender step feeding ten static interceptor routes">
    <rect x="14" y="86" width="102" height="44" fill="none" stroke="#63e6a0" strokeWidth="1.2" />
    <text x="65" y="105" textAnchor="middle" fill="#63e6a0" fontSize="10" fontFamily={MONO}>prerender</text>
    <text x="65" y="119" textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>not in the reel</text>
    {["/cheapest-ai-second-brain-reddit", "/fart-brains-reviews-reddit", "/affordable-app-reviews-youtube", "/is-it-worth-it-quora", "/budget-note-app-linkedin"].map((slug, i) => (
      <g key={slug}>
        <line x1="116" y1="108" x2="192" y2={30 + i * 37} stroke="#f2a53c" strokeWidth="0.9" opacity="0.45" />
        <rect x="192" y={18 + i * 37} width="252" height="24" fill="none" stroke="#f2a53c" strokeWidth="0.9" />
        <text x="202" y={34 + i * 37} fill="#b9c6c0" fontSize="10" fontFamily={MONO}>{slug}</text>
      </g>
    ))}
    <text x="230" y="202" textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>+ 5 more · platform name last, every time</text>
  </svg>
);

const TenancyDiagram = () => (
  <svg className="mut-diagram" viewBox="0 0 460 210" role="img" aria-label="One control plane provisioning four isolated tenants">
    <rect x="150" y="16" width="164" height="36" fill="none" stroke="#63e6a0" strokeWidth="1.2" />
    <text x="232" y="38" textAnchor="middle" fill="#63e6a0" fontSize="10" fontFamily={MONO}>control plane · provision()</text>
    {Array.from({ length: 4 }, (_, i) => (
      <g key={i}>
        <line x1="232" y1="52" x2={70 + i * 108} y2="98" stroke="#6e7f78" strokeWidth="0.9" opacity="0.55" />
        <rect x={22 + i * 108} y="98" width="96" height="62" fill="none" stroke="#f2a53c" strokeWidth="1" />
        <text x={70 + i * 108} y="124" textAnchor="middle" fill="#b9c6c0" fontSize="10" fontFamily={MONO}>tenant {i + 1}</text>
        <text x={70 + i * 108} y="140" textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>quota · rls</text>
      </g>
    ))}
    <text x="230" y="188" textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>one database · row-level isolation · noisy-neighbour limits</text>
  </svg>
);

/* ----------------------------- the mutation ----------------------------- */

const MutationPanel = () => {
  const [active, setActive] = useState(0);
  const m = MUTATIONS[active];
  const [note, setNote] = useState(m.note);

  useEffect(() => {
    setNote(MUTATIONS[active].note);
  }, [active]);

  // The note is the only line the source could never contain, so edits to it
  // are what the output attributes back to you.
  const parts = useMemo(
    () =>
      m.parts.map(([tag, text]) =>
        tag === "from your note" ? (["from your note", note.trim() || "—"] as [string, string]) : ([tag, text] as [string, string]),
      ),
    [note, m],
  );

  return (
    <>
      <div className="mut-tabs" role="tablist" aria-label="Sources">
        {MUTATIONS.map((x, i) => (
          <button key={x.id} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="mut">
        <div className="mut-noterow">
          <span className="caret">✱</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="What you want instead" />
        </div>
        <div className="mut-grid">
          <div className="mut-left">
            <p className="mut-src">{m.source}</p>
            <p className="mini-label">what they described</p>
            <ul className="mut-said">
              {m.said.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="mut-right">
            <span className="mut-never">nobody ships this</span>
            <div className="mut-out">
              <h3>{m.title}</h3>
              <p>{m.summary}</p>
            </div>
            {m.diagram === "loops" && <LoopsDiagram />}
            {m.diagram === "routes" && <RoutesDiagram />}
            {m.diagram === "tenancy" && <TenancyDiagram />}
            <div className="mut-parts">
              {parts.map(([tag, text], i) => (
                <div className="mut-part" key={`${tag}-${i}`}>
                  <b>{tag}</b>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
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

    const nodes: CNode[] = CLUSTERS.flatMap((cl, ci) =>
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
      <canvas id="constellation" ref={ref} aria-label="Your saved material, grouped into clusters" />
      <div className="cluster-tabs" role="tablist">
        {CLUSTERS.map((c, i) => (
          <button key={c.tag} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}>
            {c.tag} · {c.n}
          </button>
        ))}
      </div>
      <div className="cluster-card">
        <div className="cc-head">
          <span className="cc-dot" style={{ background: cl.color }} />
          <span>{cl.tag} · {cl.n} saves</span>
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

/* ------------------------------- the loop ------------------------------- */

const LoopDiagram = () => (
  <svg className="loop-svg" viewBox="0 0 640 250" role="img" aria-label="Capture, brief, build, write-back, repeat">
    <defs>
      <marker id="lar" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 z" fill="#f2a53c" />
      </marker>
      <marker id="lgr" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 z" fill="#63e6a0" />
      </marker>
    </defs>
    {([
      [90, 66, "capture", "the reel you scrolled past"],
      [420, 66, "brief", "mechanism + your note"],
      [420, 178, "build", "your agent, your repo"],
      [90, 178, "write-back", "what it built, decided"],
    ] as [number, number, string, string][]).map(([x, y, label, sub]) => (
      <g key={label}>
        <rect x={x - 84} y={y - 26} width="168" height="52" fill="none" stroke="#f2a53c" strokeWidth="1.2" />
        <text x={x} y={y - 3} textAnchor="middle" fill="#d9e2dd" fontSize="13" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600">{label}</text>
        <text x={x} y={y + 14} textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>{sub}</text>
      </g>
    ))}
    <line x1="176" y1="66" x2="330" y2="66" stroke="#f2a53c" strokeWidth="1" markerEnd="url(#lar)" />
    <line x1="420" y1="92" x2="420" y2="146" stroke="#f2a53c" strokeWidth="1" markerEnd="url(#lar)" />
    <line x1="334" y1="178" x2="180" y2="178" stroke="#f2a53c" strokeWidth="1" markerEnd="url(#lar)" />
    <line x1="90" y1="152" x2="90" y2="98" stroke="#63e6a0" strokeWidth="1" strokeDasharray="4 4" markerEnd="url(#lgr)" />
    <text x="255" y="52" textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>seconds</text>
    <text x="255" y="196" textAnchor="middle" fill="#6e7f78" fontSize="9" fontFamily={MONO}>your repo, your keys</text>
    <text x="320" y="234" textAnchor="middle" fill="#63e6a0" fontSize="11" fontFamily={MONO}>every trip round makes the next brief sharper</text>
  </svg>
);

/* ------------------------- feature catalogue ------------------------- */

type Viz =
  | "drop" | "wall" | "wave" | "distill" | "tags" | "links" | "cite"
  | "cluster" | "merge" | "cycle" | "bell" | "shield" | "hub" | "cal" | "check";

/** Small looping SVGs, one per kind of thing the product does. */
const MicroViz = ({ kind }: { kind: Viz }) => {
  switch (kind) {
    case "drop":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <rect x="30" y="46" width="60" height="12" rx="2" className="viz-slot" />
          {[0, 1, 2].map((i) => (
            <rect key={i} className={`viz-drop d${i}`} x={38 + i * 18} y="4" width="14" height="10" rx="2" />
          ))}
        </svg>
      );
    case "wall":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <line x1="60" y1="6" x2="60" y2="58" className="viz-wall" />
          <circle className="viz-blocked" cx="20" cy="22" r="5" />
          <circle className="viz-through" cx="20" cy="44" r="5" />
          <text x="86" y="26" className="viz-t err">×</text>
          <text x="86" y="48" className="viz-t ok">✓</text>
        </svg>
      );
    case "wave":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} className={`viz-bar b${i % 5}`} x={8 + i * 7} y="20" width="3" height="24" rx="1.5" />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={i} className={`viz-line l${i}`} x="78" y={20 + i * 10} width="34" height="3" rx="1.5" />
          ))}
        </svg>
      );
    case "distill":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} className="viz-long" x="8" y={8 + i * 8} width="44" height="3" rx="1.5" />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={i} className={`viz-short s${i}`} x="70" y={20 + i * 10} width="42" height="4" rx="2" />
          ))}
        </svg>
      );
    case "tags":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <rect x="8" y="22" width="42" height="20" rx="2" className="viz-slot" />
          {[0, 1, 2].map((i) => (
            <rect key={i} className={`viz-tag t${i}`} x={60} y={12 + i * 16} width="52" height="12" rx="6" />
          ))}
        </svg>
      );
    case "links":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <circle cx="18" cy="32" r="6" className="viz-node hot" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <line className={`viz-edge e${i}`} x1="24" y1="32" x2="96" y2={14 + i * 18} />
              <circle className={`viz-node n${i}`} cx="102" cy={14 + i * 18} r="4.5" />
            </g>
          ))}
        </svg>
      );
    case "cite":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect className={`viz-src c${i}`} x="8" y={10 + i * 16} width="56" height="10" rx="2" />
              <text className={`viz-t cite c${i}`} x="70" y={19 + i * 16}>[{i + 1}]</text>
            </g>
          ))}
          <rect className="viz-short s2" x="86" y="26" width="26" height="4" rx="2" />
        </svg>
      );
    case "cluster":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          {[[22, 14], [98, 18], [16, 48], [104, 46], [60, 8], [58, 56]].map(([x, y], i) => (
            <circle key={i} className={`viz-pull p${i}`} cx={x} cy={y} r="4" style={{ ["--tx" as string]: `${60 - x}px`, ["--ty" as string]: `${32 - y}px` }} />
          ))}
          <circle cx="60" cy="32" r="9" className="viz-core" />
        </svg>
      );
    case "merge":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <path className="viz-flow f0" d="M6 18 C 40 18, 44 32, 70 32" />
          <path className="viz-flow f1" d="M6 46 C 40 46, 44 32, 70 32" />
          <circle cx="8" cy="18" r="4" className="viz-node" />
          <circle cx="8" cy="46" r="4" className="viz-node hot" />
          <rect x="74" y="22" width="38" height="20" rx="2" className="viz-new" />
        </svg>
      );
    case "cycle":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <circle cx="60" cy="32" r="22" className="viz-ring" />
          <circle className="viz-orbit" r="4" cx="60" cy="10" />
          {[[60, 8], [82, 32], [60, 56], [38, 32]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" className="viz-node dim" />
          ))}
        </svg>
      );
    case "bell":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <circle cx="60" cy="32" r="10" className="viz-core" />
          {[0, 1, 2].map((i) => (
            <circle key={i} className={`viz-ping g${i}`} cx="60" cy="32" r="10" />
          ))}
        </svg>
      );
    case "shield":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <path className="viz-shield" d="M60 8 L84 18 V34 C84 46 72 54 60 58 C48 54 36 46 36 34 V18 Z" />
          <rect className="viz-lock" x="54" y="28" width="12" height="10" rx="2" />
          <path className="viz-lock-arc" d="M56 28 V24 a4 4 0 0 1 8 0 V28" />
        </svg>
      );
    case "hub":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <rect x="6" y="24" width="34" height="16" rx="2" className="viz-new" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line className={`viz-edge e${i % 3}`} x1="40" y1="32" x2="92" y2={10 + i * 15} />
              <rect className="viz-node-box" x="92" y={4 + i * 15} width="22" height="12" rx="2" />
            </g>
          ))}
        </svg>
      );
    case "cal":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          <rect x="18" y="10" width="84" height="46" rx="3" className="viz-slot" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} className={`viz-cell ${[3, 7].includes(i) ? "on" : ""}`} x={24 + (i % 4) * 20} y={18 + Math.floor(i / 4) * 13} width="14" height="9" rx="1.5" />
          ))}
        </svg>
      );
    case "check":
      return (
        <svg className="viz" viewBox="0 0 120 64" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="18" y={12 + i * 16} width="10" height="10" rx="2" className="viz-box" />
              <rect x="34" y={15 + i * 16} width="62" height="4" rx="2" className="viz-long" />
              <path className={`viz-tick k${i}`} d={`M20 ${17 + i * 16} l3 3 l5 -6`} />
            </g>
          ))}
        </svg>
      );
    default:
      return null;
  }
};

type Feature = { name: string; does: string; viz: Viz };
type Group = { id: string; title: string; blurb: string; items: Feature[] };

const CATALOGUE: Group[] = [
  {
    id: "in",
    title: "Getting it in",
    blurb: "The material is worthless if capturing it costs you anything at all.",
    items: [
      { name: "Share sheet", does: "Hit share on a reel, a post, a page — from any app on your phone.", viz: "drop" },
      { name: "Locked platforms", does: "Instagram, TikTok and YouTube get transcribed from the link alone.", viz: "wall" },
      { name: "Voice capture", does: "Hold the mic, talk, get it back written down.", viz: "wave" },
      { name: "Paste anything", does: "A URL, a transcript, a wall of text, a half sentence.", viz: "drop" },
      { name: "Duplicate check", does: "Tells you when you've saved that link before.", viz: "check" },
      { name: "Desktop jot pad", does: "A synced scratchpad beside the app on desktop.", viz: "check" },
    ],
  },
  {
    id: "usable",
    title: "Making it usable",
    blurb: "A transcript is not knowledge. The processing is what makes it worth keeping.",
    items: [
      { name: "Summary", does: "TL;DR, key points and the source's actual claims.", viz: "distill" },
      { name: "Action items", does: "What they DID, pulled out as imperatives, separate from the summary.", viz: "check" },
      { name: "Auto-tags and folder", does: "Tagged and filed on arrival, with a reason and a confidence.", viz: "tags" },
      { name: "References", does: "Every link, tool and citation they mentioned, extracted.", viz: "links" },
      { name: "Scrape a URL", does: "Pull any page's readable content into the item.", viz: "drop" },
      { name: "House rules", does: "Your own instructions, followed by every summary and prompt.", viz: "distill" },
    ],
  },
  {
    id: "connect",
    title: "Making it connect",
    blurb: "One save is a note. Sixteen related saves are a plan you never wrote.",
    items: [
      { name: "Related nodes", does: "Surfaces the saves that belong with this one, each with its reason.", viz: "links" },
      { name: "Clusters", does: "Tags gather into dense groups as the library grows.", viz: "cluster" },
      { name: "Cross-pollination", does: "Points at the older idea that belongs with the new one.", viz: "merge" },
      { name: "The graph", does: "The whole library as a map you can pan and isolate.", viz: "cluster" },
      { name: "Deep research", does: "Real web search and scrape, synthesized into a cited report on the item.", viz: "cite" },
      { name: "Ask anything", does: "Chat with your own library; answers carry their sources.", viz: "hub" },
    ],
  },
  {
    id: "build",
    title: "Turning it into something",
    blurb: "This is the part nobody else does. The rest of the market stops at storage.",
    items: [
      { name: "The prompt", does: "Summary, actions, references, research and your note, compiled into one brief.", viz: "merge" },
      { name: "Your note is primary", does: "What you wanted when you saved it leads the brief.", viz: "merge" },
      { name: "Build mode", does: "Written for a coding agent with your stack and your existing material in view.", viz: "cycle" },
      { name: "Refresh prompt", does: "Regenerate after research, chat or new saves land.", viz: "cycle" },
      { name: "Prompt studio", does: "Generate and optimize prompts, with suggested rules.", viz: "distill" },
      { name: "Do-not list", does: "Every brief names what would be unsafe, expensive or wrong to install.", viz: "shield" },
    ],
  },
  {
    id: "attach",
    title: "Attaching it to your work",
    blurb: "One endpoint, read and write, so the brief lands where the building happens.",
    items: [
      { name: "MCP or REST", does: "21 tools on one endpoint. No client library, no plugin, nothing installed.", viz: "hub" },
      { name: "Your agent builds", does: "It runs on your filesystem, in your project, with your keys.", viz: "cycle" },
      { name: "Write-back", does: "What got built and decided comes home as new material.", viz: "cycle" },
      { name: "Recall context", does: "Your agent pulls related saves mid-build.", viz: "links" },
    ],
  },
  {
    id: "keep",
    title: "Keeping it yours",
    blurb: "One account is one private brain. No feed, no team, no algorithm.",
    items: [
      { name: "Reminders", does: "Alarms, push and email on any item.", viz: "bell" },
      { name: "Calendar and gifts", does: "Dated items, events, and gift lists with links and prices.", viz: "cal" },
      { name: "Projects and to-dos", does: "Boards, priorities, and the tasks an idea turned into.", viz: "check" },
      { name: "Share exactly one", does: "A revocable read-only link to a single item.", viz: "shield" },
      { name: "Trash and restore", does: "Soft delete with 30-day retention.", viz: "shield" },
      { name: "Export and delete", does: "JSON or Markdown out; account deletion behind re-auth.", viz: "shield" },
      { name: "Passcode lock", does: "A device passcode over the app.", viz: "shield" },
      { name: "Desktop and install", does: "A Windows build and an installable app.", viz: "drop" },
    ],
  },
];

type UseCase = { who: string; saw: string; note: string; got: string; viz: Viz };

const USE_CASES: UseCase[] = [
  {
    who: "Marketer",
    saw: "A 47-second reel on intercepting LLM searches",
    note: "but for our site, and it has to survive our stack",
    got: "Ten interceptor routes, the metadata templates, and the prerender step the reel never mentioned.",
    viz: "merge",
  },
  {
    who: "Founder",
    saw: "A podcast on running single-tenant deployments",
    note: "same idea but multi-tenant, provisioning automatic",
    got: "A control plane, row-level isolation, per-tenant quotas — a platform out of a story about hand-provisioning.",
    viz: "hub",
  },
  {
    who: "Engineer",
    saw: "A talk on how agents use hooks and loops",
    note: "plus a second loop that challenges the first one's ideas",
    got: "A self-critiquing architecture with a disagreement protocol and an arbitration path.",
    viz: "cycle",
  },
  {
    who: "Creator",
    saw: "Someone's LinkedIn post pipeline",
    note: "but for Instagram and Facebook, in my voice",
    got: "Your own scheduler, platform-native formats, voice trained on your last thirty posts.",
    viz: "merge",
  },
  {
    who: "Anyone",
    saw: "A stranger recommending an MCP server",
    note: "I only want the one function it has",
    got: "Your own hundred-line version, in your project, with none of the supply chain.",
    viz: "shield",
  },
  {
    who: "Operator",
    saw: "Sixteen things saved months apart",
    note: "(no note — the pile did this on its own)",
    got: "The program those sixteen add up to, scaffolded, with the gap between them named.",
    viz: "cluster",
  },
];

const Catalogue = () => (
  <>
    {CATALOGUE.map((g) => (
      <div className="cat-group" key={g.id}>
        <div className="cat-head">
          <h3>{g.title}</h3>
          <p>{g.blurb}</p>
        </div>
        <div className="cat-grid">
          {g.items.map((f) => (
            <article className="cat-card" key={f.name}>
              <MicroViz kind={f.viz} />
              <h4>{f.name}</h4>
              <p className="cat-does">{f.does}</p>
            </article>
          ))}
        </div>
      </div>
    ))}
  </>
);

const UseCases = () => (
  <div className="uc-grid">
    {USE_CASES.map((u) => (
      <article className="uc-card" key={u.who + u.saw}>
        <div className="uc-top">
          <MicroViz kind={u.viz} />
          <span className="uc-who">{u.who}</span>
        </div>
        <p className="uc-saw">{u.saw}</p>
        <p className="uc-note">✱ {u.note}</p>
        <p className="uc-got">{u.got}</p>
      </article>
    ))}
  </div>
);

/* --------------------------------- page --------------------------------- */

const Landing = ({ onEnter }: { onEnter?: () => void }) => {
  const [scrolled, setScrolled] = useState(false);
  const [lost, setLost] = useState(0);

  const onCatch = useCallback(() => {
    document.getElementById("mutation")?.scrollIntoView({
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
    // route-wide is the app's own opt-out of the phone-frame shell (see
    // index.css); fb-landing unlocks the scroll lock the shell also applies.
    document.documentElement.classList.add("fb-landing", "route-wide");
    return () => {
      setLandingActive(false);
      document.documentElement.classList.remove("fb-landing", "route-wide");
    };
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Fart Brains — the tools you need aren't for sale";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      <nav className={`nav ${scrolled ? "is-stuck" : ""}`}>
        <div className="wrap nav-in">
          <span className="brand">
            <i />
            Fart Brains
          </span>
          <div className="nav-links label">
            <a href="#mutation">the mutation</a>
            <a href="#wall">the wall</a>
            <a href="#clusters">clusters</a>
            <a href="#loop">the loop</a>
            <a href="#everything">everything</a><a href="#pricing">pricing</a>
          </div>
          <button type="button" className="btn sm" onClick={onEnter}>
            Start free
          </button>
        </div>
      </nav>

      <header className="hero">
        <DriftField onCatch={onCatch} onLost={setLost} />
        <div className="wrap hero-in">
          <p className="label">
            <span className="on">●</span> every play you scrolled past is still gone
          </p>
          <h1>
            The tools you actually need <span className="amber">aren't for sale.</span>
          </h1>
          <p className="lede">
            Somebody explains exactly how they did it — the strategy, the order, the reason it works. It's a
            47-second reel or a 22-minute talk, and by Thursday it's gone. There's no product to buy that does
            what they described. Fart Brains catches it, and one line from you turns it into something that
            has never existed.
          </p>
          <p className="hero-note">✱ "I want this, but with multi-tenancy and automated provisioning."</p>
          <div className="hero-cta">
            <button type="button" className="btn" onClick={onEnter}>
              Start free
            </button>
            <a className="btn ghost" href="#mutation">
              See what that makes
            </a>
          </div>
          <div className="hud">
            <span>gone while you read this <b>{lost}</b></span>
            <span>you'll never know which <b>—</b></span>
          </div>
          <p className="hint">↑ nobody counts these. that's what a brain fart is.</p>
        </div>
      </header>

      <section id="mutation">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">01 / the mutation</p>
            <h2>Their mechanism. Your one line. Something that didn't exist.</h2>
            <p>
              The source gives you a mechanism that already works, explained by the person who ran it. Your
              note is the mutation — the part they never said, because they weren't building your thing. Edit
              the note and watch what gets attributed to you.
            </p>
          </div>
          <MutationPanel />
        </div>
      </section>

      <section id="wall">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">02 / the wall</p>
            <h2>Your AI can't open the reel. You can.</h2>
            <p>
              The plays live on platforms that don't let agents in. Hand that link to any assistant and it
              hits a wall. Hit share on your phone and it's already inside — transcribed, tagged and filed
              before the screen locks.
            </p>
          </div>
          <div className="wall">
            <div className="wall-col">
              <p className="mini-label">an agent, given the link</p>
              <pre className="wall-term">
{"$ fetch https://instagram.com/p/…\n"}
<span className="err">{"net::ERR_CONNECTION_RESET"}</span>
{"\n$ curl -sL https://instagram.com/p/…\n"}
<span className="dim">{"621 KB of JavaScript shell\nno caption, no transcript, no og tags"}</span>
              </pre>
              <p className="cc-why">That's a real attempt, not an illustration.</p>
            </div>
            <div className="wall-col">
              <p className="mini-label out-label">you, hitting share</p>
              <pre className="wall-term">
{"share sheet → Fart Brains\n"}
<span className="ok">{"✓ transcribed        2.1s\n✓ action items       3\n✓ references         2 followed\n✓ filed              #llm-optimization"}</span>
{"\n"}
<span className="dim">{"done before the screen locked"}</span>
              </pre>
              <p className="cc-why">Anyone can summarize a web page. Almost nobody can get in here.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="clusters">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">03 / the clusters</p>
            <h2>It connected the dots and built the scaffolding.</h2>
            <p>
              Sixteen things you saved months apart, sitting next to each other. It reads across them, finds
              the through-line, and stands up the infrastructure — a business, a solution, or the opportunity
              you already walked past once. Not a reading list. The thing, scaffolded.
            </p>
          </div>
          <ClusterField />
        </div>
      </section>

      <section id="loop">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">04 / the loop</p>
            <h2>Your agent builds it, then tells the brain what it did.</h2>
            <p>
              The brief goes to whatever you already work in, over MCP or plain REST. Your agent builds
              against its own filesystem — we never touch it — then writes back what it built and what it
              decided. That lands as new material, so the next brief never re-proposes what you already
              shipped.
            </p>
          </div>
          <div className="loop-wrap">
            <LoopDiagram />
            <div className="loop-legend">
              <div>
                <b>capture</b>
                <span>Share sheet, URL, voice or paste. Transcribed and filed on its own.</span>
              </div>
              <div>
                <b>brief</b>
                <span>What the source does, what to build, how it changes for your stack, how to verify.</span>
              </div>
              <div>
                <b>build</b>
                <span>Your agent, your repo, your keys. Nothing of ours on your machine.</span>
              </div>
              <div>
                <b>write-back</b>
                <span>What shipped comes home, so it learns from what you did, not just what you watched.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cases">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">05 / who this is for</p>
            <h2>Same move, different room.</h2>
            <p>
              Every one of these started as something somebody else explained, once, to nobody in
              particular. The line underneath is what the person actually walked away with.
            </p>
          </div>
          <UseCases />
        </div>
      </section>

      <section id="everything">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">06 / everything it does</p>
            <h2>What did they potentially lose?</h2>
            <p>
              Thirty-six answers to that question.
            </p>
          </div>
          <Catalogue />
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
                Saving a popular video usually costs nothing — cached and caption-based transcripts don't
                count against it.
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
              <span>Export to JSON or Markdown, or delete the account outright. Both are one click.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <h2>You can't miss what you can't remember.</h2>
          <button type="button" className="btn" onClick={onEnter}>
            Start free
          </button>
          <div className="foot">
            <span>fart brains</span>
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
  /* The page mounts inside the app shell, so the wrapper carries its own
     ground — otherwise the app's fixed aurora shows through everything. */
  .fb-root {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    overflow-x: hidden;
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
/* ---------- hero fusion canvas ---------- */
#fusion { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
.hero-note {
  margin: 26px 0 0; padding: 14px 16px; border-left: 2px solid var(--amber);
  background: rgba(242,165,60,.05); max-width: 52ch;
  font-family: "IBM Plex Mono", monospace; font-size: 13px; line-height: 1.6; color: var(--amber);
}

/* ---------- the mutation ---------- */
.mut-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.mut-tabs button {
  padding: 9px 15px; border: 1px solid var(--rule); font-size: 13px; color: var(--dim);
  background: rgba(255,255,255,.015); transition: color .2s, border-color .2s, background .2s;
}
.mut-tabs button:hover { color: var(--ink); }
.mut-tabs button[aria-selected="true"] { background: var(--amber); border-color: var(--amber); color: #10130f; font-weight: 600; }
.mut { border: 1px solid var(--rule); background: var(--panel); }
.mut-grid { display: grid; grid-template-columns: 1fr; }
@media (min-width: 940px) { .mut-grid { grid-template-columns: minmax(0,.85fr) minmax(0,1.15fr); } }
.mut-left { padding: 20px; border-bottom: 1px solid var(--rule); }
@media (min-width: 940px) { .mut-left { border-bottom: 0; border-right: 1px solid var(--rule); } }
.mut-src { font-family: "IBM Plex Mono", monospace; font-size: 11.5px; color: var(--dim); margin: 0 0 12px; }
.mut-said { margin: 0; padding: 0; list-style: none; display: grid; gap: 9px; }
.mut-said li { padding-left: 20px; position: relative; font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
.mut-said li::before { content: "·"; position: absolute; left: 6px; color: var(--dim); }
.mut-noterow { display: flex; align-items: center; gap: 10px; padding: 13px 16px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); background: rgba(242,165,60,.05); }
.mut-noterow .caret { color: var(--amber); font-family: "IBM Plex Mono", monospace; }
.mut-noterow input {
  flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--amber);
  font-family: "IBM Plex Mono", monospace; font-size: 13.5px;
}
.mut-right { padding: 20px; display: grid; gap: 14px; align-content: start; }
.mut-out h3 { margin: 0 0 6px; font-size: 19px; letter-spacing: -0.02em; }
.mut-out p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--ink-2); }
.mut-never {
  display: inline-flex; align-items: center; gap: 8px; align-self: start;
  font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--green); border: 1px solid rgba(99,230,160,.4); padding: 4px 10px;
}
.mut-diagram { width: 100%; height: auto; display: block; background: var(--panel-2); border: 1px solid var(--rule); }
.mut-parts { display: grid; gap: 7px; }
.mut-part { display: grid; grid-template-columns: 118px 1fr; gap: 12px; font-size: 12.5px; line-height: 1.5; }
@media (max-width: 620px) { .mut-part { grid-template-columns: 1fr; gap: 2px; } }
.mut-part b { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber); font-weight: 500; }
.mut-part span { color: var(--ink-2); }

/* ---------- the wall ---------- */
.wall { display: grid; gap: 1px; background: var(--rule-2); border: 1px solid var(--rule); grid-template-columns: 1fr; }
@media (min-width: 820px) { .wall { grid-template-columns: 1fr 1fr; } }
.wall-col { background: var(--bg); padding: 20px; display: grid; gap: 12px; align-content: start; }
.wall-term {
  font-family: "IBM Plex Mono", monospace; font-size: 12px; line-height: 1.7;
  background: var(--panel-2); border: 1px solid var(--rule); padding: 14px; white-space: pre-wrap; overflow-x: auto;
}
.wall-term .err { color: #e5624a; }
.wall-term .ok { color: var(--green); }
.wall-term .dim { color: var(--faint); }

/* ---------- the loop ---------- */
.loop-wrap { border: 1px solid var(--rule); background: var(--panel); padding: clamp(16px,3vw,28px); }
.loop-svg { width: 100%; height: auto; display: block; max-width: 720px; margin: 0 auto; }
.loop-legend { display: grid; gap: 10px; margin-top: 18px; grid-template-columns: 1fr; }
@media (min-width: 760px) { .loop-legend { grid-template-columns: repeat(4, 1fr); } }
.loop-legend div { display: grid; gap: 4px; }
.loop-legend b { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber); font-weight: 500; }
.loop-legend span { font-size: 12.5px; color: var(--dim); line-height: 1.5; }

/* ---------- micro visuals ---------- */
.viz { width: 120px; height: 64px; display: block; overflow: visible; }
.viz-slot { fill: none; stroke: rgba(217,226,221,.18); stroke-width: 1; }
.viz-long { fill: rgba(217,226,221,.16); }
.viz-short { fill: var(--amber); opacity: 0; animation: vShort 3.2s infinite; }
.viz-short.s1 { animation-delay: .25s; } .viz-short.s2 { animation-delay: .5s; }
@keyframes vShort { 0%,12% { opacity: 0; transform: translateX(-4px);} 30%,80% { opacity: 1; transform: none;} 100% { opacity: 0; } }
.viz-drop { fill: var(--amber); animation: vDrop 3s infinite ease-in; }
.viz-drop.d1 { animation-delay: .5s; } .viz-drop.d2 { animation-delay: 1s; }
@keyframes vDrop { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 55% { transform: translateY(36px); opacity: 1; } 70%,100% { transform: translateY(36px); opacity: 0; } }
.viz-wall { stroke: rgba(229,98,74,.75); stroke-width: 2; stroke-dasharray: 3 3; }
.viz-blocked { fill: #e5624a; animation: vBlock 3s infinite; }
@keyframes vBlock { 0% { transform: translateX(0);} 40% { transform: translateX(30px);} 55% { transform: translateX(24px);} 100% { transform: translateX(0);} }
.viz-through { fill: var(--green); animation: vThru 3s infinite; }
@keyframes vThru { 0% { transform: translateX(0); } 55%,100% { transform: translateX(72px); } }
.viz-t { font-family: "IBM Plex Mono", monospace; font-size: 12px; }
.viz-t.err { fill: #e5624a; } .viz-t.ok { fill: var(--green); }
.viz-t.cite { fill: var(--amber); font-size: 10px; }
.viz-bar { fill: var(--amber); opacity: .8; animation: vBar 1.1s infinite ease-in-out; transform-origin: center; }
.viz-bar.b1 { animation-delay: .1s; } .viz-bar.b2 { animation-delay: .2s; }
.viz-bar.b3 { animation-delay: .3s; } .viz-bar.b4 { animation-delay: .4s; }
@keyframes vBar { 0%,100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
.viz-line { fill: rgba(217,226,221,.5); opacity: 0; animation: vShort 3.2s infinite; }
.viz-line.l1 { animation-delay: .2s; } .viz-line.l2 { animation-delay: .4s; }
.viz-tag { fill: none; stroke: var(--amber); stroke-width: 1; opacity: 0; animation: vTag 3.4s infinite; }
.viz-tag.t1 { animation-delay: .3s; } .viz-tag.t2 { animation-delay: .6s; }
@keyframes vTag { 0% { opacity: 0; transform: translateX(10px);} 20%,85% { opacity: 1; transform: none;} 100% { opacity: 0; } }
.viz-node { fill: rgba(217,226,221,.45); }
.viz-node.hot { fill: var(--amber); }
.viz-node.dim { fill: rgba(242,165,60,.45); }
.viz-node-box { fill: none; stroke: rgba(217,226,221,.3); stroke-width: 1; }
.viz-edge { stroke: var(--amber); stroke-width: 1; stroke-dasharray: 80; stroke-dashoffset: 80; animation: vDraw 3s infinite; }
.viz-edge.e1 { animation-delay: .25s; } .viz-edge.e2 { animation-delay: .5s; }
@keyframes vDraw { 0% { stroke-dashoffset: 80; } 35%,85% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; opacity: 0; } }
.viz-src { fill: none; stroke: rgba(217,226,221,.25); stroke-width: 1; opacity: 0; animation: vTag 3.6s infinite; }
.viz-src.c1 { animation-delay: .3s; } .viz-src.c2 { animation-delay: .6s; }
.viz-t.cite.c1 { animation-delay: .3s; } .viz-t.cite.c2 { animation-delay: .6s; }
.viz-pull { fill: var(--amber); animation: vPull 3.6s infinite ease-in-out; }
.viz-pull.p1 { animation-delay: .12s; } .viz-pull.p2 { animation-delay: .24s; }
.viz-pull.p3 { animation-delay: .36s; } .viz-pull.p4 { animation-delay: .48s; } .viz-pull.p5 { animation-delay: .6s; }
@keyframes vPull { 0%,10% { transform: none; opacity: .5; } 55%,75% { transform: translate(var(--tx), var(--ty)); opacity: 1; } 100% { transform: none; opacity: .5; } }
.viz-core { fill: none; stroke: var(--green); stroke-width: 1.4; }
.viz-flow { fill: none; stroke: var(--amber); stroke-width: 1.2; stroke-dasharray: 90; stroke-dashoffset: 90; animation: vFlow 3s infinite; }
.viz-flow.f1 { stroke: var(--green); animation-delay: .3s; }
@keyframes vFlow { 0% { stroke-dashoffset: 90; } 45%,90% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; opacity: 0; } }
.viz-new { fill: none; stroke: var(--green); stroke-width: 1.2; opacity: 0; animation: vTag 3s infinite; animation-delay: .8s; }
.viz-ring { fill: none; stroke: rgba(242,165,60,.35); stroke-width: 1.2; }
.viz-orbit { fill: var(--green); animation: vOrbit 3.4s linear infinite; transform-origin: 60px 32px; }
@keyframes vOrbit { to { transform: rotate(360deg); } }
.viz-ping { fill: none; stroke: var(--amber); stroke-width: 1; opacity: 0; animation: vPing 2.6s infinite; }
.viz-ping.g1 { animation-delay: .5s; } .viz-ping.g2 { animation-delay: 1s; }
@keyframes vPing { 0% { transform: scale(1); opacity: .8; transform-origin: 60px 32px; } 100% { transform: scale(2.4); opacity: 0; transform-origin: 60px 32px; } }
.viz-shield { fill: none; stroke: var(--green); stroke-width: 1.3; stroke-dasharray: 180; stroke-dashoffset: 180; animation: vShield 3.4s infinite; }
@keyframes vShield { 0% { stroke-dashoffset: 180; } 40%,88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; opacity: .5; } }
.viz-lock, .viz-lock-arc { fill: none; stroke: rgba(217,226,221,.55); stroke-width: 1.2; }
.viz-cell { fill: rgba(217,226,221,.14); }
.viz-cell.on { fill: var(--amber); animation: vCell 2.6s infinite; }
@keyframes vCell { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
.viz-box { fill: none; stroke: rgba(217,226,221,.3); stroke-width: 1; }
.viz-tick { fill: none; stroke: var(--green); stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 14; stroke-dashoffset: 14; animation: vTick 3.4s infinite; }
.viz-tick.k1 { animation-delay: .35s; } .viz-tick.k2 { animation-delay: .7s; }
@keyframes vTick { 0%,10% { stroke-dashoffset: 14; } 28%,88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 14; } }

/* ---------- catalogue ---------- */
.cat-group { margin-top: clamp(34px, 5vw, 60px); }
.cat-head { border-top: 1px solid var(--rule); padding-top: 18px; margin-bottom: 20px; }
.cat-head h3 { margin: 0 0 6px; font-size: clamp(19px, 2.4vw, 24px); letter-spacing: -0.025em; }
.cat-head p { margin: 0; color: var(--dim); font-size: 14px; line-height: 1.5; max-width: 62ch; }
.cat-grid { display: grid; gap: 1px; background: var(--rule-2); border: 1px solid var(--rule); grid-template-columns: 1fr; }
@media (min-width: 680px) { .cat-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1040px) { .cat-grid { grid-template-columns: repeat(3, 1fr); } }
.cat-card { background: var(--bg); padding: 18px; display: grid; gap: 8px; align-content: start; }
.cat-card h4 { margin: 6px 0 0; font-size: 15.5px; letter-spacing: -0.01em; }
.cat-does { margin: 0; font-size: 13px; line-height: 1.5; color: var(--dim); }
.cat-lost {
  margin: 4px 0 0; padding-left: 12px; border-left: 2px solid rgba(229,98,74,.6);
  font-size: 13px; line-height: 1.5; color: var(--ink-2);
}

/* ---------- use cases ---------- */
.uc-grid { display: grid; gap: 1px; background: var(--rule-2); border: 1px solid var(--rule); grid-template-columns: 1fr; }
@media (min-width: 720px) { .uc-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1060px) { .uc-grid { grid-template-columns: repeat(3, 1fr); } }
.uc-card { background: var(--bg); padding: 20px; display: grid; gap: 9px; align-content: start; }
.uc-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.uc-who { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
.uc-saw { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.4; letter-spacing: -0.01em; }
.uc-note { margin: 0; font-family: "IBM Plex Mono", monospace; font-size: 12.5px; line-height: 1.5; color: var(--amber); }
.uc-got { margin: 2px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); padding-left: 12px; border-left: 2px solid rgba(99,230,160,.55); }
`;
