import { useCallback, useEffect, useRef, useState } from "react";
import { setLandingActive } from "@/lib/landingMode";

/* ------------------------------------------------------------------ *
 * Fart Brains — landing page.
 *
 * Deliberately self-contained: it does not use the app's design tokens
 * or shadcn primitives, so restyling the app never silently restyles
 * the marketing page (and vice versa). Everything here is hand-rolled
 * CSS + one canvas; no new dependencies.
 * ------------------------------------------------------------------ */

const NEON = "#8b5cf6";
const CYAN = "#22d3ee";
const LIME = "#a3e635";

/* ---------------------------- neural canvas ---------------------------- */

type Node = { x: number; y: number; vx: number; vy: number; r: number };

const NeuralField = () => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let nodes: Node[] = [];
    let w = 0;
    let h = 0;

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(28, Math.min(90, Math.round((w * h) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 1.8,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const p = pointer.current;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        // gentle attraction toward the cursor, so the field "thinks" at you
        const dx = p.x - n.x;
        const dy = p.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 40000 && d2 > 1) {
          const f = 0.00035;
          n.vx += dx * f;
          n.vy += dy * f;
        }
        n.vx = Math.max(-0.9, Math.min(0.9, n.vx * 0.995));
        n.vy = Math.max(-0.9, Math.min(0.9, n.vy * 0.995));
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist > 130) continue;
          ctx.strokeStyle = `rgba(139,92,246,${(1 - dist / 130) * 0.35})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        const near = Math.hypot(p.x - n.x, p.y - n.y) < 140;
        ctx.fillStyle = near ? CYAN : "rgba(226,232,240,0.75)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      pointer.current = { x: -9999, y: -9999 };
    };

    seed();
    if (reduced) {
      draw();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }
    window.addEventListener("resize", seed);
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", seed);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="fb-canvas" aria-hidden="true" />;
};

/* ------------------------- scroll reveal helper ------------------------- */

const Reveal = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fb-reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

/* --------------------------- interactive demo --------------------------- */

const DEMO_STEPS = [
  {
    label: "Paste a link",
    input: "https://youtu.be/a-video-you-will-never-rewatch",
    title: "Cold email teardown",
    folder: "Marketing",
    bullets: [
      "Lead with the recipient's problem, not your product.",
      "One ask per email — pick the smallest possible yes.",
      "Follow up 3x; 70% of replies come after the first send.",
    ],
  },
  {
    label: "Dump a transcript",
    input: "so the trick is you never batch the requests, you stream them and…",
    title: "Streaming > batching",
    folder: "Engineering",
    bullets: [
      "Stream partial results so the UI never sits blank.",
      "Batching hides latency spikes until they're unfixable.",
      "Backpressure is the whole game at 10k concurrent.",
    ],
  },
  {
    label: "Type a shower thought",
    input: "vending machine but it only sells things you forgot to buy",
    title: "Forgot-it vending",
    folder: "Ideas",
    bullets: [
      "Sits by the exit of every grocery store.",
      "Stocks the 12 things people drive back for.",
      "Margin is the convenience, not the goods.",
    ],
  },
];

const CaptureDemo = () => {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "done">("typing");
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    clearTimers();
    const target = DEMO_STEPS[step].input;
    setTyped("");
    setPhase("typing");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setTyped(target);
      setPhase("done");
      return clearTimers;
    }

    for (let i = 1; i <= target.length; i++) {
      timers.current.push(
        window.setTimeout(() => setTyped(target.slice(0, i)), i * 22),
      );
    }
    const end = target.length * 22;
    timers.current.push(window.setTimeout(() => setPhase("thinking"), end + 250));
    timers.current.push(window.setTimeout(() => setPhase("done"), end + 1400));
    timers.current.push(
      window.setTimeout(() => setStep((s) => (s + 1) % DEMO_STEPS.length), end + 5200),
    );
    return clearTimers;
  }, [step, clearTimers]);

  const s = DEMO_STEPS[step];

  return (
    <div className="fb-demo">
      <div className="fb-demo-tabs" role="tablist" aria-label="Capture examples">
        {DEMO_STEPS.map((d, i) => (
          <button
            key={d.label}
            role="tab"
            aria-selected={i === step}
            className={`fb-demo-tab ${i === step ? "is-active" : ""}`}
            onClick={() => setStep(i)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="fb-demo-window">
        <div className="fb-demo-bar">
          <span className="fb-dot" style={{ background: "#ff5f57" }} />
          <span className="fb-dot" style={{ background: "#febc2e" }} />
          <span className="fb-dot" style={{ background: "#28c840" }} />
          <span className="fb-demo-title">Fart Brains — Capture</span>
        </div>

        <div className="fb-demo-body">
          <div className="fb-demo-input">
            <span className="fb-demo-caret-line">{typed}</span>
            {phase === "typing" && <span className="fb-caret" />}
          </div>

          <div className={`fb-demo-out ${phase === "done" ? "is-in" : ""}`}>
            {phase === "thinking" ? (
              <div className="fb-thinking">
                <span />
                <span />
                <span />
                <em>reading it so you don't have to…</em>
              </div>
            ) : phase === "done" ? (
              <div className="fb-card">
                <div className="fb-card-head">
                  <strong>{s.title}</strong>
                  <span className="fb-chip">{s.folder}</span>
                </div>
                <ul>
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <div className="fb-card-foot">saved · searchable forever</div>
              </div>
            ) : (
              <div className="fb-thinking fb-thinking--idle">&nbsp;</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* --------------------------------- FAQ --------------------------------- */

const FAQS: [string, string][] = [
  [
    "Why is it called Fart Brains?",
    "Because that is what your brain does with a good idea if you don't write it down: releases it into the air, never to be recovered. The name is a reminder, not a joke. Okay, it's mostly a joke.",
  ],
  [
    "Is my stuff private?",
    "Yes. It's a single-user vault behind your own login. No feed, no sharing, no team workspace, nobody's algorithm reading your half-formed thoughts.",
  ],
  [
    "What can it actually swallow?",
    "Typed notes, pasted URLs, and pasted transcripts from anywhere — video, podcast, a chat you exported. It extracts the text, summarizes it, and files it.",
  ],
  [
    "Does it run offline / on desktop?",
    "There's a desktop build alongside the web app, so the vault sits in your dock like a real application instead of tab number forty-one.",
  ],
];

const Faq = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="fb-faq">
      {FAQS.map(([q, a], i) => (
        <div key={q} className={`fb-faq-item ${open === i ? "is-open" : ""}`}>
          <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span>{q}</span>
            <em aria-hidden="true">{open === i ? "–" : "+"}</em>
          </button>
          <div className="fb-faq-body">
            <p>{a}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* -------------------------------- page -------------------------------- */

const FEATURES = [
  {
    k: "01",
    t: "Catch it in one motion",
    d: "Paste a link, drop a transcript, or type the thought raw. No form, no folder prompt, no six-field metadata ritual. One box, one keystroke, gone from your head and into the vault.",
    accent: NEON,
  },
  {
    k: "02",
    t: "It reads the boring part",
    d: "The AI pulls the actual substance out of a 40-minute video or a wall of text and leaves you three lines you'd actually reread. The original is kept underneath, in case you don't trust it yet.",
    accent: CYAN,
  },
  {
    k: "03",
    t: "Folders that stay shallow",
    d: "Real folders. Not tags, not a graph you have to garden, not a database with seventeen views. You will find the thing in two clicks because there are only ever two clicks.",
    accent: LIME,
  },
  {
    k: "04",
    t: "Search that hits",
    d: "Type half a word you half-remember. The idea surfaces with its summary, its source, and the date you had it — which is usually the detail that unlocks the rest.",
    accent: "#f472b6",
  },
];

const Landing = ({ onEnter }: { onEnter?: () => void }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The app shell locks body/#root to the viewport (it's a desktop-style
  // window). The landing page is a long scrolling document, so it unlocks
  // page scroll for as long as it's mounted, and hides the app chrome.
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
    document.title = "Fart Brains — the vault for ideas your brain leaks";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      <header className={`fb-nav ${scrolled ? "is-stuck" : ""}`}>
        <a className="fb-brand" href="#top">
          <span className="fb-brand-mark" aria-hidden="true">
            <span />
          </span>
          Fart&nbsp;Brains
        </a>
        <nav>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button type="button" className="fb-btn fb-btn--sm" onClick={onEnter}>
          Open the vault
        </button>
      </header>

      <main id="top">
        {/* ------------------------------ hero ------------------------------ */}
        <section className="fb-hero">
          <NeuralField />
          <div className="fb-hero-glow" aria-hidden="true" />
          <div className="fb-hero-inner">
            <div className="fb-eyebrow">
              <span className="fb-pulse" aria-hidden="true" /> single-user · private · yours
            </div>

            <h1 className="fb-h1">
              Your best ideas
              <br />
              <span className="fb-strike">evaporate</span>{" "}
              <span className="fb-grad">at 2am.</span>
            </h1>

            <p className="fb-sub">
              Fart Brains is a private vault that catches the thought the second you have
              it — typed, pasted, or ripped out of a link — summarizes it, files it, and
              hands it back the day you actually need it.
            </p>

            <div className="fb-cta-row">
              <button type="button" className="fb-btn" onClick={onEnter}>
                Start hoarding ideas
                <span aria-hidden="true">→</span>
              </button>
              <a href="#how" className="fb-btn fb-btn--ghost">
                See it work
              </a>
            </div>

            <div className="fb-stats">
              <div>
                <strong>1</strong>
                <span>box to capture anything</span>
              </div>
              <div>
                <strong>~3s</strong>
                <span>link to filed summary</span>
              </div>
              <div>
                <strong>0</strong>
                <span>people who can read it</span>
              </div>
            </div>
          </div>

          <div className="fb-marquee" aria-hidden="true">
            <div className="fb-marquee-track">
              {Array.from({ length: 2 }).map((_, dup) => (
                <span key={dup}>
                  {[
                    "shower thought",
                    "youtube rabbit hole",
                    "podcast tangent",
                    "3am voice memo",
                    "half-read article",
                    "tiktok you saved and never reopened",
                    "argument you won in your head",
                    "the good one you forgot",
                  ].map((w) => (
                    <em key={w}>
                      {w} <i>✦</i>
                    </em>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------ how ------------------------------- */}
        <section id="how" className="fb-section">
          <Reveal>
            <p className="fb-kicker">How it works</p>
            <h2 className="fb-h2">
              Paste garbage in. <span className="fb-grad">Get a memory out.</span>
            </h2>
            <p className="fb-lead">
              Watch it happen. This is the real flow, just running by itself.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <CaptureDemo />
          </Reveal>
        </section>

        {/* ---------------------------- features ---------------------------- */}
        <section id="features" className="fb-section">
          <Reveal>
            <p className="fb-kicker">What's inside</p>
            <h2 className="fb-h2">
              Four things, done properly.
              <br />
              <span className="fb-muted">Nothing else, on purpose.</span>
            </h2>
          </Reveal>

          <div className="fb-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.k} delay={i * 90}>
                <article
                  className="fb-feature"
                  style={{ ["--accent" as string]: f.accent }}
                >
                  <span className="fb-feature-k">{f.k}</span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                  <span className="fb-feature-line" aria-hidden="true" />
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ----------------------------- contrast ---------------------------- */}
        <section className="fb-section">
          <Reveal>
            <div className="fb-compare">
              <div className="fb-compare-col fb-compare-col--bad">
                <h3>Where ideas go now</h3>
                <ul>
                  <li>17 open tabs you're "getting to"</li>
                  <li>A notes app with 400 untitled files</li>
                  <li>Saved reels you will never open again</li>
                  <li>Texting yourself, then losing the thread</li>
                  <li>Your memory, which is lying to you</li>
                </ul>
              </div>
              <div className="fb-compare-vs" aria-hidden="true">
                vs
              </div>
              <div className="fb-compare-col fb-compare-col--good">
                <h3>Where they go here</h3>
                <ul>
                  <li>One box, any format, three seconds</li>
                  <li>Summarized down to the part that mattered</li>
                  <li>Filed in a folder you'd actually name</li>
                  <li>Findable by half a remembered word</li>
                  <li>Still there in a year</li>
                </ul>
              </div>
            </div>
          </Reveal>
        </section>

        {/* -------------------------------- faq ------------------------------ */}
        <section id="faq" className="fb-section fb-section--narrow">
          <Reveal>
            <p className="fb-kicker">Questions</p>
            <h2 className="fb-h2">The obvious ones.</h2>
          </Reveal>
          <Reveal delay={100}>
            <Faq />
          </Reveal>
        </section>

        {/* ------------------------------- cta ------------------------------- */}
        <section className="fb-final">
          <div className="fb-final-glow" aria-hidden="true" />
          <Reveal>
            <h2 className="fb-h1 fb-h1--sm">
              Stop losing the good ones.
            </h2>
            <p className="fb-sub">
              The vault takes about eleven seconds to set up and then quietly saves you
              from yourself forever.
            </p>
            <button type="button" className="fb-btn fb-btn--lg" onClick={onEnter}>
              Open the vault
              <span aria-hidden="true">→</span>
            </button>
          </Reveal>
        </section>
      </main>

      <footer className="fb-footer">
        <span>Fart Brains — a private idea vault.</span>
        <span className="fb-footer-links">
          <button type="button" className="fb-footer-btn" onClick={onEnter}>
            Open the vault
          </button>
          <a href="#top">Back to top</a>
        </span>
      </footer>
    </div>
  );
};

export default Landing;

/* -------------------------------- styles -------------------------------- */

const CSS = `
html.fb-landing,
html.fb-landing body,
html.fb-landing #root {
  height: auto !important;
  min-height: 100%;
  max-width: none !important;
  width: auto !important;
  overflow: visible !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  scroll-behavior: smooth;
}
html.fb-landing body::before { display: none !important; }

