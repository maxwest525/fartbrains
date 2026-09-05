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

/* ------------------------------ drift field ------------------------------ *
 * Asme's hero runs a full-bleed video. This one runs a real three.js scene in
 * its place: the things you meant to keep, each a sprite drifting out of the
 * dark, past the camera and gone. Fog does the fading, so a phrase is legible
 * for a moment and then it is not. Click one and it takes you to what it would
 * have become; miss it and it counts against you.
 *
 * three is loaded dynamically — it is far heavier than the rest of the page,
 * and the hero copy must not wait on it.
 * -------------------------------------------------------------------------- */

const DRIFT_NEAR = 60;
const DRIFT_FAR = -640;

const DriftField = ({ onCatch, onLost }: { onCatch: (text: string) => void; onLost: (n: number) => void }) => {
  const holder = useRef<HTMLDivElement | null>(null);
  const onCatchRef = useRef(onCatch);
  const onLostRef = useRef(onLost);

  useEffect(() => {
    onCatchRef.current = onCatch;
    onLostRef.current = onLost;
  });

  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      const host = holder.current;
      if (cancelled || !host) return;

      const reduced = REDUCED();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      /* Each phrase is drawn once into a canvas and used as a sprite map, so the
       * type stays the page's type rather than becoming geometry. */
      const label = (text: string) => {
        const pad = 24;
        const size = 44;
        const c = document.createElement("canvas");
        const g = c.getContext("2d");
        if (!g) return null;
        g.font = `500 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
        const w = Math.ceil(g.measureText(text).width) + pad * 2;
        const h = size + pad * 2;
        c.width = w * dpr;
        c.height = h * dpr;
        g.scale(dpr, dpr);
        g.font = `500 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
        g.textBaseline = "middle";
        g.fillStyle = "rgba(255,255,255,.92)";
        g.fillText(text, pad, h / 2);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return { tex, w, h };
      };

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x000000, 120, 620);

      const camera = new THREE.PerspectiveCamera(58, 1, 1, 1200);
      camera.position.set(0, 0, DRIFT_NEAR + 40);

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(dpr);
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);

      type Drifter = { sprite: InstanceType<typeof THREE.Sprite>; text: string; v: number; spin: number };
      const drifters: Drifter[] = [];

      const place = (d: Drifter, far: boolean) => {
        d.sprite.position.set(
          (Math.random() - 0.5) * 620,
          (Math.random() - 0.5) * 300,
          far ? DRIFT_FAR + Math.random() * 120 : DRIFT_FAR + Math.random() * (DRIFT_NEAR - DRIFT_FAR),
        );
      };

      DRIFTING.forEach((text, i) => {
        // two passes, so the field has depth without inventing more copy
        for (let pass = 0; pass < 3; pass += 1) {
          const made = label(text);
          if (!made) return;
          const mat = new THREE.SpriteMaterial({
            map: made.tex,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            fog: true,
          });
          const sprite = new THREE.Sprite(mat);
          const scale = 0.16;
          sprite.scale.set(made.w * scale, made.h * scale, 1);
          sprite.userData.text = text;
          const d: Drifter = { sprite, text, v: 0.32 + Math.random() * 0.3, spin: i };
          place(d, false);
          scene.add(sprite);
          drifters.push(d);
        }
      });

      const size = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(host);

      const pointer = new THREE.Vector2();
      const aim = new THREE.Vector2();
      const ray = new THREE.Raycaster();
      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        aim.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      };
      const onClick = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObjects(drifters.map((d) => d.sprite))[0];
        if (hit) onCatchRef.current(String(hit.object.userData.text));
      };
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerdown", onClick);

      let lost = 0;
      let raf = 0;
      const tick = () => {
        for (const d of drifters) {
          d.sprite.position.z += d.v;
          if (d.sprite.position.z > DRIFT_NEAR) {
            place(d, true);
            lost += 1;
            onLostRef.current(lost);
          }
          // depth alone reads as flat, so each one sways a little as it comes
          d.sprite.position.x += Math.sin((performance.now() / 3000) + d.spin) * 0.05;
          // legible in the middle distance only: it surfaces, then it is gone
          // before it can crowd the headline
          const t = (d.sprite.position.z - DRIFT_FAR) / (DRIFT_NEAR - DRIFT_FAR);
          const mat = d.sprite.material as InstanceType<typeof THREE.SpriteMaterial>;
          mat.opacity = 0.42 * Math.min(1, t / 0.25) * Math.min(1, (1 - t) / 0.35);
        }
        // the field leans away from the pointer, which is what sells the depth
        pointer.lerp(aim, 0.04);
        camera.position.x = -pointer.x * 26;
        camera.position.y = -pointer.y * 14;
        camera.lookAt(0, 0, -220);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };

      if (reduced) {
        renderer.render(scene, camera);
      } else {
        raf = requestAnimationFrame(tick);
      }

      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerdown", onClick);
        drifters.forEach((d) => {
          const m = d.sprite.material as InstanceType<typeof THREE.SpriteMaterial>;
          m.map?.dispose();
          m.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return <div className="drift" ref={holder} aria-hidden />;
};

/* ------------------------------ diagrams ------------------------------ */

const MONO = "IBM Plex Mono, monospace";
const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";

/* Shared defs for the three mutation diagrams: one arrowhead per colour, the
 * soft fills the cards sit on, and the glow under an accented node. */
const DiagramDefs = () => (
  <defs>
    <marker id="mk-dim" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0.5,1 L6,3.5 L0.5,6" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </marker>
    <marker id="mk-green" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0.5,1 L6,3.5 L0.5,6" fill="none" stroke="#63e6a0" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </marker>
    <linearGradient id="fill-amber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(242,165,60,.07)" />
      <stop offset="100%" stopColor="rgba(242,165,60,.02)" />
    </linearGradient>
    <linearGradient id="fill-green" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(99,230,160,.14)" />
      <stop offset="100%" stopColor="rgba(99,230,160,.04)" />
    </linearGradient>
    <linearGradient id="fill-neutral" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(255,255,255,.07)" />
      <stop offset="100%" stopColor="rgba(255,255,255,.025)" />
    </linearGradient>
    <radialGradient id="node-glow">
      <stop offset="0%" stopColor="rgba(242,165,60,.55)" />
      <stop offset="100%" stopColor="rgba(242,165,60,0)" />
    </radialGradient>
  </defs>
);

type CardTone = "amber" | "green" | "neutral";

const TONE: Record<CardTone, { fill: string; stroke: string; ink: string }> = {
  amber: { fill: "url(#fill-amber)", stroke: "rgba(242,165,60,.55)", ink: "#f2a53c" },
  green: { fill: "url(#fill-green)", stroke: "rgba(99,230,160,.55)", ink: "#63e6a0" },
  neutral: { fill: "url(#fill-neutral)", stroke: "rgba(255,255,255,.16)", ink: "#ffffff" },
};

/** A rounded panel with a title and an optional second line, on the 8px grid. */
const DCard = ({
  x, y, w, h, tone = "neutral", title, sub, mono, rx = 10,
}: {
  x: number; y: number; w: number; h: number; tone?: CardTone;
  title: string; sub?: string; mono?: boolean; rx?: number;
}) => {
  const t = TONE[tone];
  const cx = x + w / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={t.fill} stroke={t.stroke} strokeWidth="1" />
      <text x={cx} y={sub ? y + h / 2 - 2 : y + h / 2 + 4} textAnchor="middle" fill={t.ink}
        fontSize="12" fontFamily={mono ? MONO : SANS} fontWeight="500">
        {title}
      </text>
      {sub ? (
        <text x={cx} y={y + h / 2 + 14} textAnchor="middle" fill="rgba(255,255,255,.45)"
          fontSize="11" fontFamily={SANS}>
          {sub}
        </text>
      ) : null}
    </g>
  );
};

/** Small caption set under a diagram, in the page's label voice. */
const DNote = ({ x, y, children, anchor = "middle" }: {
  x: number; y: number; children: string; anchor?: "start" | "middle" | "end";
}) => (
  <text x={x} y={y} textAnchor={anchor} fill="rgba(255,255,255,.38)" fontSize="11"
    fontFamily={SANS} letterSpacing=".02em">
    {children}
  </text>
);

