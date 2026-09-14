import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { setLandingActive } from "@/lib/landingMode";

const chapters = [
  "Capture",
  "Extract",
  "Graph",
  "Ash",
  "Reason",
  "Outcomes",
  "Bridge",
  "Execute",
];
const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type WorldProps = { chapter: number; pulse: number; density: number };

function ThoughtWorld({ chapter, pulse, density }: WorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ chapter, pulse, density });
  stateRef.current = { chapter, pulse, density };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      46,
      innerWidth / innerHeight,
      0.1,
      160,
    );
    camera.position.set(0, 0, 24);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.setSize(innerWidth, innerHeight);

    const world = new THREE.Group();
    scene.add(world);

    const nodeCount = 180;
    const positions = new Float32Array(nodeCount * 3);
    const base = new Float32Array(nodeCount * 3);
    const colors = new Float32Array(nodeCount * 3);
    const violet = new THREE.Color("#9d7cff");
    const cyan = new THREE.Color("#35d8ff");
    const white = new THREE.Color("#e9e7ff");

    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
      const theta = i * 2.399963;
      const radius = 5.3 + (i % 7) * 0.16;
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.cos(phi) * radius * 0.78;
      const z = Math.sin(phi) * Math.sin(theta) * radius;
      positions.set([x, y, z], i * 3);
      base.set([x, y, z], i * 3);
      const color = i % 11 === 0 ? white : i % 3 === 0 ? cyan : violet;
      colors.set([color.r, color.g, color.b], i * 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.105,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    world.add(points);

    const edgePositions: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      for (const step of [3, 13]) {
        const j = (i + step) % nodeCount;
        edgePositions.push(
          base[i * 3],
          base[i * 3 + 1],
          base[i * 3 + 2],
          base[j * 3],
          base[j * 3 + 1],
          base[j * 3 + 2],
        );
      }
    }
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(edgePositions, 3),
      ),
      new THREE.LineBasicMaterial({
        color: 0x8567ee,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
      }),
    );
    world.add(lines);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      new THREE.MeshBasicMaterial({
        color: 0x9d7cff,
        wireframe: true,
        transparent: true,
        opacity: 0.88,
      }),
    );
    world.add(core);

    const rings = new THREE.Group();
    for (let r = 0; r < 4; r++) {
      const curve: THREE.Vector3[] = [];
      for (let n = 0; n <= 160; n++) {
        const a = (n / 160) * Math.PI * 2;
        curve.push(
          new THREE.Vector3(
            Math.cos(a) * (6.4 + r * 0.34),
            Math.sin(a) * (6.4 + r * 0.34),
            0,
          ),
        );
      }
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve),
        new THREE.LineBasicMaterial({
          color: r === 0 ? 0x35d8ff : 0x684bbd,
          transparent: true,
          opacity: r === 0 ? 0.23 : 0.1,
        }),
      );
      ring.rotation.set(0.45 + r * 0.52, r * 0.72, r * 0.19);
      rings.add(ring);
    }
    world.add(rings);

    const dustPositions = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      dustPositions.set(
        [
          (Math.random() - 0.5) * 70,
          (Math.random() - 0.5) * 42,
          -12 + Math.random() * 18,
        ],
        i * 3,
      );
    }
    const dust = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(dustPositions, 3),
      ),
      new THREE.PointsMaterial({
        color: 0x6a58a3,
        size: 0.035,
        transparent: true,
        opacity: 0.45,
      }),
    );
    scene.add(dust);

    const pointer = { x: 0, y: 0 };
    const onPointer = (event: PointerEvent) => {
      pointer.x = event.clientX / innerWidth - 0.5;
      pointer.y = event.clientY / innerHeight - 0.5;
    };
    const onResize = () => {
      renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth / innerHeight;
      camera.fov = innerWidth < 720 ? 56 : 46;
      camera.updateProjectionMatrix();
    };
    addEventListener("pointermove", onPointer, { passive: true });
    addEventListener("resize", onResize);

    let raf = 0;
    let time = 0;
    const quiet = reducedMotion();
    const draw = () => {
      const { chapter: c, pulse: p, density: d } = stateRef.current;
      if (!quiet) time += 0.006;
      const targetScale = 0.82 + c * 0.13;
      world.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.035,
      );
      world.rotation.y += quiet ? 0 : 0.0014 + c * 0.00015;
      world.rotation.x = Math.sin(time * 0.7) * 0.075;
      lines.material.opacity = 0.035 + (d / 100) * 0.2;
      core.rotation.x += quiet ? 0 : 0.007;
      core.rotation.y += quiet ? 0 : 0.009;
      const beat = 1 + Math.sin(time * 5 + p * 4) * 0.09 + p * 0.18;
      core.scale.setScalar(beat);
      rings.rotation.z += quiet ? 0 : 0.0018;
      dust.rotation.y -= quiet ? 0 : 0.00018;

      const spread = c >= 2 ? Math.min(1, (c - 1) * 0.32) : 0;
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < nodeCount; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const bz = base[i * 3 + 2];
        const lane = ((i % 6) - 2.5) * spread * 1.6;
        pos.setXYZ(i, bx + lane, by + Math.sin(time * 2 + i) * 0.035, bz);
      }
      pos.needsUpdate = true;

      camera.position.x += (pointer.x * 1.2 - camera.position.x) * 0.025;
      camera.position.y += (-pointer.y * 0.7 - camera.position.y) * 0.025;
      camera.position.z +=
        ((innerWidth < 720 ? 27 : 24) + c * 1.05 - camera.position.z) * 0.028;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onPointer);
      removeEventListener("resize", onResize);
      geometry.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fb-world"
      aria-label="Interactive three-dimensional map of captured and connected ideas"
    />
  );
}