.fb-root {
  --ink: #f4f4f5;
  --dim: #a1a1aa;
  --edge: rgba(255,255,255,0.10);
  --bg: #08070d;
  position: relative;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
.fb-root *, .fb-root *::before, .fb-root *::after { box-sizing: border-box; }
.fb-root a { color: inherit; text-decoration: none; }

/* nav */
.fb-nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 24px;
  padding: 16px clamp(16px, 5vw, 56px);
  transition: background .3s ease, border-color .3s ease, backdrop-filter .3s ease;
  border-bottom: 1px solid transparent;
}
.fb-nav.is-stuck {
  background: rgba(8,7,13,0.72);
  backdrop-filter: blur(14px);
  border-bottom-color: var(--edge);
}
.fb-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: "Space Grotesk", Inter, sans-serif;
  font-weight: 700; letter-spacing: -0.02em; font-size: 17px;
  margin-right: auto;
}
.fb-brand-mark {
  width: 26px; height: 26px; border-radius: 9px;
  background: linear-gradient(135deg, ${NEON}, ${CYAN});
  display: grid; place-items: center;
  box-shadow: 0 0 22px rgba(139,92,246,0.55);
}
.fb-brand-mark span {
  width: 9px; height: 9px; border-radius: 50%;
  background: #08070d;
  animation: fb-blink 3.4s ease-in-out infinite;
}
@keyframes fb-blink { 0%,92%,100%{transform:scale(1)} 96%{transform:scale(0.35)} }
.fb-nav nav { display: none; gap: 26px; font-size: 14px; color: var(--dim); }
.fb-nav nav a:hover { color: var(--ink); }
@media (min-width: 860px) { .fb-nav nav { display: flex; } }