/** A label riding on an edge, over a knocked-out plate so the line reads through. */
const DEdgeLabel = ({ x, y, children, w }: { x: number; y: number; children: string; w: number }) => (
  <g>
    <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={8} fill="#0a0a0a" />
    <text x={x} y={y + 3.5} textAnchor="middle" fill="rgba(255,255,255,.55)" fontSize="10"
      fontFamily={SANS}>
      {children}
    </text>
  </g>
);

const LoopsDiagram = () => {
  const cx = 138;
  const cy = 116;
  const nodes: [number, number, string][] = [
    [cx, cy - 52, "observe"],
    [cx + 76, cy, "act"],
    [cx, cy + 52, "check"],
    [cx - 76, cy, "repeat"],
  ];
  return (
    <svg className="mut-diagram" viewBox="0 0 480 232" role="img"
      aria-label="A builder loop wrapped by a critic loop that the note added, feeding a disagreement protocol and an arbitration step">
      <DiagramDefs />

      {/* the critic loop the note asked for — dashed, and it turns */}
      <ellipse className="dg-orbit" cx={cx} cy={cy} rx="108" ry="80" fill="none"
        stroke="rgba(99,230,160,.55)" strokeWidth="1.2" strokeDasharray="4 7" strokeLinecap="round" />
      {/* annotated from the corner, so the caption never crosses the ring */}
      <text x="8" y="16" fill="#63e6a0" fontSize="11" fontFamily={SANS} fontWeight="500">
        critic loop
      </text>
      <text x="8" y="30" fill="rgba(255,255,255,.4)" fontSize="10" fontFamily={SANS}>
        from your note
      </text>

      {/* the loop the talk described */}
      <ellipse cx={cx} cy={cy} rx="76" ry="52" fill="url(#fill-amber)"
        stroke="rgba(242,165,60,.5)" strokeWidth="1" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="11" fontFamily={SANS}>
        builder loop
      </text>

      {nodes.map(([x, y, label], i) => {
        // The top and bottom nodes take their label above; the side ones take
        // theirs outboard, so no label crosses the ring it sits on.
        const side = y === cy;
        const dx = side ? (x > cx ? 12 : -12) : 0;
        return (
          <g key={label}>
            <circle className="dg-pulse" style={{ animationDelay: `${i * 0.45}s` }} cx={x} cy={y} r="11" fill="url(#node-glow)" />
            <circle cx={x} cy={y} r="3.5" fill="#f2a53c" />
            <text x={x + dx} y={side ? y + 4 : y - 12} textAnchor={side ? (x > cx ? "start" : "end") : "middle"}
              fill="rgba(255,255,255,.72)" fontSize="11" fontFamily={SANS}>
              {label}
            </text>
          </g>
        );
      })}

      {/* what only exists once the two loops disagree */}
      <line x1="256" y1={cy} x2="302" y2={cy} stroke="rgba(255,255,255,.28)" strokeWidth="1"
        markerEnd="url(#mk-dim)" />
      <DEdgeLabel x={279} y={cy - 17} w={78}>they disagree</DEdgeLabel>

      <DCard x={312} y={62} w={152} h={44} tone="amber" title="disagreement protocol" sub="rounds · who wins · stop" />
      <DCard x={312} y={124} w={152} h={44} tone="green" title="arbitration" sub="escalates only on a repeat" />

      <DNote x={388} y={192}>neither of these was said</DNote>
    </svg>
  );
};

const ROUTES = [
  "/cheapest-ai-second-brain-reddit",
  "/fart-brains-reviews-reddit",
  "/affordable-app-reviews-youtube",
  "/is-it-worth-it-quora",
  "/budget-note-app-linkedin",
];

const RoutesDiagram = () => (
  <svg className="mut-diagram" viewBox="0 0 480 232" role="img"
    aria-label="A prerender step, which the reel never mentioned, serving ten static interceptor routes">
    <DiagramDefs />

    <DCard x={14} y={90} w={110} h={52} tone="green" title="prerender" sub="not in the reel" />

    {ROUTES.map((slug, i) => {
      const y = 30 + i * 34;
      // Pills hug their slug rather than all stretching to one width.
      const w = Math.round(28 + slug.length * 6.32);
      return (
        <g key={slug}>
          <path d={`M124,116 C160,116 160,${y + 12} 190,${y + 12}`} fill="none"
            stroke="rgba(242,165,60,.3)" strokeWidth="1" />
          <rect x="190" y={y} width={w} height="24" rx="12" fill="url(#fill-amber)"
            stroke="rgba(242,165,60,.4)" strokeWidth="1" />
          <text x="204" y={y + 16} fill="rgba(255,255,255,.8)" fontSize="11" fontFamily={MONO}>
            {slug}
          </text>
        </g>
      );
    })}

    <DNote x={69} y={162}>serves static HTML</DNote>
    <DNote x={240} y={216} anchor="start">+ 5 more · platform name last, every time</DNote>
  </svg>
);

const TenancyDiagram = () => (
  <svg className="mut-diagram" viewBox="0 0 480 232" role="img"
    aria-label="One control plane provisioning four isolated tenants over a single database">
    <DiagramDefs />

    <DCard x={164} y={20} w={152} h={46} tone="green" title="control plane" sub="provision()" />

    {Array.from({ length: 4 }, (_, i) => {
      const x = 16 + i * 116;
      const cx = x + 50;
      return (
        <g key={i}>
          <path d={`M240,66 C240,96 ${cx},96 ${cx},126`} fill="none"
            stroke="rgba(255,255,255,.2)" strokeWidth="1" markerEnd="url(#mk-dim)" />
          <rect x={x} y="126" width="100" height="62" rx="12" fill="url(#fill-amber)"
            stroke="rgba(242,165,60,.4)" strokeWidth="1" />
          <text x={cx} y="152" textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize="12"
            fontFamily={SANS} fontWeight="500">
            tenant {i + 1}
          </text>
          <rect x={cx - 34} y="160" width="68" height="18" rx="9" fill="rgba(0,0,0,.35)"
            stroke="rgba(242,165,60,.3)" strokeWidth="1" />
          <text x={cx} y="172.5" textAnchor="middle" fill="#f2a53c" fontSize="10" fontFamily={MONO}>
            quota · rls
          </text>
        </g>
      );
    })}

    <DEdgeLabel x={240} y={92} w={78}>provisions</DEdgeLabel>
    <DNote x={240} y={214}>one database · row-level isolation · noisy-neighbour limits</DNote>
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

/* ------------------------------- clusters -------------------------------- *
 * A real WebGL force graph (3d-force-graph, which wraps three.js and
 * d3-force-3d). The library and three together are far heavier than the rest
 * of this page, so they are imported dynamically: the section renders its
 * frame immediately and the graph drops in when the chunk lands. Under
 * reduced motion the simulation is warmed up and frozen instead of spinning.
 * -------------------------------------------------------------------------- */

type GraphNode = {
  id: string;
  c: number;
  label?: string;
  hub?: boolean;
  val: number;
  color: string;
};
type GraphLink = { source: string; target: string; c: number; cross?: boolean };

/** One labelled hub per cluster, its saves around it, plus the few edges that
 *  run between clusters — the through-line the page is actually claiming. */
const buildGraph = () => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  CLUSTERS.forEach((cl, ci) => {
    nodes.push({ id: `h${ci}`, c: ci, label: cl.tag, hub: true, val: 9, color: cl.color });
    for (let i = 0; i < cl.n; i += 1) {
      const id = `n${ci}-${i}`;
      nodes.push({
        id,
        c: ci,
        label: cl.items[i] ?? undefined,
        val: i < cl.items.length ? 3.4 : 1.6,
        color: cl.color,
      });
      links.push({ source: `h${ci}`, target: id, c: ci });
      // a little intra-cluster webbing so it reads as a body, not a star
      if (i > 2) links.push({ source: `n${ci}-${i - 3}`, target: id, c: ci });
    }
  });

  ([[0, 2], [1, 2], [2, 3], [0, 3]] as [number, number][]).forEach(([a, b]) => {
    links.push({ source: `h${a}`, target: `h${b}`, c: a, cross: true });
  });

  return { nodes, links };
};