function CaptureTerminal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!open) return;
    setPhase(0);
    const timers = [700, 1500, 2400, 3400].map((ms, i) =>
      window.setTimeout(() => setPhase(i + 1), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [open]);
  if (!open) return null;
  const states = [
    "Reading source",
    "Mapping creator corpus",
    "Researching 12 sources",
    "Compiling decision rules",
    "Execution package ready",
  ];
  return (
    <div
      className="fb-terminal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Live Fartbrain capture simulation"
    >
      <div className="fb-terminal">
        <header>
          <b>FARTBRAIN / LIVE CAPTURE</b>
          <span>SIMULATION</span>
          <button onClick={onClose}>CLOSE ×</button>
        </header>
        <div className="fb-terminal-grid">
          <div className="fb-terminal-source">
            <small>SOURCE / INSTAGRAM REEL</small>
            <h3>Competitor keywords for cheaper paid acquisition</h3>
            <p>
              “Use this same signal for SEO. Decide whether every opportunity
              should become an ad, a page, or both.”
            </p>
          </div>
          <div className="fb-terminal-state">
            <small>PIPELINE STATUS</small>
            <strong>{states[phase]}</strong>
            <div>
              {states.map((state, i) => (
                <span key={state} className={i <= phase ? "done" : ""}>
                  {String(i + 1).padStart(2, "0")} {state}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={`fb-terminal-result ${phase === 4 ? "visible" : ""}`}>
          <small>EVERY OUTCOME READY</small>
          <h2>Competitor Signal Engine</h2>
          <div>
            <span>PRODUCT BRIEF</span>
            <span>RESEARCH PACK</span>
            <span>MVP SPEC</span>
            <span>BUILD PROMPT</span>
            <span>REASONING RULES</span>
          </div>
          <button className="fb-connect-mcp">
            ACTUAL BUILD <b>CONNECT PROJECT VIA MCP →</b>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingCinematic({
  onEnter,
}: {
  onEnter?: () => void;
}) {
  const [chapter, setChapter] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [density, setDensity] = useState(68);
  const [terminal, setTerminal] = useState(false);
  const sections = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    setLandingActive(true);
    document.documentElement.classList.add("fb-cinema-route", "route-wide");
    const oldTitle = document.title;
    document.title =
      "Fartbrain — turn fleeting thoughts into things you can build";
    const onScroll = () => {
      const middle = innerHeight * 0.52;
      let next = 0;
      sections.current.forEach((section, i) => {
        if (section && section.getBoundingClientRect().top <= middle) next = i;
      });
      setChapter(next);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      removeEventListener("scroll", onScroll);
      setLandingActive(false);
      document.documentElement.classList.remove(
        "fb-cinema-route",
        "route-wide",
      );
      document.title = oldTitle;
    };
  }, []);

  const sectionRef = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      sections.current[index] = node;
    },
    [],
  );
  const run = () => {
    setPulse((v) => v + 1);
    setTerminal(true);
  };
  const relationshipNodes = [
    {
      threshold: 12,
      meta: "3 MONTHS AGO · PAID ADS",
      text: "Competitor keyword gaps expose underpriced intent.",
    },
    {
      threshold: 28,
      meta: "6 WEEKS AGO · SEO",
      text: "Adjacent rankings are the fastest pages to expand.",
    },
    {
      threshold: 44,
      meta: "TODAY · YOUR TWEAK",
      text: "One engine decides: ad, page, or both.",
    },
    {
      threshold: 60,
      meta: "CREATOR MAP · RECURRING STRATEGY",
      text: "The creator repeatedly routes demand signals by purchase intent.",
    },
    {
      threshold: 76,
      meta: "RESEARCH · CORROBORATING SIGNAL",
      text: "Organic pages reduce paid dependency when the query compounds.",
    },
    {
      threshold: 92,
      meta: "PROJECT · MISSING CONNECTION",
      text: "The current workflow never compares paid and organic opportunity.",
    },
  ];
  const visibleRelationshipNodes = relationshipNodes.filter(
    (node) => density >= node.threshold,
  );

  return (
    <div className="fbc">
      <style>{styles}</style>
      <style>{enhancementStyles}</style>
      <ThoughtWorld chapter={chapter} pulse={pulse} density={density} />
      <div className="fb-vignette" />

      <nav className="fb-cinema-nav">
        <a href="#capture" className="fb-wordmark">
          <i>◫</i> FARTBRAIN
        </a>
        <div>
          {chapters.map((name, i) => (
            <a
              key={name}
              className={chapter === i ? "active" : ""}
              href={`#${name.toLowerCase()}`}
            >
              {String(i + 1).padStart(2, "0")}
            </a>
          ))}
        </div>
        <button onClick={() => onEnter?.()}>OPEN BRAIN ↗</button>
      </nav>

      <aside className="fb-global-status">
        <span>LIVE THOUGHT SYSTEM</span>
        <b>{chapters[chapter]}</b>
      </aside>

      <main>
        <section
          id="capture"
          ref={sectionRef(0)}
          className="fb-chapter fb-opening"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">
              01 / THE THOUGHT BEFORE IT DISAPPEARS
            </span>
            <h1>
              Don&rsquo;t save
              <br />
              the post.
              <br />
              <em>
                Save what it
                <br />
                could become.
              </em>
            </h1>
            <p>
              A reel. A URL. Nine words you typed before the thought vanished.
            </p>
            <button className="fb-primary" onClick={run}>
              Capture this idea <span>↗</span>
            </button>
            <small>RUN THE LIVE SYSTEM · 00:05</small>
          </div>
          <div className="fb-capture-card">
            <small>INCOMING / INSTAGRAM REEL</small>
            <strong>Steal competitor keywords for lower-cost paid ads.</strong>
            <p>YOUR TWEAK</p>
            <b>“Use it for SEO too. Make it one system.”</b>
          </div>
          <footer>
            <span>ONE FLEETING THOUGHT.</span>
            <a href="#extract">SCROLL TO OPEN IT ↓</a>
            <span>01 — 08</span>
          </footer>
        </section>

        <section
          id="extract"
          ref={sectionRef(1)}
          className="fb-chapter fb-extract"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">
              02 / NOTHING USEFUL GETS LEFT BEHIND
            </span>
            <h2>
              The link
              <br />
              <em>opens up.</em>
            </h2>
            <p>
              Transcript. Summary. Claims. Sources. Every useful URL hiding
              underneath the original thought.
            </p>
          </div>
          <div className="fb-extraction-stack">
            <div>
              <span>01</span>
              <b>TRANSCRIPT</b>
              <small>47 seconds → searchable text</small>
            </div>
            <div>
              <span>02</span>
              <b>SUMMARY</b>
              <small>strategy, sequence, why it works</small>
            </div>
            <div>
              <span>03</span>
              <b>DEEP RESEARCH</b>
              <small>12 corroborating sources</small>
            </div>
            <div>
              <span>04</span>
              <b>CREATOR MAP</b>
              <small>extract their other public ideas</small>
            </div>
            <div>
              <span>05</span>
              <b>URL EXTRACTION</b>
              <small>tools, references, datasets</small>
            </div>
          </div>
        </section>

        <section
          id="graph"
          ref={sectionRef(2)}
          className="fb-chapter fb-connect"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">03 / FARTBRAIN IS THE GRAPH</span>
            <h2>
              Everything becomes
              <br />
              connected <em>intelligence.</em>
            </h2>
            <p>
              Fartbrain owns the private graph: its nodes, relationships,
              provenance and reasoning. Notes, creators, research, strategies,
              decisions and outcomes all become part of one living system.
            </p>
            <label>
              GRAPH DETAIL <b>{visibleRelationshipNodes.length} / 6 NODES</b>
              <input
                type="range"
                min="12"
                max="100"
                step="4"
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
              <small>DRAG TO REVEAL WEAKER OR MORE DISTANT CONNECTIONS</small>
            </label>
          </div>
          <div className="fb-related" aria-live="polite">
            {visibleRelationshipNodes.map((node, index) => (
              <article
                key={node.meta}
                className={
                  index === visibleRelationshipNodes.length - 1 ? "newest" : ""
                }
                style={{ "--node-index": index } as CSSProperties}
              >
                <small>{node.meta}</small>
                <b>{node.text}</b>
              </article>
            ))}
            <div>
              <span>{visibleRelationshipNodes.length} NODES VISIBLE</span>
              <strong>{density}% GRAPH DETAIL</strong>
            </div>
          </div>
        </section>

        <section
          id="ash"
          ref={sectionRef(3)}
          className="fb-chapter fb-synthesize"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">04 / ASH</span>
            <h2>
              Talk until
              <br />
              the idea <em>clicks.</em>
            </h2>
            <p>
              Ash enters with the source, research, your note and everything
              related already in context. No cold-start chatbot.
            </p>
            <button className="fb-ghost" onClick={run}>
              Open this conversation ↗
            </button>
          </div>
          <div className="fb-ash">
            <header>
              <span>ASH / IDEA PARTNER</span>
              <b>CONTEXT LOADED</b>
            </header>
            <p>You don&rsquo;t actually have two ideas here.</p>
            <p>
              You have one decision engine: detect the competitor gap, then
              route it to paid ads when intent is immediate or SEO when the
              opportunity compounds.
            </p>
            <div>
              <span>REEL</span>
              <span>12 SOURCES</span>
              <span>7 NOTES</span>
              <span>YOUR RULES</span>
            </div>
          </div>
        </section>

        <section
          id="reason"
          ref={sectionRef(4)}
          className="fb-chapter fb-reason"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">05 / THE REASONING LAYER</span>
            <h2>
              Don&rsquo;t copy
              <br />
              the content.
              <br />
              <em>
                Reconstruct
                <br />
                the operator.
              </em>
            </h2>
            <p>
              Fartbrain extracts what the person notices, which conditions
              change the decision, what they ignore, and what action each
              conclusion produces.
            </p>
          </div>
          <div className="fb-reason-engine">
            <header>
              DETERMINISTIC OUTCOME MODEL <span>COMPILED</span>
            </header>
            <div>
              <small>SIGNAL</small>
              <b>High purchase intent</b>
              <span>→</span>
            </div>
            <div>
              <small>CONDITION</small>
              <b>Organic difficulty is low</b>
              <span>→</span>
            </div>
            <div>
              <small>DECISION</small>
              <b>Publish the SEO page first</b>
              <span>→</span>
            </div>
            <div className="alt">
              <small>ELSE</small>
              <b>Launch a paid-ad test</b>
              <span>→</span>
            </div>
            <footer>
              HUMAN STRATEGY → EXPLICIT RULES → REPEATABLE OUTCOMES
            </footer>
          </div>
        </section>

        <section
          id="outcomes"
          ref={sectionRef(5)}
          className="fb-chapter fb-build"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">06 / EVERY OUTCOME STILL SHIPS</span>
            <h2>
              Not another
              <br />
              summary.
              <br />
              <em>A starting line.</em>
            </h2>
            <p>
              Choose the shape: MVP brief, implementation prompt, workflow,
              agent, skill or operating playbook. Nothing requires a connection
              until you ask Fartbrain to execute it.
            </p>
          </div>
          <div className="fb-build-surface">
            <header>
              COMPETITOR SIGNAL ENGINE <span>READY TO BUILD</span>
            </header>
            {[
              "MVP product brief",
              "System architecture",
              "Research dossier",
              "Implementation prompt",
              "Reusable skill",
            ].map((x, i) => (
              <div key={x}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{x}</b>
                <small>
                  {i === 0 ? "12 sections" : "generated from this idea"}
                </small>
              </div>
            ))}
            <button onClick={run}>INSPECT BUILD PACKAGE ↗</button>
          </div>
        </section>

        <section
          id="bridge"
          ref={sectionRef(6)}
          className="fb-chapter fb-bridge"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">07 / THE ADAPTIVE BRIDGE</span>
            <h2>
              Your brain sees
              <br />
              what the project
              <br />
              <em>is missing.</em>
            </h2>
            <p>
              Connect a project only when you choose. Fartbrain maps its code,
              features, data, workflows and goals into Fartbrain&rsquo;s own
              graph, then finds the logical gap between what exists and what
              should happen next.
            </p>
          </div>
          <div className="fb-bridge-panel">
            <header>
              ADAPTIVE BRIDGE <span>OBSERVE ONLY</span>
            </header>
            <div
              className="fb-bridge-map"
              aria-label="Private intelligence graph connected to a project graph"
            >
              <div className="fb-graph-side private">
                <small>FARTBRAIN / PRIVATE GRAPH</small>
                <b>Strategy</b>
                <b>Creator map</b>
                <b>Decision rule</b>
                <b>Outcome</b>
              </div>
              <div className="fb-bridge-core">
                <i>GAP</i>
                <strong>→</strong>
                <span>IMPROVEMENT</span>
              </div>
              <div className="fb-graph-side project">
                <small>CONNECTED PROJECT</small>
                <b>Feature</b>
                <b>Workflow</b>
                <b>Service</b>
                <b>Goal</b>
              </div>
            </div>
            <div className="fb-recommendation">
              <small>DETECTED / MISSING CONNECTION</small>
              <b>
                Route keyword opportunities into one paid + organic decision
                engine.
              </b>
              <span>EXPECTED OUTCOME · LOWER ACQUISITION COST</span>
            </div>
            <footer>OBSERVE → DETECT → PROPOSE → PREVIEW → APPROVE</footer>
          </div>
        </section>

        <section
          id="execute"
          ref={sectionRef(7)}
          className="fb-chapter fb-final"
        >
          <span className="fb-eyebrow">08 / EXECUTION IS OPTIONAL</span>
          <h2>
            Everything ready.
            <br />
            <em>One connection</em>
            <br />
            from real.
          </h2>
          <p>
            Your outcomes are complete without an integration. Choose Actual
            Build and Fartbrain stops safely at the project boundary until MCP
            or API access is connected, scoped and approved.
          </p>
          <button className="fb-primary" onClick={run}>
            See the execution handoff <span>↗</span>
          </button>
          <footer>
            <a href="#capture">FARTBRAIN.APP</a>
            <span>PRIVATE BY DEFAULT</span>
            <span>
              <Link to="/privacy">PRIVACY</Link> ·{" "}
              <Link to="/terms">TERMS</Link>
            </span>
          </footer>
        </section>
      </main>

      <CaptureTerminal open={terminal} onClose={() => setTerminal(false)} />
    </div>
  );
}

const enhancementStyles = `
.fb-extraction-stack div:nth-child(5){translate:88px;border-color:rgba(164,138,255,.45)}
.fb-reason-engine{width:min(560px,46vw);border:1px solid rgba(53,216,255,.28);background:rgba(8,8,14,.8);backdrop-filter:blur(18px);box-shadow:0 35px 100px -55px rgba(53,216,255,.6)}
.fb-reason-engine header,.fb-reason-engine footer{display:flex;justify-content:space-between;padding:17px 20px;color:#777282;font:700 9px ui-monospace;letter-spacing:.1em}
.fb-reason-engine header span{color:var(--cyan)}
.fb-reason-engine>div{display:grid;grid-template-columns:100px 1fr auto;align-items:center;padding:18px 20px;border-top:1px solid rgba(255,255,255,.09)}
.fb-reason-engine>div small{color:var(--violet);font:700 8px ui-monospace;letter-spacing:.1em}
.fb-reason-engine>div b{font-size:13px}.fb-reason-engine>div span{color:var(--cyan)}
.fb-reason-engine>div.alt{margin-left:100px;border-left:1px solid rgba(164,138,255,.35)}
.fb-reason-engine footer{border-top:1px solid rgba(255,255,255,.09);color:#9a95a7}
.fb-connect-mcp{display:flex;justify-content:space-between;width:100%;margin-top:22px;padding:16px 18px;border:1px solid rgba(53,216,255,.45);background:rgba(53,216,255,.06);color:#fff;font:800 9px ui-monospace;letter-spacing:.1em}
.fb-connect-mcp b{color:var(--cyan)}
.fb-copy label small{display:block;margin-top:12px;color:#5f5a6d;font:700 8px/1.4 ui-monospace;letter-spacing:.08em}
.fb-related{min-height:410px;transition:min-height .25s ease}
.fb-related article{animation:fb-node-in .28s ease both}
.fb-related article.newest{border-color:rgba(53,216,255,.52);box-shadow:0 0 34px rgba(53,216,255,.08)}
@keyframes fb-node-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.fb-reason,.fb-bridge{justify-content:space-between;gap:8vw}
.fb-bridge-panel{width:min(620px,49vw);border:1px solid rgba(164,138,255,.35);background:rgba(8,8,14,.82);backdrop-filter:blur(20px);box-shadow:0 40px 120px -65px rgba(164,138,255,.8)}
.fb-bridge-panel>header,.fb-bridge-panel>footer{display:flex;justify-content:space-between;padding:16px 19px;color:#777282;font:700 9px ui-monospace;letter-spacing:.1em}
.fb-bridge-panel>header span{color:var(--cyan)}
.fb-bridge-panel>footer{border-top:1px solid rgba(255,255,255,.09);color:#8d879a}
.fb-bridge-map{display:grid;grid-template-columns:1fr 105px 1fr;gap:12px;align-items:center;padding:22px 18px;border-top:1px solid rgba(255,255,255,.09);border-bottom:1px solid rgba(255,255,255,.09)}
.fb-graph-side{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.fb-graph-side small{grid-column:1/-1;margin-bottom:5px;color:#777282;font:700 8px ui-monospace;letter-spacing:.08em}
.fb-graph-side b{position:relative;padding:12px 8px;border:1px solid rgba(255,255,255,.1);font-size:10px;font-weight:650;text-align:center;background:rgba(255,255,255,.025)}
.fb-graph-side.private b{border-color:rgba(164,138,255,.28);color:#c5b8ff}.fb-graph-side.project b{border-color:rgba(53,216,255,.2);color:#a7eefe}
.fb-bridge-core{display:grid;justify-items:center;gap:7px;color:var(--cyan);font:800 8px ui-monospace;letter-spacing:.08em}
.fb-bridge-core i{display:grid;place-items:center;width:48px;height:48px;border:1px solid var(--violet);border-radius:50%;color:var(--violet);font-style:normal;box-shadow:0 0 30px rgba(164,138,255,.2)}
.fb-bridge-core strong{font-size:20px}.fb-bridge-core span{font-size:7px}
.fb-recommendation{display:grid;gap:10px;padding:20px 22px}
.fb-recommendation small{color:var(--violet);font:700 8px ui-monospace;letter-spacing:.1em}.fb-recommendation b{font-size:14px;line-height:1.45}.fb-recommendation span{color:#777282;font:700 8px ui-monospace;letter-spacing:.08em}
@media(max-width:760px){.fb-extraction-stack,.fb-related,.fb-ash,.fb-reason-engine,.fb-build-surface,.fb-bridge-panel{width:100%;margin-top:70px}.fb-extraction-stack div:nth-child(5){translate:32px}.fb-reason-engine>div{grid-template-columns:82px 1fr auto}.fb-reason-engine>div.alt{margin-left:20px}.fb-connect-mcp{gap:14px;text-align:left}.fb-bridge-map{grid-template-columns:1fr}.fb-bridge-core{grid-template-columns:auto auto auto;justify-content:center;margin:8px}.fb-bridge-core strong{rotate:90deg}}
`;

const styles = `
html.fb-cinema-route,html.fb-cinema-route body,html.fb-cinema-route #root{height:auto!important;min-height:100%;max-width:none!important;width:auto!important;overflow:visible!important;border-radius:0!important;box-shadow:none!important;background:#07070c!important}html.fb-cinema-route body{padding:0!important}html.fb-cinema-route body::before,html.fb-cinema-route body::after{display:none!important}.fbc{--violet:#a48aff;--cyan:#35d8ff;--ink:#07070c;--paper:#f4f1ff;--muted:#9995aa;position:relative;background:var(--ink);color:var(--paper);font-family:Inter,system-ui,sans-serif;overflow:clip}.fbc *{box-sizing:border-box}.fb-world{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;background:radial-gradient(circle at 60% 45%,#171129 0,#090910 48%,#050508 100%)}.fb-vignette{position:fixed;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgba(5,5,8,.92) 0%,rgba(5,5,8,.32) 47%,rgba(5,5,8,.1) 72%,rgba(5,5,8,.45) 100%),radial-gradient(circle at 55% 40%,transparent 20%,rgba(0,0,0,.46) 92%)}.fb-cinema-nav{position:fixed;z-index:20;top:0;left:0;right:0;height:72px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 38px;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(7,7,12,.56);backdrop-filter:blur(18px)}.fb-wordmark{display:flex;gap:10px;align-items:center;color:#fff;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:.1em}.fb-wordmark i{display:grid;place-items:center;width:25px;height:25px;border:1px solid var(--violet);border-radius:7px;color:var(--cyan);font-style:normal;box-shadow:0 0 20px rgba(164,138,255,.26)}.fb-cinema-nav>div{display:flex;gap:19px}.fb-cinema-nav>div a{color:#625e70;font:700 9px/1 ui-monospace,monospace;text-decoration:none}.fb-cinema-nav>div a.active{color:var(--cyan)}.fb-cinema-nav>button{justify-self:end;border:0;background:transparent;color:#fff;font:700 10px/1 ui-monospace,monospace;letter-spacing:.08em}.fb-global-status{position:fixed;z-index:12;right:30px;bottom:24px;display:flex;gap:12px;align-items:center;color:#777282;font:700 8px/1 ui-monospace,monospace;letter-spacing:.1em}.fb-global-status b{padding:7px 9px;border:1px solid rgba(164,138,255,.3);border-radius:5px;color:var(--violet);font-size:9px}.fb-chapter{position:relative;z-index:3;min-height:115vh;padding:16vh 6vw 12vh;display:flex;align-items:center}.fb-copy{width:min(560px,46vw)}.fb-eyebrow{display:block;margin-bottom:24px;color:var(--cyan);font:700 10px/1 ui-monospace,monospace;letter-spacing:.17em}.fb-copy h1,.fb-copy h2,.fb-final h2{margin:0;font-size:clamp(56px,7.2vw,116px);line-height:.86;letter-spacing:-.07em;font-weight:740}.fb-copy h2{font-size:clamp(52px,6.4vw,96px)}.fb-copy em,.fb-final em{font-family:"Instrument Serif",Georgia,serif;font-weight:400;color:var(--violet)}.fb-copy p,.fb-final>p{max-width:480px;margin:32px 0;color:var(--muted);font-size:17px;line-height:1.6}.fb-primary,.fb-ghost{border:0;padding:15px 18px;background:var(--paper);color:#090910;font-weight:750;font-size:13px}.fb-primary span{margin-left:35px}.fb-copy>small{display:block;margin-top:13px;color:#5e596b;font:700 8px/1 ui-monospace,monospace;letter-spacing:.12em}.fb-opening{align-items:center}.fb-opening footer,.fb-final footer{position:absolute;left:6vw;right:6vw;bottom:28px;display:flex;justify-content:space-between;color:#666171;font:700 9px/1 ui-monospace,monospace;letter-spacing:.12em}.fb-opening footer a,.fb-final footer a{color:#9f9aaa;text-decoration:none}.fb-capture-card{position:absolute;right:7vw;top:31%;width:280px;padding:18px;border:1px solid rgba(164,138,255,.38);background:rgba(10,9,17,.72);backdrop-filter:blur(18px);transform:rotate(3deg);box-shadow:0 40px 80px -30px rgba(0,0,0,.9),0 0 60px rgba(164,138,255,.1)}.fb-capture-card small,.fb-capture-card p{display:block;color:var(--cyan);font:700 9px/1 ui-monospace,monospace;letter-spacing:.1em}.fb-capture-card strong{display:block;margin:22px 0 48px;font-size:24px;line-height:1.15}.fb-capture-card p{color:#676271}.fb-capture-card b{display:block;margin-top:10px;font-size:13px;line-height:1.45;color:#d8d4e5}.fb-extract,.fb-connect,.fb-synthesize,.fb-build{justify-content:space-between;gap:8vw}.fb-extraction-stack{width:min(520px,43vw);perspective:900px}.fb-extraction-stack div{display:grid;grid-template-columns:42px 1fr auto;align-items:center;margin:-4px 0;padding:25px 22px;border:1px solid rgba(255,255,255,.13);background:rgba(11,10,19,.78);backdrop-filter:blur(16px);transform:rotateY(-17deg) rotateX(3deg);box-shadow:0 22px 55px -35px #000}.fb-extraction-stack div:nth-child(2){translate:22px}.fb-extraction-stack div:nth-child(3){translate:44px}.fb-extraction-stack div:nth-child(4){translate:66px;border-color:rgba(53,216,255,.45)}.fb-extraction-stack span{color:var(--violet);font:700 10px ui-monospace}.fb-extraction-stack b{font-size:12px;letter-spacing:.08em}.fb-extraction-stack small{color:#716c7f;font-size:10px}.fb-copy label{display:block;margin-top:44px;color:#777282;font:700 9px ui-monospace;letter-spacing:.1em}.fb-copy label b{float:right;color:var(--cyan)}.fb-copy input{display:block;width:100%;margin-top:15px;accent-color:var(--violet)}.fb-related{width:min(540px,44vw)}.fb-related article{position:relative;margin:10px 0;padding:20px 22px;border:1px solid rgba(255,255,255,.12);background:rgba(9,9,15,.74);backdrop-filter:blur(14px)}.fb-related article:nth-child(2){translate:34px}.fb-related article:nth-child(3){translate:68px;border-color:rgba(164,138,255,.46)}.fb-related small{display:block;margin-bottom:9px;color:#777282;font:700 8px ui-monospace;letter-spacing:.1em}.fb-related article b{font-size:14px;line-height:1.45}.fb-related>div{display:flex;justify-content:space-between;margin:32px 0 0 68px;padding-top:16px;border-top:1px solid rgba(53,216,255,.3);font:700 9px ui-monospace;letter-spacing:.1em;color:#777282}.fb-related>div strong{color:var(--cyan)}.fb-ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.18)}.fb-ash{width:min(560px,45vw);border:1px solid rgba(164,138,255,.35);background:rgba(9,8,16,.78);backdrop-filter:blur(22px);box-shadow:0 0 100px rgba(100,70,220,.12)}.fb-ash header{display:flex;justify-content:space-between;padding:14px 17px;border-bottom:1px solid rgba(255,255,255,.1);font:700 8px ui-monospace;letter-spacing:.1em}.fb-ash header b{color:var(--cyan)}.fb-ash p{margin:0;padding:22px 25px 0;font-size:18px;line-height:1.55}.fb-ash p:nth-of-type(2){color:#aaa5b7}.fb-ash>div{display:flex;gap:7px;padding:26px 25px}.fb-ash>div span{padding:7px 8px;border:1px solid rgba(255,255,255,.12);color:#777282;font:700 8px ui-monospace}.fb-build-surface{width:min(550px,45vw);border-top:1px solid rgba(164,138,255,.55);background:rgba(8,8,14,.74);backdrop-filter:blur(18px)}.fb-build-surface header{display:flex;justify-content:space-between;padding:18px 20px;color:#fff;font:800 10px ui-monospace;letter-spacing:.1em}.fb-build-surface header span{color:var(--cyan)}.fb-build-surface>div{display:grid;grid-template-columns:42px 1fr auto;padding:17px 20px;border-top:1px solid rgba(255,255,255,.09);align-items:center}.fb-build-surface>div span,.fb-build-surface>div small{color:#777282;font:700 9px ui-monospace}.fb-build-surface>div b{font-size:13px}.fb-build-surface button{width:100%;padding:17px;border:0;background:linear-gradient(90deg,var(--violet),var(--cyan));color:#08080d;font-weight:800;font-size:10px;letter-spacing:.09em}.fb-final{min-height:110vh;display:block;padding-top:25vh;text-align:center}.fb-final h2{font-size:clamp(62px,8.4vw,128px)}.fb-final>p{margin:35px auto}.fb-final footer{text-align:left}.fb-terminal-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:24px;background:rgba(3,3,7,.82);backdrop-filter:blur(14px)}.fb-terminal{width:min(1000px,96vw);max-height:90vh;overflow:auto;border:1px solid rgba(164,138,255,.42);background:#09090f;box-shadow:0 50px 140px #000}.fb-terminal>header{display:grid;grid-template-columns:1fr auto auto;gap:24px;padding:17px 20px;border-bottom:1px solid rgba(255,255,255,.1);font:700 9px ui-monospace;letter-spacing:.1em}.fb-terminal>header span{color:var(--cyan)}.fb-terminal>header button{border:0;background:none;color:#888391;font:inherit}.fb-terminal-grid{display:grid;grid-template-columns:1fr 1fr}.fb-terminal-source,.fb-terminal-state{padding:38px;border-bottom:1px solid rgba(255,255,255,.1)}.fb-terminal-source{border-right:1px solid rgba(255,255,255,.1)}.fb-terminal small{color:#777282;font:700 9px ui-monospace;letter-spacing:.1em}.fb-terminal-source h3{margin:22px 0;font-size:28px}.fb-terminal-source p{color:#aaa5b7;line-height:1.6}.fb-terminal-state>strong{display:block;margin:22px 0;color:var(--cyan);font-size:25px}.fb-terminal-state div{display:grid;gap:10px}.fb-terminal-state span{color:#45414d;font:700 9px ui-monospace;letter-spacing:.08em}.fb-terminal-state span.done{color:#bcb6cb}.fb-terminal-result{padding:28px 38px;opacity:.25;transition:.5s}.fb-terminal-result.visible{opacity:1}.fb-terminal-result h2{margin:10px 0 20px;font-size:40px}.fb-terminal-result div{display:flex;gap:8px;flex-wrap:wrap}.fb-terminal-result div span{padding:9px;border:1px solid rgba(164,138,255,.3);color:var(--violet);font:700 8px ui-monospace}
@media(max-width:760px){.fb-cinema-nav{height:60px;padding:0 16px;grid-template-columns:1fr auto}.fb-cinema-nav>div{display:none}.fb-cinema-nav>button{font-size:8px}.fb-global-status{right:13px;bottom:12px}.fb-chapter{min-height:118vh;padding:18vh 22px 12vh;display:block}.fb-copy{width:100%}.fb-copy h1,.fb-copy h2{font-size:clamp(52px,16vw,72px)}.fb-copy p{font-size:15px}.fb-world{opacity:.7}.fb-vignette{background:linear-gradient(180deg,rgba(5,5,8,.82),rgba(5,5,8,.22) 35%,rgba(5,5,8,.72))}.fb-capture-card{position:relative;top:auto;right:auto;width:80%;margin:70px 0 0 auto}.fb-extraction-stack,.fb-related,.fb-ash,.fb-build-surface{width:100%;margin-top:70px}.fb-extraction-stack div{grid-template-columns:32px 1fr}.fb-extraction-stack small{display:none}.fb-extraction-stack div:nth-child(2){translate:8px}.fb-extraction-stack div:nth-child(3){translate:16px}.fb-extraction-stack div:nth-child(4){translate:24px}.fb-related article:nth-child(2){translate:10px}.fb-related article:nth-child(3){translate:20px}.fb-related>div{margin-left:20px}.fb-terminal-grid{grid-template-columns:1fr}.fb-terminal-source{border-right:0}.fb-terminal-source,.fb-terminal-state{padding:25px}.fb-terminal-result{padding:25px}.fb-final{padding-top:24vh}.fb-final h2{font-size:clamp(58px,17vw,82px)}.fb-opening footer span:last-child,.fb-final footer span:nth-child(2){display:none}}
@media(prefers-reduced-motion:reduce){html.fb-cinema-route{scroll-behavior:auto!important}}
`;