/* buttons */
.fb-btn {
  font: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 22px; border-radius: 999px;
  font-size: 15px; font-weight: 600; white-space: nowrap;
  color: #0a0a0f;
  background: linear-gradient(120deg, #ffffff, #d8d4ff);
  border: 1px solid rgba(255,255,255,0.9);
  transition: transform .18s ease, box-shadow .25s ease;
  box-shadow: 0 8px 30px rgba(139,92,246,0.25);
}
.fb-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 44px rgba(139,92,246,0.45); }
.fb-btn:active { transform: translateY(0); }
.fb-btn--sm { padding: 9px 16px; font-size: 13.5px; }
.fb-btn--lg { padding: 17px 30px; font-size: 17px; }
.fb-btn--ghost {
  background: transparent; color: var(--ink);
  border: 1px solid var(--edge); box-shadow: none;
}
.fb-btn--ghost:hover { border-color: rgba(255,255,255,0.35); box-shadow: none; }

/* hero */
.fb-hero { position: relative; padding: clamp(56px, 10vw, 120px) clamp(16px,5vw,56px) 0; overflow: hidden; }
.fb-canvas { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.55; }
.fb-hero-glow {
  position: absolute; left: 50%; top: -140px; transform: translateX(-50%);
  width: min(1100px, 130vw); height: 620px; pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(139,92,246,0.30), transparent 62%);
  filter: blur(20px);
}
.fb-hero-inner { position: relative; max-width: 900px; margin: 0 auto; text-align: center; }
.fb-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 15px; border-radius: 999px;
  border: 1px solid var(--edge); background: rgba(255,255,255,0.04);
  font-size: 12.5px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--dim);
}
.fb-pulse {
  width: 7px; height: 7px; border-radius: 50%; background: ${LIME};
  box-shadow: 0 0 0 0 rgba(163,230,53,0.7); animation: fb-pulse 2.2s infinite;
}
@keyframes fb-pulse { 70% { box-shadow: 0 0 0 9px rgba(163,230,53,0); } 100% { box-shadow: 0 0 0 0 rgba(163,230,53,0); } }