const ClusterField = () => {
  const holder = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<{ dispose: () => void; focus: (c: number) => void } | null>(null);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { default: ForceGraph3D } = await import("3d-force-graph");
      if (cancelled || !holder.current) return;

      const reduced = REDUCED();
      const data = buildGraph();
      const dim = (hex: string, a: number) => {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
      };

      let focused = 0;

      const g = new ForceGraph3D(holder.current, { controlType: "orbit" })
        .backgroundColor("rgba(0,0,0,0)")
        .graphData(data)
        .nodeRelSize(2.1)
        .nodeVal("val")
        .nodeLabel((n: GraphNode) => n.label ?? "")
        .nodeColor((n: GraphNode) => (n.c === focused ? n.color : dim(n.color, 0.16)))
        .nodeOpacity(0.92)
        .linkColor((l: GraphLink) =>
          l.c === focused ? dim(CLUSTERS[l.c].color, l.cross ? 0.8 : 0.55) : "rgba(255,255,255,.04)",
        )
        .linkWidth((l: GraphLink) => (l.cross ? 1.1 : 0.5))
        .linkDirectionalParticles((l: GraphLink) => (l.cross && l.c === focused && !reduced ? 2 : 0))
        .linkDirectionalParticleWidth(1.4)
        .linkDirectionalParticleSpeed(0.004)
        .linkDirectionalParticleColor(() => "#f2a53c")
        .showNavInfo(false)
        .enableNodeDrag(false)
        .warmupTicks(reduced ? 120 : 0)
        .cooldownTime(reduced ? 0 : 6000);

      g.d3Force("charge")?.strength(-110);
      g.d3Force("link")?.distance((l: GraphLink) => (l.cross ? 320 : 46));

      const controls = g.controls() as {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableZoom: boolean;
        enablePan: boolean;
      };
      controls.autoRotate = !reduced;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = false;
      controls.enablePan = false;

      const size = () => {
        const box = holder.current;
        if (!box) return;
        g.width(box.clientWidth).height(box.clientHeight);
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(holder.current);

      type Placed = GraphNode & { x?: number; y?: number; z?: number };

      /* zoomToFit frames the cluster but leaves the orbit target at the scene
       * origin, so auto-rotate then swings the cluster back out of frame. This
       * fits it and re-targets the orbit on the same centroid. */
      const focus = (c: number) => {
        focused = c;
        // re-read the accessors so the palette follows the selected cluster
        g.nodeColor(g.nodeColor()).linkColor(g.linkColor()).linkDirectionalParticles(g.linkDirectionalParticles());

        const members = (data.nodes as Placed[]).filter((n) => n.c === c && n.x != null);
        if (!members.length) return;

        const mid = members.reduce(
          (a, n) => ({ x: a.x + (n.x ?? 0), y: a.y + (n.y ?? 0), z: a.z + (n.z ?? 0) }),
          { x: 0, y: 0, z: 0 },
        );
        mid.x /= members.length;
        mid.y /= members.length;
        mid.z /= members.length;

        const radius = Math.max(
          40,
          ...members.map((n) => Math.hypot((n.x ?? 0) - mid.x, (n.y ?? 0) - mid.y, (n.z ?? 0) - mid.z)),
        );
        // half of the default 75° field of view, with a little air around it
        const dist = ((radius + 24) / Math.tan((75 / 2) * (Math.PI / 180))) * 1.85;

        const cam = g.cameraPosition();
        const off = { x: cam.x - mid.x, y: cam.y - mid.y, z: cam.z - mid.z };
        const len = Math.hypot(off.x, off.y, off.z) || 1;

        g.cameraPosition(
          { x: mid.x + (off.x / len) * dist, y: mid.y + (off.y / len) * dist, z: mid.z + (off.z / len) * dist },
          mid,
          reduced ? 0 : 900,
        );
      };

      // the layout is still settling on mount, so hold the first framing until
      // the simulation has cooled
      g.onEngineStop(() => focus(focused));

      graphRef.current = {
        dispose: () => {
          ro.disconnect();
          g._destructor?.();
        },
        focus,
      };
      cleanup = () => graphRef.current?.dispose();
      setReady(true);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    graphRef.current?.focus(active);
  }, [active, ready]);

  const cl = CLUSTERS[active];

  return (
    <div className="cluster-wrap">
      <div className="cluster-stage">
        <div className="cluster-tabs" role="tablist">
          {CLUSTERS.map((c, i) => (
            <button key={c.tag} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}>
              {c.tag} · {c.n}
            </button>
          ))}
        </div>
        <div className="cluster-gl" ref={holder} aria-label="Your saved material, grouped into clusters" role="img" />
        {!ready ? <p className="cluster-loading">building the constellation</p> : null}
        <p className="cluster-hint">drag to turn it</p>
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
        <text x={x} y={y + 14} textAnchor="middle" fill="#6e7f78" fontSize="10" fontFamily={MONO}>{sub}</text>
      </g>
    ))}
    <line x1="176" y1="66" x2="330" y2="66" stroke="#f2a53c" strokeWidth="1" markerEnd="url(#lar)" />
    <line x1="420" y1="92" x2="420" y2="146" stroke="#f2a53c" strokeWidth="1" markerEnd="url(#lar)" />
    <line x1="334" y1="178" x2="180" y2="178" stroke="#f2a53c" strokeWidth="1" markerEnd="url(#lar)" />
    <line x1="90" y1="152" x2="90" y2="98" stroke="#63e6a0" strokeWidth="1" strokeDasharray="4 4" markerEnd="url(#lgr)" />
    <text x="255" y="52" textAnchor="middle" fill="#6e7f78" fontSize="10" fontFamily={MONO}>seconds</text>
    <text x="255" y="196" textAnchor="middle" fill="#6e7f78" fontSize="10" fontFamily={MONO}>your repo, your keys</text>
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
/* ------------------------------ scroll reveal ------------------------------ *
 * Asme plays each section in on first intersection. Framer Motion does this
 * upstream; an IntersectionObserver plus a CSS transition is the same effect
 * without adding a dependency, and it degrades to a plain fade under reduced
 * motion because the transform is dropped in CSS.
 * -------------------------------------------------------------------------- */

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  y?: number;
  x?: number;
  delay?: number;
  as?: "div" | "section" | "article" | "header" | "footer" | "h2" | "p";
};

const Reveal = ({ children, className = "", y = 0, x = 0, delay = 0, as = "div" }: RevealProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (REDUCED()) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as keyof JSX.IntrinsicElements;
  return (
    <Tag
      ref={ref as never}
      className={`rv ${seen ? "in" : ""} ${className}`}
      style={
        {
          "--rv-x": `${x}px`,
          "--rv-y": `${y}px`,
          "--rv-delay": `${delay}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
};

/** Italic serif accent, set in Instrument Serif — Asme's emphasis device. */
const S = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <em className={`serif ${className}`}>{children}</em>
);

const Catalogue = () => (
  <>
    {CATALOGUE.map((g, gi) => (
      <div className="cat-group" key={g.id}>
        <Reveal className="cat-head" y={24} delay={0}>
          <h3>{g.title}</h3>
          <p>{g.blurb}</p>
        </Reveal>
        <div className="cat-grid">
          {g.items.map((f, i) => (
            <Reveal as="article" className="cat-card glass" key={f.name} y={28} delay={Math.min(i, 5) * 60}>
              <MicroViz kind={f.viz} />
              <h4>{f.name}</h4>
              <p className="cat-does">{f.does}</p>
            </Reveal>
          ))}
        </div>
        {gi < CATALOGUE.length - 1 ? <div className="rule" aria-hidden /> : null}
      </div>
    ))}
  </>
);

const UseCases = () => (
  <div className="uc-grid">
    {USE_CASES.map((u, i) => (
      <Reveal as="article" className="uc-card glass" key={u.who + u.saw} y={44} delay={(i % 2) * 120}>
        <div className="uc-media">
          <MicroViz kind={u.viz} />
          <div className="uc-scrim" aria-hidden />
        </div>
        <div className="uc-body">
          <div className="uc-top">
            <p className="mini-label">{u.who}</p>
            <span className="uc-arrow glass" aria-hidden>
              ↗
            </span>
          </div>
          <p className="uc-saw">{u.saw}</p>
          <p className="uc-note">✱ {u.note}</p>
          <p className="uc-got">{u.got}</p>
        </div>
      </Reveal>
    ))}
  </div>
);

/* --------------------------------- page --------------------------------- */

const NAV_LINKS: [string, string][] = [
  ["#mutation", "The mutation"],
  ["#philosophy", "The wall"],
  ["#clusters", "Clusters"],
  ["#cases", "Use cases"],
  ["#everything", "Everything"],
  ["#pricing", "Pricing"],
];

const FOOTER_COLUMNS: { heading: string; links: [string, string][] }[] = [
  {
    heading: "Product",
    links: [
      ["#mutation", "The mutation"],
      ["#everything", "Everything it does"],
      ["#pricing", "Pricing"],
      ["#cases", "Use cases"],
    ],
  },
  {
    heading: "How it works",
    links: [
      ["#philosophy", "The wall"],
      ["#loop", "The loop"],
      ["#clusters", "Clusters"],
    ],
  },
  {
    heading: "Yours",
    links: [
      ["#pricing", "Export & delete"],
      ["#pricing", "One private brain"],
      ["#pricing", "Share one thing"],
    ],
  },
];

const Landing = ({ onEnter }: { onEnter?: () => void }) => {
  const [scrolled, setScrolled] = useState(false);
  const [lost, setLost] = useState(0);
  const [wish, setWish] = useState("");

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

  // Instrument Serif carries every accent on this page, so it is loaded here
  // rather than in index.html — the app itself never needs it.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  return (
    <div className="fb-root asme">
      <style>{CSS}</style>

      {/* ------------------------------- hero ------------------------------- */}
      <header className="hero" id="top">
        <DriftField onCatch={onCatch} onLost={setLost} />
        <div className="hero-veil" aria-hidden />

        <div className={`navbar-wrap ${scrolled ? "is-stuck" : ""}`}>
          <nav className="navbar glass">
            <div className="nav-left">
              <a href="#top" className="brand" aria-label="Fart Brains home">
                <i aria-hidden />
                <span>Fart Brains</span>
              </a>
              <div className="nav-links">
                {NAV_LINKS.map(([href, label]) => (
                  <a key={href + label} href={href}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
            <div className="nav-right">
              <button type="button" className="nav-plain" onClick={onEnter}>
                Sign in
              </button>
              <button type="button" className="btn amber sm" onClick={onEnter}>
                Start free
              </button>
            </div>
          </nav>
        </div>

        <div className="hero-in">
          <p className="eyebrow">
            <i className="on" aria-hidden /> every play you scrolled past is still gone
          </p>

          <h1>
            The tools you actually need <S>aren&rsquo;t for sale</S>.
          </h1>

          <form
            className="wish glass"
            onSubmit={(e) => {
              e.preventDefault();
              onCatch();
            }}
          >
            <span className="wish-mark" aria-hidden>
              ✱
            </span>
            <input
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="I want this, but with multi-tenancy"
              aria-label="Your one line"
              spellCheck={false}
            />
            <button type="submit" aria-label="See what that makes" className="wish-go">
              →
            </button>
          </form>

          <p className="lede">
            Somebody explains exactly how they did it — the strategy, the order, the reason it works. It&rsquo;s
            a 47-second reel or a 22-minute talk, and by Thursday it&rsquo;s gone. There&rsquo;s no product to
            buy that does what they described. Fart Brains catches it, and one line from you turns it into
            something that has never existed.
          </p>

          <div className="hero-cta">
            <button type="button" className="btn amber" onClick={onEnter}>
              Start free
            </button>
            <a className="btn glass" href="#mutation">
              See what that makes
            </a>
          </div>
        </div>

        <div className="hero-foot">
          <span className="hud glass">
            gone while you read this <b>{lost}</b>
          </span>
          <span className="hud glass">
            you&rsquo;ll never know which <b>—</b>
          </span>
          <span className="hud-hint">nobody counts these. that&rsquo;s what a brain fart is.</span>
        </div>
      </header>

      {/* ------------------------------- about ------------------------------ */}
      <section className="about">
        <div className="glow-top" aria-hidden />
        <div className="wrap center">
          <Reveal as="p" className="mini-label" y={20}>
            What did they potentially lose?
          </Reveal>
          <Reveal as="h2" className="statement" y={40} delay={100}>
            A mechanism somebody <S>gave away</S> for free,
            <br className="br" /> and the one product it would have <S>become</S> in your hands.
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- the mutation ------------------------- */}
      <section id="mutation" className="featured">
        <div className="wrap">
          <Reveal className="featured-head" y={30}>
            <div className="frame-card glass">
              <p className="mini-label">01 / the mutation</p>
              <p>
                Their mechanism already works — explained by the person who ran it. Your note is the part they
                never said, because they weren&rsquo;t building your thing. Edit the note; watch what gets
                attributed to you.
              </p>
            </div>
            <a href="#everything" className="btn glass frame-btn">
              Everything it does
            </a>
          </Reveal>
          <Reveal className="featured-panel" y={60} delay={120}>
            <MutationPanel />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------- philosophy ---------------------------- */}
      <section id="philosophy" className="philosophy">
        <div className="wrap">
          <Reveal as="h2" className="big" y={40}>
            The wall <S className="dimmer">×</S> the loop
          </Reveal>

          <div className="phil-grid">
            <Reveal className="phil-media" x={-40} delay={100}>
              <div className="wall-col">
                <p className="mini-label">an agent, given the link</p>
                <pre className="wall-term">
{"$ fetch https://instagram.com/p/…\n"}
<span className="err">{"net::ERR_CONNECTION_RESET"}</span>
{"\n$ curl -sL https://instagram.com/p/…\n"}
<span className="dim">{"621 KB of JavaScript shell\nno caption, no transcript, no og tags"}</span>
                </pre>
              </div>
              <div className="wall-col">
                <p className="mini-label out-label">you, hitting share</p>
                <pre className="wall-term">
{"share sheet → Fart Brains\n"}
<span className="ok">{"✓ transcribed        2.1s\n✓ action items       3\n✓ references         2 followed\n✓ filed              #llm-optimization"}</span>
{"\n"}
<span className="dim">{"done before the screen locked"}</span>
                </pre>
              </div>
            </Reveal>

            <Reveal className="phil-text" x={40} delay={200}>
              <div>
                <p className="mini-label">Your AI can&rsquo;t open the reel</p>
                <p className="body">
                  The plays live on platforms that don&rsquo;t let agents in. Hand that link to any assistant
                  and it hits a wall — that terminal is a real attempt, not an illustration. Hit share on your
                  phone and it&rsquo;s already inside: transcribed, tagged and filed before the screen locks.
                  Anyone can summarize a web page. Almost nobody can get in here.
                </p>
              </div>
              <div className="rule" aria-hidden />
              <div>
                <p className="mini-label">Then it closes</p>
                <p className="body">
                  The brief goes to whatever you already work in, over MCP or plain REST. Your agent builds
                  against its own filesystem — we never touch it — then writes back what it built and what it
                  decided. That lands as new material, so the next brief never re-proposes what you already
                  shipped.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------- loop ------------------------------- */}
      <section id="loop" className="loop-band">
        <div className="wrap">
          <Reveal className="frame plain" y={50}>
            <LoopDiagram />
          </Reveal>
          <div className="loop-legend">
            {[
              ["capture", "Share sheet, URL, voice or paste. Transcribed and filed on its own."],
              ["brief", "What the source does, what to build, how it changes for your stack, how to verify."],
              ["build", "Your agent, your repo, your keys. Nothing of ours on your machine."],
              ["write-back", "What shipped comes home, so it learns from what you did, not what you watched."],
            ].map(([b, s], i) => (
              <Reveal key={b} y={24} delay={i * 80}>
                <b>{b}</b>
                <span>{s}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- clusters ----------------------------- */}
      <section id="clusters" className="clusters">
        <div className="glow-center" aria-hidden />
        <div className="wrap">
          <Reveal className="band-head" y={30}>
            <p className="mini-label">The pile does this on its own</p>
            <h2 className="big">
              It connected the dots and built the <S>scaffolding</S>.
            </h2>
            <p className="body wide">
              Sixteen things you saved months apart, sitting next to each other. It reads across them, finds
              the through-line, and stands up the infrastructure — a business, a solution, or the opportunity
              you already walked past once. Not a reading list. The thing, scaffolded.
            </p>
          </Reveal>
          <Reveal className="frame plain" y={60} delay={120}>
            <ClusterField />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------ services ---------------------------- */}
      <section id="cases" className="services">
        <div className="glow-center" aria-hidden />
        <div className="wrap">
          <Reveal className="services-head" y={30}>
            <h2 className="big">Same move, different room.</h2>
            <p className="mini-label right-label">Six of them</p>
          </Reveal>
          <UseCases />
        </div>
      </section>

      {/* ----------------------------- everything --------------------------- */}
      <section id="everything" className="everything">
        <div className="wrap">
          <Reveal className="band-head" y={30}>
            <p className="mini-label">Everything it does</p>
            <h2 className="big">
              Thirty-six answers to <S>that question</S>.
            </h2>
            <p className="body wide">
              What did they potentially lose? Once for every capability in here.
            </p>
          </Reveal>
          <Catalogue />
        </div>
      </section>

      {/* ------------------------------ pricing ----------------------------- */}
      <section id="pricing" className="pricing">
        <div className="glow-top" aria-hidden />
        <div className="wrap">
          <Reveal className="band-head" y={30}>
            <p className="mini-label">Pricing</p>
            <h2 className="big">
              Free forever, or <S>nine dollars</S>.
            </h2>
            <p className="body wide">
              The free plan is real and permanent, not a trial with a countdown. Export everything or delete
              the account whenever you want, on either plan.
            </p>
          </Reveal>

          <div className="plans">
            <Reveal className="plan glass" y={40}>
              <p className="mini-label">Free</p>
              <p className="price">
                $0<span>/month</span>
              </p>
              <ul>
                <li>Unlimited saves, folders, tags, reminders</li>
                <li>Full search and share links</li>
                <li>50 AI actions a month</li>
                <li>Full export and account deletion</li>
              </ul>
              <button type="button" className="btn glass full" onClick={onEnter}>
                Start free
              </button>
              <p className="fine">
                Saving a popular video usually costs nothing — cached and caption-based transcripts don&rsquo;t
                count against it.
              </p>
            </Reveal>

            <Reveal className="plan glass featured-plan" y={40} delay={120}>
              <p className="mini-label out-label">Pro</p>
              <p className="price">
                $9<span>/month</span>
              </p>
              <ul>
                <li>Everything in Free</li>
                <li>1,000 AI actions a month</li>
                <li>Longer transcripts, bigger pages</li>
                <li>Priority support</li>
              </ul>
              <button type="button" className="btn amber full" onClick={onEnter}>
                Try Pro free for 14 days
              </button>
              <p className="fine">No card required. $90 a year if you&rsquo;d rather — two months free.</p>
            </Reveal>
          </div>

          <div className="promises">
            {[
              ["One brain, yours.", "No teams, no shared folders, no workspace. One account is one private brain."],
              ["Share exactly one thing.", "A read-only link to a single item, revocable any time. The recipient sees nothing else."],
              ["Leave whenever.", "Export to JSON or Markdown, or delete the account outright. Both are one click."],
            ].map(([b, s], i) => (
              <Reveal key={b} y={24} delay={i * 80}>
                <b>{b}</b>
                <span>{s}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- footer ----------------------------- */}
      <footer className="site-foot">
        <div className="glow-top" aria-hidden />
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand">
              <a href="#top" className="brand" aria-label="Fart Brains home">
                <i aria-hidden />
                <span>Fart Brains</span>
              </a>
              <p>
                You can&rsquo;t miss what you can&rsquo;t <S>remember</S>. Catch it, mutate it, ship it.
              </p>
              <button type="button" className="btn amber" onClick={onEnter}>
                Start free
              </button>
            </div>

            <div className="foot-cols">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.heading}>
                  <p className="mini-label">{col.heading}</p>
                  <ul>
                    {col.links.map(([href, label]) => (
                      <li key={href + label}>
                        <a href={href}>{label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <p className="watermark" aria-hidden>
            Fart Brains
          </p>

          <div className="foot-bottom">
            <p>© 2026 Fart Brains. All rights reserved.</p>
            <p>web · installable · windows desktop</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

/* -------------------------------- styles -------------------------------- *
 * Asme (MIT, MohammadShehadeh/hirael) recast for Fart Brains: pure black,
 * liquid-glass surfaces, Instrument Serif accents — with amber kept as the
 * single accent on calls to action and the note the user writes.
 * ------------------------------------------------------------------------ */

const CSS = `
html.fb-landing, html.fb-landing body, html.fb-landing #root {
  height: auto !important; min-height: 100%; max-width: none !important;
  width: auto !important; overflow: visible !important;
  border-radius: 0 !important; box-shadow: none !important;
  transform: none !important; scroll-behavior: smooth; background: #000;
}
html.fb-landing body { padding-right: 0 !important; }
html.fb-landing body::before { display: none !important; }

.fb-root {
  --bg: #000;
  --ink: #fff;
  --ink-70: rgba(255,255,255,.7);
  --ink-50: rgba(255,255,255,.5);
  --ink-40: rgba(255,255,255,.4);
  --ink-20: rgba(255,255,255,.2);
  --ink-10: rgba(255,255,255,.1);
  --card: #0a0a0a;
  --amber: #f2a53c;
  --green: #63e6a0;
  --sans: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  --serif: "Instrument Serif", Georgia, serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace;

  position: relative; z-index: 1; min-height: 100vh;
  background: var(--bg); color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.fb-root ::selection { background: rgba(242,165,60,.3); color: #fff; }
.fb-root * { box-sizing: border-box; }
.fb-root h1, .fb-root h2, .fb-root h3, .fb-root h4, .fb-root p, .fb-root ul { margin: 0; }
.fb-root ul { padding: 0; list-style: none; }
.fb-root a { color: inherit; text-decoration: none; }

.serif { font-family: var(--serif); font-style: italic; font-weight: 400; color: var(--amber); }
.serif.dimmer { color: var(--ink-40); }

/* --- Asme's liquid glass --- */
.glass {
  background: rgba(255,255,255,.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,.1);
  position: relative; overflow: hidden;
}
.glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg,
    rgba(255,255,255,.45) 0%, rgba(255,255,255,.15) 20%,
    rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
    rgba(255,255,255,.15) 80%, rgba(255,255,255,.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none; z-index: 2;
}
.glow-top { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at top, rgba(255,255,255,.035) 0%, transparent 70%); }
.glow-center { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(255,255,255,.025) 0%, transparent 60%); }

/* --- scroll reveal --- */
.rv { opacity: 0; transform: translate(var(--rv-x, 0), var(--rv-y, 0));
  transition: opacity .8s cubic-bezier(.16,1,.3,1) var(--rv-delay, 0ms),
              transform .8s cubic-bezier(.16,1,.3,1) var(--rv-delay, 0ms); }
.rv.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .rv { opacity: 1; transform: none; transition: none; }
  .fb-root * { animation: none !important; }
}

.fb-root section[id], .fb-root header[id] { scroll-margin-top: 104px; }
.wrap { width: 100%; max-width: 1152px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
.wrap.center { text-align: center; max-width: 1024px; }
.rule { height: 1px; background: var(--ink-10); border: 0; }

.mini-label { font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--ink-40); font-weight: 400; }
.mini-label.out-label { color: var(--amber); }
.body { font-size: 14px; line-height: 1.625; color: var(--ink-50); }
@media (min-width: 768px) { .body { font-size: 16px; } }
.body.wide { max-width: 640px; margin-top: 20px; }

/* --- buttons --- */
.btn { display: inline-flex; align-items: center; justify-content: center;
  border: 0; cursor: pointer; border-radius: 999px; padding: 12px 32px;
  font: inherit; font-size: 14px; font-weight: 500; color: var(--ink);
  transition: background-color .2s, color .2s, transform .2s; }
.btn.sm { padding: 8px 24px; font-size: 14px; }
.btn.full { width: 100%; margin-top: 24px; }
.btn.amber { background: var(--amber); color: #000; font-weight: 600; }
.btn.amber:hover { background: #ffb954; }
.btn.glass:hover { background: rgba(255,255,255,.06); }

/* ------------------------------- navbar -------------------------------- */
.navbar-wrap { position: fixed; top: 0; left: 0; right: 0; z-index: 40; padding: 24px;
  transition: padding .3s ease; }
.navbar-wrap.is-stuck { padding: 12px 24px; }
.navbar { max-width: 1152px; margin: 0 auto; border-radius: 999px;
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  padding: 10px 12px 10px 24px; }
.nav-left { display: flex; align-items: center; gap: 34px; min-width: 0; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; font-size: 16px;
  letter-spacing: -.025em; white-space: nowrap; }
.brand i { width: 9px; height: 9px; border-radius: 50%; background: var(--amber);
  box-shadow: 0 0 12px rgba(242,165,60,.8); animation: pulse 3.2s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
.nav-links { display: none; align-items: center; gap: 26px; }
.nav-links a { font-size: 14px; font-weight: 500; color: var(--ink-50); transition: color .2s; }
.nav-links a:hover { color: var(--ink); }
.nav-right { display: flex; align-items: center; gap: 10px; }
.nav-plain { background: none; border: 0; cursor: pointer; font: inherit; font-size: 14px;
  font-weight: 500; color: var(--ink-70); padding: 8px 4px; transition: color .2s; }
.nav-plain:hover { color: var(--ink); }
@media (min-width: 1000px) { .nav-links { display: flex; } }

/* -------------------------------- hero --------------------------------- */
.hero { position: relative; min-height: 100svh; display: flex; flex-direction: column;
  overflow: hidden; padding-bottom: 40px; }
.drift { position: absolute; inset: 0; z-index: 0; }
.drift canvas { display: block; width: 100%; height: 100%; }
.hero-veil { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(ellipse at 50% 42%, rgba(0,0,0,.55) 0%, rgba(0,0,0,.82) 45%, #000 78%),
              radial-gradient(ellipse at top, rgba(255,255,255,.04) 0%, transparent 60%); }
.hero-in { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; gap: 0;
  padding: 48px 24px; max-width: 1024px; margin: 0 auto; }
.eyebrow { margin-bottom: 32px; }
.hero h1 { margin-bottom: 40px; }
.wish { margin-bottom: 24px; }
.lede { margin-bottom: 32px; }
.hero-cta { margin-bottom: 8px; }
.eyebrow { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-40);
  display: inline-flex; align-items: center; gap: 9px; }
.eyebrow .on { width: 6px; height: 6px; border-radius: 50%; background: var(--green);
  box-shadow: 0 0 10px rgba(99,230,160,.7); animation: pulse 2.4s ease-in-out infinite; }
/* Asme's hero type scale (7xl/8xl/9xl) is sized for a three-word headline it
 * can hold on one line. This one is a sentence, so it stops at the 8xl step
 * and sets on two lines rather than three. */
.hero h1 { font-family: var(--serif); font-weight: 400; font-style: normal;
  font-size: 36px; line-height: 1; letter-spacing: -.025em; }
@media (min-width: 640px) { .hero h1 { font-size: 60px; } }
@media (min-width: 768px) { .hero h1 { font-size: 72px; } }
@media (min-width: 1024px) { .hero h1 { font-size: 96px; } }
.hero h1 .serif { color: var(--amber); }
.wish { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 620px;
  border-radius: 999px; padding: 6px 6px 6px 22px; }
.wish-mark { color: var(--amber); font-size: 14px; flex: none; }
.wish input { flex: 1; min-width: 0; background: none; border: 0; outline: none;
  font: inherit; font-family: var(--mono); font-size: 14px; color: var(--ink); padding: 12px 0; }
.wish input::placeholder { color: rgba(255,255,255,.35); }
.wish-go { flex: none; width: 42px; height: 42px; border-radius: 999px; border: 0; cursor: pointer;
  background: var(--amber); color: #000; font-size: 18px; line-height: 1;
  display: grid; place-items: center; transition: background-color .2s; z-index: 3; }
.wish-go:hover { background: #ffb954; }
.lede { max-width: 620px; font-size: 16px; line-height: 1.625; color: var(--ink-50); }
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.hero-cta .btn.glass { border-radius: 999px; }
.hero-foot { position: relative; z-index: 10; display: flex; flex-wrap: wrap; gap: 10px;
  align-items: center; justify-content: center; padding: 0 24px; }
.hud { border-radius: 999px; padding: 10px 20px; font-size: 12px;
  color: var(--ink-50); }
.hud b { color: var(--amber); font-weight: 500; }
.hud-hint { font-size: 12px; color: rgba(255,255,255,.25);
  width: 100%; text-align: center; margin-top: 6px; }

/* -------------------------------- about -------------------------------- */
.about { position: relative; overflow: hidden; padding: 128px 0 40px; }
@media (min-width: 768px) { .about { padding: 176px 0 56px; } }
.about .mini-label { margin-bottom: 32px; }
.statement { font-size: 36px; line-height: 1.1; letter-spacing: -.025em; font-weight: 400; }
@media (min-width: 768px) { .statement { font-size: 60px; } }
@media (min-width: 1024px) { .statement { font-size: 72px; } }
.br { display: none; }
@media (min-width: 860px) { .br { display: inline; } }

/* ------------------------------ featured ------------------------------- */
.featured { padding: 24px 0 80px; overflow: hidden; }
@media (min-width: 768px) { .featured { padding: 40px 0 128px; } }
.frame { position: relative; border-radius: 24px; overflow: hidden; background: var(--card);
  box-shadow: inset 0 1px 1px rgba(255,255,255,.1); }
.frame.plain { padding: 20px; }
.featured-head { display: flex; flex-direction: column; gap: 24px; margin-bottom: 32px; }
.frame-card { max-width: 560px; border-radius: 16px; padding: 24px; }
@media (min-width: 768px) { .frame-card { padding: 32px; } }
.frame-card p:last-child { margin-top: 12px; font-size: 14px; line-height: 1.625; color: var(--ink-70); }
.frame-btn { align-self: flex-start; border-radius: 999px; }
@media (min-width: 860px) {
  .featured-head { flex-direction: row; align-items: flex-end; justify-content: space-between; }
  .frame-btn { align-self: auto; }
}

/* ------------------------------ philosophy ----------------------------- */
.philosophy { padding: 112px 0; overflow: hidden; }
@media (min-width: 768px) { .philosophy { padding: 160px 0; } }
.big { font-size: 30px; line-height: 1.1; letter-spacing: -.025em; font-weight: 400; }
@media (min-width: 768px) { .big { font-size: 48px; } }
.philosophy .big { font-size: 48px; margin-bottom: 64px; }
@media (min-width: 768px) { .philosophy .big { font-size: 72px; margin-bottom: 96px; } }
@media (min-width: 1024px) { .philosophy .big { font-size: 96px; } }
.phil-grid { display: grid; grid-template-columns: 1fr; gap: 32px; }
@media (min-width: 900px) { .phil-grid { grid-template-columns: 1fr 1fr; gap: 48px; } }
.phil-media { display: grid; gap: 16px; align-content: start; }
.wall-col { border-radius: 20px; background: #070707; padding: 20px;
  box-shadow: inset 0 1px 1px rgba(255,255,255,.07); }
.wall-term { font-family: var(--mono); font-size: 12px; line-height: 1.85; margin: 12px 0 0;
  white-space: pre-wrap; word-break: break-word; color: var(--ink-50); }
.wall-term .err { color: #ff6b6b; }
.wall-term .ok { color: var(--green); }
.wall-term .dim { color: rgba(255,255,255,.3); }
.phil-text { display: flex; flex-direction: column; justify-content: center; gap: 34px; }
.phil-text .body { margin-top: 14px; }

/* -------------------------------- loop --------------------------------- */
.loop-band { padding: 0 0 112px; overflow: hidden; }
@media (min-width: 768px) { .loop-band { padding: 0 0 160px; } }
.loop-band svg { width: 100%; height: auto; display: block; }
.loop-legend { display: grid; grid-template-columns: 1fr; gap: 32px; margin-top: 48px; }
@media (min-width: 720px) { .loop-legend { grid-template-columns: repeat(4, 1fr); } }
.loop-legend b { display: block; font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--amber); font-weight: 500; margin-bottom: 10px; }
.loop-legend span { font-size: 14px; line-height: 1.625; color: var(--ink-50); }

/* ------------------------------- clusters ------------------------------ */
.clusters { position: relative; padding: 112px 0; overflow: hidden; }
@media (min-width: 768px) { .clusters { padding: 160px 0; } }
.band-head { margin-bottom: 48px; }
@media (min-width: 768px) { .band-head { margin-bottom: 64px; } }
.band-head .big { margin-top: 20px; }
.clusters canvas { width: 100% !important; display: block; border-radius: 12px; }

/* ------------------------------- services ------------------------------ */
.services { position: relative; padding: 112px 0; overflow: hidden; }
@media (min-width: 768px) { .services { padding: 160px 0; } }
.services-head { display: flex; align-items: flex-end; justify-content: space-between;
  gap: 20px; margin-bottom: 48px; }
@media (min-width: 768px) { .services-head { margin-bottom: 64px; } }
.right-label { display: none; }
@media (min-width: 720px) { .right-label { display: block; } }
.uc-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
@media (min-width: 860px) { .uc-grid { grid-template-columns: 1fr 1fr; gap: 32px; } }
.uc-card { border-radius: 24px; overflow: hidden; display: flex; flex-direction: column; }
.uc-media { position: relative; aspect-ratio: 16 / 7; background: #070707;
  display: grid; place-items: center; overflow: hidden; }
.uc-media svg { width: 62%; max-width: 260px; height: auto; }
.uc-scrim { position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,.45), transparent); pointer-events: none; }
.uc-body { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
@media (min-width: 768px) { .uc-body { padding: 32px; } }
.uc-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.uc-arrow { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center;
  font-size: 14px; color: var(--ink-70); }
.uc-saw { font-size: 20px; line-height: 1.3; letter-spacing: -.025em; color: var(--ink); }
@media (min-width: 768px) { .uc-saw { font-size: 24px; } }
.uc-note { font-size: 14px; line-height: 1.625; color: var(--amber);
  padding-left: 12px; border-left: 1px solid rgba(242,165,60,.4); }
.uc-got { font-size: 14px; line-height: 1.625; color: var(--ink-50); }

/* ------------------------------ everything ----------------------------- */
.everything { padding: 112px 0; overflow: hidden; }
@media (min-width: 768px) { .everything { padding: 160px 0; } }
.cat-group { margin-bottom: 12px; }
.cat-head { margin: 64px 0 32px; }
.cat-head h3 { font-family: var(--serif); font-style: italic; font-weight: 400;
  font-size: clamp(24px, 3vw, 36px); letter-spacing: -.025em; color: var(--ink); }
.cat-head p { margin-top: 10px; font-size: 14px; line-height: 1.625; color: var(--ink-50);
  max-width: 620px; }
.cat-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
@media (min-width: 768px) { .cat-grid { gap: 32px; } }
@media (min-width: 620px) { .cat-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 960px) { .cat-grid { grid-template-columns: repeat(3, 1fr); } }
.cat-card { border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 12px; }
@media (min-width: 768px) { .cat-card { padding: 32px; } }
.cat-card svg { width: 100%; max-width: 190px; height: auto; }
.cat-card h4 { font-size: 16px; font-weight: 600; letter-spacing: -.025em; color: var(--ink); }
.cat-does { font-size: 14px; line-height: 1.625; color: var(--ink-50); }
.cat-group .rule { margin-top: 64px; }

/* ------------------------------- pricing ------------------------------- */
.pricing { position: relative; padding: 112px 0; overflow: hidden; }
@media (min-width: 768px) { .pricing { padding: 160px 0; } }
.plans { display: grid; grid-template-columns: 1fr; gap: 24px; }
@media (min-width: 800px) { .plans { grid-template-columns: 1fr 1fr; gap: 32px; } }
.plan { border-radius: 24px; padding: 24px; display: flex; flex-direction: column; }
@media (min-width: 768px) { .plan { padding: 32px; } }
.plan.featured-plan { box-shadow: inset 0 1px 1px rgba(242,165,60,.35); }
.price { font-family: var(--serif); font-size: 60px; line-height: 1.1; margin: 14px 0 22px; }
.price span { font-family: var(--sans); font-size: 14px; color: var(--ink-40); margin-left: 6px; }
.plan ul { display: grid; gap: 12px; }
.plan li { font-size: 14px; line-height: 1.5; color: var(--ink-70); padding-left: 20px;
  position: relative; }
.plan li::before { content: '·'; position: absolute; left: 6px; color: var(--amber); }
.plan .btn { margin-top: auto; }
.fine { margin-top: 16px; font-size: 12px; line-height: 1.625; color: var(--ink-40); }
.promises { display: grid; grid-template-columns: 1fr; gap: 32px; margin-top: 64px;
  padding-top: 48px; border-top: 1px solid var(--ink-10); }
@media (min-width: 800px) { .promises { grid-template-columns: repeat(3, 1fr); gap: 48px; } }
.promises b { display: block; font-size: 16px; font-weight: 600; margin-bottom: 10px; }
.promises span { font-size: 14px; line-height: 1.625; color: var(--ink-50); }

/* -------------------------------- footer ------------------------------- */
.site-foot { position: relative; overflow: hidden; border-top: 1px solid var(--ink-10);
  padding: 80px 0 48px; }
@media (min-width: 768px) { .site-foot { padding: 112px 0 48px; } }
.foot-top { display: flex; flex-direction: column; gap: 48px; justify-content: space-between; }
@media (min-width: 860px) { .foot-top { flex-direction: row; } }
.foot-brand { max-width: 384px; }
.foot-brand p { margin: 20px 0 28px; font-size: 14px; line-height: 1.625; color: var(--ink-50); }
.foot-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
@media (min-width: 640px) { .foot-cols { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 768px) { .foot-cols { gap: 64px; } }
.foot-cols ul { display: grid; gap: 12px; margin-top: 16px; }
.foot-cols a { font-size: 14px; color: var(--ink-70); transition: color .2s; }
.foot-cols a:hover { color: var(--ink); }
.watermark { margin-top: 64px; text-align: center; user-select: none;
  font-family: var(--serif); font-style: italic; line-height: 1; letter-spacing: -.025em;
  font-size: 20vw; color: rgba(255,255,255,.05); white-space: nowrap; }
@media (min-width: 768px) { .watermark { margin-top: 80px; font-size: 15vw; } }
.foot-bottom { display: flex; flex-direction: column; gap: 16px; align-items: center;
  justify-content: space-between; margin-top: 32px; padding-top: 32px;
  border-top: 1px solid var(--ink-10); font-size: 12px; color: var(--ink-40); }
@media (min-width: 640px) { .foot-bottom { flex-direction: row; } }

/* ---- interactive pieces (mutation, clusters, micro visuals) ----
 * These keep the console detailing they were drawn with; the legacy tokens
 * below map that vocabulary onto the black/glass palette. */
.fb-root {
  --panel: #0a0a0a; --panel-2: #070707;
  --rule: rgba(255,255,255,.12); --rule-2: rgba(255,255,255,.07);
  --ink-2: rgba(255,255,255,.72); --dim: rgba(255,255,255,.45);
  --faint: rgba(255,255,255,.26);
}
.fb-root :focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }

/* ---------- the mutation ---------- */
.mut-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.mut-tabs button {
  padding: 9px 18px; border: 1px solid var(--rule); border-radius: 999px; font: inherit;
  font-size: 14px; color: var(--dim); cursor: pointer; background: rgba(255,255,255,.02);
  transition: color .2s, border-color .2s, background .2s;
}
.mut-tabs button:hover { color: var(--ink); }
.mut-tabs button[aria-selected="true"] { background: var(--amber); border-color: var(--amber); color: #000; font-weight: 600; }
.mut { border: 1px solid var(--rule); border-radius: 20px; background: var(--panel); overflow: hidden; }
.mut-grid { display: grid; grid-template-columns: 1fr; }
@media (min-width: 940px) { .mut-grid { grid-template-columns: minmax(0,.85fr) minmax(0,1.15fr); } }
.mut-left { padding: 24px; border-bottom: 1px solid var(--rule); }
@media (min-width: 940px) { .mut-left { border-bottom: 0; border-right: 1px solid var(--rule); } }
.mut-src { font-size: 12px; color: var(--dim); margin: 0 0 14px; }
.mut-said { margin: 0; padding: 0; list-style: none; display: grid; gap: 9px; }
.mut-said li { padding-left: 20px; position: relative; font-size: 14px; line-height: 1.625; color: var(--ink-2); }
.mut-said li::before { content: "·"; position: absolute; left: 6px; color: var(--dim); }
.mut-noterow { display: flex; align-items: center; gap: 10px; padding: 14px 20px;
  border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); background: rgba(242,165,60,.06); }
.mut-noterow .caret { color: var(--amber); font-family: var(--mono); }
.mut-noterow input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--amber);
  font-family: var(--mono); font-size: 14px; }
.mut-right { padding: 24px; display: grid; gap: 16px; align-content: start; }
.mut-out h3 { margin: 0 0 8px; font-size: 20px; letter-spacing: -.025em; font-weight: 500; }
.mut-out p { margin: 0; font-size: 14px; line-height: 1.625; color: var(--ink-2); }
.mut-never { display: inline-flex; align-items: center; gap: 8px; align-self: start; border-radius: 999px;
  font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--green); border: 1px solid rgba(99,230,160,.4); padding: 5px 12px; }
.mut-diagram { width: 100%; height: auto; display: block; background: var(--panel-2);
  border: 1px solid var(--rule); border-radius: 14px; }
.mut-parts { display: grid; gap: 8px; }
.mut-part { display: grid; grid-template-columns: 118px 1fr; gap: 12px; font-size: 12px; line-height: 1.625; }
@media (max-width: 620px) { .mut-part { grid-template-columns: 1fr; gap: 2px; } }
.mut-part b { font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--amber); font-weight: 500; }
.mut-part span { color: var(--ink-2); }

/* ---------- clusters ---------- */
.cluster-wrap { display: grid; grid-template-columns: 1fr; gap: 32px; align-items: center; }
@media (min-width: 960px) { .cluster-wrap { grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); gap: 48px; } }
.cluster-stage { position: relative; border-radius: 24px; background: var(--panel); overflow: hidden;
  box-shadow: inset 0 1px 1px rgba(255,255,255,.1); padding-top: 64px; }