.fb-h1 {
  margin: 26px 0 0;
  font-family: "Space Grotesk", Inter, sans-serif;
  font-size: clamp(42px, 8.2vw, 92px);
  line-height: 0.98; letter-spacing: -0.045em; font-weight: 700;
}
.fb-h1--sm { font-size: clamp(34px, 6vw, 68px); }
.fb-strike { position: relative; white-space: nowrap; }
.fb-strike::after {
  content: ""; position: absolute; left: -2%; right: -2%; top: 56%; height: 5px;
  background: linear-gradient(90deg, ${NEON}, ${CYAN});
  border-radius: 4px; transform-origin: left; animation: fb-strike 1.1s .5s cubic-bezier(.2,.8,.2,1) both;
}
@keyframes fb-strike { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.fb-grad {
  background: linear-gradient(100deg, ${NEON}, ${CYAN} 45%, ${LIME});
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.fb-muted { color: var(--dim); }
.fb-sub {
  margin: 22px auto 0; max-width: 620px;
  font-size: clamp(16px, 2.1vw, 19px); line-height: 1.6; color: var(--dim);
}
.fb-cta-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 34px; }
.fb-stats {
  display: flex; flex-wrap: wrap; justify-content: center; gap: clamp(20px, 6vw, 64px);
  margin-top: 56px; padding-top: 30px; border-top: 1px solid var(--edge);
}
.fb-stats div { display: grid; gap: 4px; }
.fb-stats strong {
  font-family: "Space Grotesk", Inter, sans-serif; font-size: 30px; letter-spacing: -0.03em;
}
.fb-stats span { font-size: 13px; color: var(--dim); }

/* marquee */
.fb-marquee {
  position: relative; margin-top: clamp(50px, 8vw, 90px);
  padding: 14px 0; border-top: 1px solid var(--edge); border-bottom: 1px solid var(--edge);
  overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
}
.fb-marquee-track { display: flex; width: max-content; animation: fb-scroll 42s linear infinite; }
.fb-marquee-track > span { display: flex; }
.fb-marquee em {
  display: inline-flex; align-items: center; gap: 18px; padding: 0 18px;
  font-style: normal; font-size: 14px; color: var(--dim); white-space: nowrap;
}
.fb-marquee i { color: ${NEON}; font-style: normal; }
@keyframes fb-scroll { to { transform: translateX(-50%); } }

/* sections */
.fb-section { position: relative; max-width: 1120px; margin: 0 auto; padding: clamp(70px, 11vw, 130px) clamp(16px,5vw,56px); }
.fb-section--narrow { max-width: 760px; }
.fb-kicker {
  margin: 0 0 14px; font-size: 12.5px; letter-spacing: 0.16em; text-transform: uppercase; color: ${NEON};
}
.fb-h2 {
  margin: 0; font-family: "Space Grotesk", Inter, sans-serif;
  font-size: clamp(30px, 4.6vw, 50px); line-height: 1.06; letter-spacing: -0.035em; font-weight: 700;
}
.fb-lead { margin: 16px 0 0; color: var(--dim); font-size: 16.5px; max-width: 520px; }

/* reveal */
.fb-reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1); }
.fb-reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .fb-reveal { opacity: 1; transform: none; transition: none; }
  .fb-marquee-track, .fb-brand-mark span, .fb-pulse, .fb-strike::after { animation: none; }
}