.cluster-gl { width: 100%; height: clamp(380px, 46vw, 560px); }
.cluster-gl canvas { display: block; }
.cluster-loading { position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-40); }
.cluster-hint { position: absolute; right: 20px; bottom: 16px; font-size: 12px; color: rgba(255,255,255,.25); }
.cluster-tabs { position: absolute; left: 16px; right: 16px; top: 16px; display: flex; flex-wrap: wrap;
  gap: 8px; z-index: 2; }
.cluster-tabs button { font-family: var(--sans); font-size: 12px; padding: 8px 16px; border-radius: 999px;
  border: 1px solid var(--rule); background: rgba(0,0,0,.6); color: var(--ink-50); cursor: pointer;
  transition: color .2s, border-color .2s; }
.cluster-tabs button:hover { color: var(--ink); }
.cluster-tabs button[aria-selected="true"] { color: #000; background: var(--amber); border-color: var(--amber);
  font-weight: 500; }
.cluster-card { display: grid; gap: 16px; align-content: center; }
.cc-head { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--dim); }
.cc-dot { width: 9px; height: 9px; border-radius: 50%; }
.cc-items { display: flex; flex-wrap: wrap; gap: 5px; }
.cc-items span { font-size: 12px; color: var(--ink-2); border: 1px solid var(--rule); border-radius: 999px; padding: 3px 9px; }
.cc-title { font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--amber); margin: 2px 0 0; }
.cc-build { margin: 0; font-size: 14px; line-height: 1.625; color: var(--ink); }
.cc-why { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dim); }