/* demo */
.fb-demo { margin-top: 34px; }
.fb-demo-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.fb-demo-tab {
  padding: 8px 15px; border-radius: 999px; cursor: pointer;
  font: inherit; font-size: 13.5px; color: var(--dim);
  background: rgba(255,255,255,0.03); border: 1px solid var(--edge);
  transition: color .2s, border-color .2s, background .2s;
}
.fb-demo-tab:hover { color: var(--ink); }
.fb-demo-tab.is-active { color: #0a0a0f; background: #fff; border-color: #fff; font-weight: 600; }
.fb-demo-window {
  border: 1px solid var(--edge); border-radius: 18px; overflow: hidden;
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  box-shadow: 0 30px 90px rgba(0,0,0,0.55);
}
.fb-demo-bar {
  display: flex; align-items: center; gap: 7px;
  padding: 11px 14px; border-bottom: 1px solid var(--edge); background: rgba(255,255,255,0.03);
}
.fb-dot { width: 10px; height: 10px; border-radius: 50%; }
.fb-demo-title { margin-left: 12px; font-size: 12.5px; color: var(--dim); }
.fb-demo-body { padding: clamp(18px, 3vw, 28px); display: grid; gap: 18px; }
.fb-demo-input {
  min-height: 56px; padding: 15px 17px; border-radius: 13px;
  border: 1px solid rgba(139,92,246,0.45); background: rgba(139,92,246,0.07);
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13.5px;
  color: var(--ink); word-break: break-all; line-height: 1.6;
}
.fb-caret { display: inline-block; width: 8px; height: 15px; margin-left: 2px; vertical-align: -2px; background: ${CYAN}; animation: fb-caret 1s steps(2) infinite; }
@keyframes fb-caret { 50% { opacity: 0; } }
.fb-demo-out { min-height: 172px; }
.fb-thinking { display: flex; align-items: center; gap: 7px; padding: 14px 4px; color: var(--dim); font-size: 14px; }
.fb-thinking span { width: 7px; height: 7px; border-radius: 50%; background: ${CYAN}; animation: fb-bounce 1s infinite; }
.fb-thinking span:nth-child(2) { animation-delay: .15s; }
.fb-thinking span:nth-child(3) { animation-delay: .3s; }
.fb-thinking em { margin-left: 8px; font-style: italic; }
.fb-thinking--idle { visibility: hidden; }
@keyframes fb-bounce { 0%,60%,100% { transform: translateY(0); opacity:.5 } 30% { transform: translateY(-6px); opacity:1 } }
.fb-card {
  padding: 18px; border-radius: 14px;
  border: 1px solid var(--edge); background: rgba(255,255,255,0.04);
  animation: fb-pop .45s cubic-bezier(.2,.8,.2,1) both;
}
@keyframes fb-pop { from { opacity: 0; transform: translateY(10px) scale(.985); } }
.fb-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.fb-card-head strong { font-family: "Space Grotesk", Inter, sans-serif; font-size: 17px; }
.fb-chip {
  padding: 4px 11px; border-radius: 999px; font-size: 12px;
  color: ${LIME}; border: 1px solid rgba(163,230,53,0.35); background: rgba(163,230,53,0.08);
}
.fb-card ul { margin: 0; padding-left: 18px; list-style: disc; display: grid; gap: 7px; color: var(--dim); font-size: 14.5px; line-height: 1.5; }
.fb-card-foot { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--edge); font-size: 12.5px; color: #71717a; }

/* features */
.fb-grid { display: grid; gap: 16px; margin-top: 42px; grid-template-columns: 1fr; }
@media (min-width: 800px) { .fb-grid { grid-template-columns: 1fr 1fr; } }
.fb-feature {
  position: relative; height: 100%; padding: 28px 26px 30px;
  border: 1px solid var(--edge); border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012));
  overflow: hidden; transition: border-color .3s ease, transform .3s ease;
}
.fb-feature:hover { border-color: color-mix(in srgb, var(--accent) 55%, transparent); transform: translateY(-3px); }
.fb-feature-k {
  font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--accent); letter-spacing: .1em;
}
.fb-feature h3 { margin: 12px 0 10px; font-family: "Space Grotesk", Inter, sans-serif; font-size: 22px; letter-spacing: -0.02em; }
.fb-feature p { margin: 0; color: var(--dim); font-size: 15px; line-height: 1.62; }
.fb-feature-line {
  position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
  background: linear-gradient(90deg, var(--accent), transparent);
  transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.2,.8,.2,1);
}
.fb-feature:hover .fb-feature-line { transform: scaleX(1); }

/* compare */
.fb-compare {
  display: grid; gap: 14px; align-items: stretch;
  grid-template-columns: 1fr;
  border: 1px solid var(--edge); border-radius: 22px; padding: clamp(20px, 3vw, 34px);
  background: radial-gradient(120% 130% at 50% 0%, rgba(139,92,246,0.14), transparent 60%);
}
@media (min-width: 860px) { .fb-compare { grid-template-columns: 1fr auto 1fr; } }
.fb-compare-col { padding: 22px; border-radius: 16px; border: 1px solid var(--edge); background: rgba(255,255,255,0.03); }
.fb-compare-col h3 { margin: 0 0 16px; font-family: "Space Grotesk", Inter, sans-serif; font-size: 19px; }
.fb-compare-col ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 11px; font-size: 15px; color: var(--dim); }
.fb-compare-col li { padding-left: 26px; position: relative; line-height: 1.45; }
.fb-compare-col li::before { position: absolute; left: 0; top: 0; font-size: 15px; }
.fb-compare-col--bad li::before { content: "✕"; color: #f87171; }
.fb-compare-col--good li::before { content: "✓"; color: ${LIME}; }
.fb-compare-col--good { border-color: rgba(163,230,53,0.25); }
.fb-compare-vs {
  display: grid; place-items: center; font-family: "Space Grotesk", Inter, sans-serif;
  color: var(--dim); font-size: 14px; letter-spacing: .2em; text-transform: uppercase;
}

/* faq */
.fb-faq { margin-top: 34px; border-top: 1px solid var(--edge); }
.fb-faq-item { border-bottom: 1px solid var(--edge); }
.fb-faq-item button {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 18px;
  padding: 22px 2px; cursor: pointer; text-align: left;
  background: none; border: 0; color: var(--ink);
  font: inherit; font-size: 17px; font-weight: 600;
  font-family: "Space Grotesk", Inter, sans-serif;
}
.fb-faq-item em { font-style: normal; color: ${NEON}; font-size: 22px; line-height: 1; }
.fb-faq-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s cubic-bezier(.2,.8,.2,1); }
.fb-faq-item.is-open .fb-faq-body { grid-template-rows: 1fr; }
.fb-faq-body p { overflow: hidden; margin: 0; color: var(--dim); font-size: 15.5px; line-height: 1.65; padding-right: 40px; }
.fb-faq-item.is-open .fb-faq-body p { padding-bottom: 22px; }

/* final */
.fb-final { position: relative; text-align: center; padding: clamp(80px, 12vw, 150px) clamp(16px,5vw,56px); overflow: hidden; }
.fb-final-glow {
  position: absolute; left: 50%; bottom: -260px; transform: translateX(-50%);
  width: min(900px, 120vw); height: 520px;
  background: radial-gradient(ellipse at center, rgba(34,211,238,0.22), transparent 65%);
  filter: blur(10px); pointer-events: none;
}
.fb-final .fb-btn { margin-top: 32px; }

/* footer */
.fb-footer {
  display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between;
  padding: 26px clamp(16px,5vw,56px); border-top: 1px solid var(--edge);
  font-size: 13.5px; color: #71717a;
}
.fb-footer-links { display: flex; gap: 20px; }
.fb-footer-links a:hover, .fb-footer-btn:hover { color: var(--ink); }
.fb-footer-btn { font: inherit; cursor: pointer; background: none; border: 0; color: inherit; padding: 0; }
`;