/* ---------- mutation diagrams ---------- */
.dg-orbit { animation: dgOrbit 9s linear infinite; }
@keyframes dgOrbit { to { stroke-dashoffset: -110; } }
.dg-pulse { animation: dgPulse 3.2s ease-in-out infinite; }
@keyframes dgPulse { 0%, 100% { opacity: .2; } 50% { opacity: .95; } }

/* ---------- micro visuals ---------- */
.viz { width: 120px; height: 64px; display: block; overflow: visible; }
.viz-slot { fill: none; stroke: rgba(255,255,255,.18); stroke-width: 1; }
.viz-long { fill: rgba(255,255,255,.16); }
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
.viz-t { font-family: var(--sans); font-size: 12px; }
.viz-t.err { fill: #e5624a; } .viz-t.ok { fill: var(--green); }
.viz-t.cite { fill: var(--amber); font-size: 12px; }
.viz-bar { fill: var(--amber); opacity: .8; animation: vBar 1.1s infinite ease-in-out; transform-origin: center; }
.viz-bar.b1 { animation-delay: .1s; } .viz-bar.b2 { animation-delay: .2s; }
.viz-bar.b3 { animation-delay: .3s; } .viz-bar.b4 { animation-delay: .4s; }
@keyframes vBar { 0%,100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
.viz-line { fill: rgba(255,255,255,.5); opacity: 0; animation: vShort 3.2s infinite; }
.viz-line.l1 { animation-delay: .2s; } .viz-line.l2 { animation-delay: .4s; }
.viz-tag { fill: none; stroke: var(--amber); stroke-width: 1; opacity: 0; animation: vTag 3.4s infinite; }
.viz-tag.t1 { animation-delay: .3s; } .viz-tag.t2 { animation-delay: .6s; }
@keyframes vTag { 0% { opacity: 0; transform: translateX(10px);} 20%,85% { opacity: 1; transform: none;} 100% { opacity: 0; } }
.viz-node { fill: rgba(255,255,255,.45); }
.viz-node.hot { fill: var(--amber); }
.viz-node.dim { fill: rgba(242,165,60,.45); }
.viz-node-box { fill: none; stroke: rgba(255,255,255,.3); stroke-width: 1; }
.viz-edge { stroke: var(--amber); stroke-width: 1; stroke-dasharray: 80; stroke-dashoffset: 80; animation: vDraw 3s infinite; }
.viz-edge.e1 { animation-delay: .25s; } .viz-edge.e2 { animation-delay: .5s; }
@keyframes vDraw { 0% { stroke-dashoffset: 80; } 35%,85% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; opacity: 0; } }
.viz-src { fill: none; stroke: rgba(255,255,255,.25); stroke-width: 1; opacity: 0; animation: vTag 3.6s infinite; }
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
.viz-lock, .viz-lock-arc { fill: none; stroke: rgba(255,255,255,.55); stroke-width: 1.2; }
.viz-cell { fill: rgba(255,255,255,.14); }
.viz-cell.on { fill: var(--amber); animation: vCell 2.6s infinite; }
@keyframes vCell { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
.viz-box { fill: none; stroke: rgba(255,255,255,.3); stroke-width: 1; }
.viz-tick { fill: none; stroke: var(--green); stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 14; stroke-dashoffset: 14; animation: vTick 3.4s infinite; }
.viz-tick.k1 { animation-delay: .35s; } .viz-tick.k2 { animation-delay: .7s; }
@keyframes vTick { 0%,10% { stroke-dashoffset: 14; } 28%,88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 14; } }

`;
