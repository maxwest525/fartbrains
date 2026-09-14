import { useCallback, useEffect, useRef, useState } from "react";
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

type WorldProps = { chapter: number; pulse: number };

function ThoughtWorld({ chapter, pulse }: WorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ chapter, pulse });
  stateRef.current = { chapter, pulse };

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
      const { chapter: c, pulse: p } = stateRef.current;
      if (!quiet) time += 0.006;
      const targetScale = 0.82 + c * 0.13;
      world.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.035,
      );
      world.rotation.y += quiet ? 0 : 0.0014 + c * 0.00015;
      world.rotation.x = Math.sin(time * 0.7) * 0.075;
      lines.material.opacity = 0.08 + Math.min(c, 4) * 0.025;
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

type GraphNode = {
  id: string;
  type: "THOUGHT" | "SOURCE" | "CREATOR" | "RESEARCH" | "RULE" | "OUTCOME";
  title: string;
  detail: string;
  provenance: string;
  parentId?: string;
};

const GRAPH_CORE: GraphNode[] = [
  {
    id: "seed",
    type: "THOUGHT",
    title: "Paid ads + SEO should be one system",
    detail: "The user's original tweak preserved beside the source.",
    provenance: "PRIVATE NOTE · TODAY",
  },
  {
    id: "reel",
    type: "SOURCE",
    title: "Competitor keyword strategy",
    detail:
      "Original Instagram source, transcript, claims and extracted references.",
    provenance: "PUBLIC SOURCE · TRANSCRIBED",
  },
  {
    id: "creator",
    type: "CREATOR",
    title: "Creator strategy corpus",
    detail:
      "Recurring frameworks extracted from the creator's other public ideas.",
    provenance: "14 PUBLIC SOURCES · CITED",
  },
  {
    id: "intent",
    type: "RESEARCH",
    title: "Commercial intent signal",
    detail:
      "Corroborating evidence connecting keyword gaps to purchase intent.",
    provenance: "RESEARCH PACK · 12 SOURCES",
  },
  {
    id: "route-rule",
    type: "RULE",
    title: "Paid-or-organic routing rule",
    detail:
      "If intent is immediate, test paid. If value compounds, publish organic.",
    provenance: "DETERMINISTIC RULE · V3",
  },
  {
    id: "outcome-engine",
    type: "OUTCOME",
    title: "Competitor Signal Engine",
    detail: "A complete product outcome assembled from the connected graph.",
    provenance: "FARTBRAIN OUTCOME · READY",
  },
  {
    id: "old-paid",
    type: "THOUGHT",
    title: "Underpriced paid intent",
    detail: "A related thought captured three months earlier.",
    provenance: "PRIVATE NOTE · 3 MONTHS AGO",
  },
  {
    id: "old-seo",
    type: "THOUGHT",
    title: "Adjacent ranking expansion",
    detail: "A related SEO thought recovered from the private graph.",
    provenance: "PRIVATE NOTE · 6 WEEKS AGO",
  },
  {
    id: "landing-data",
    type: "SOURCE",
    title: "Landing-page conversion data",
    detail: "A saved dataset that validates which intent routes convert.",
    provenance: "PRIVATE FILE · CSV",
  },
  {
    id: "creator-branch",
    type: "CREATOR",
    title: "Demand-capture framework",
    detail: "A second creator idea that strengthens the original strategy.",
    provenance: "PUBLIC SOURCE · CITED",
  },
  {
    id: "difficulty",
    type: "RESEARCH",
    title: "Organic difficulty score",
    detail: "Evidence used to decide whether SEO can compound efficiently.",
    provenance: "RESEARCH · VERIFIED URL",
  },
  {
    id: "cpc",
    type: "RESEARCH",
    title: "Paid acquisition pressure",
    detail: "Cost-per-click evidence used by the routing decision.",
    provenance: "RESEARCH · CURRENT DATA",
  },
  {
    id: "fallback",
    type: "RULE",
    title: "Fallback branch",
    detail:
      "When organic difficulty is high, run a bounded paid validation first.",
    provenance: "DETERMINISTIC RULE · ELSE",
  },
  {
    id: "validation",
    type: "RULE",
    title: "Success validation",
    detail:
      "Compare qualified acquisition cost, time-to-signal and compounding value.",
    provenance: "VALIDATION CONTRACT",
  },
  {
    id: "brief",
    type: "OUTCOME",
    title: "MVP product brief",
    detail: "Product definition generated without requiring project access.",
    provenance: "OUTPUT · 12 SECTIONS",
  },
  {
    id: "spec",
    type: "OUTCOME",
    title: "Implementation specification",
    detail: "Architecture, interfaces, decision logic and acceptance criteria.",
    provenance: "OUTPUT · VERSIONED",
  },
  {
    id: "skill",
    type: "OUTCOME",
    title: "Reusable operator skill",
    detail: "The reconstructed human strategy expressed as reusable logic.",
    provenance: "OUTPUT · PORTABLE",
  },
  {
    id: "bridge",
    type: "OUTCOME",
    title: "Actual Build handoff",
    detail:
      "Execution package stops safely at the MCP or API project boundary.",
    provenance: "CONNECTION REQUIRED",
  },
];

const GRAPH_NODES: GraphNode[] = [
  ...GRAPH_CORE,
  ...Array.from({ length: 78 }, (_, index) => {
    const parent = GRAPH_CORE[index % GRAPH_CORE.length];
    return {
      id: `evidence-${index + 1}`,
      type: parent.type === "OUTCOME" ? "RESEARCH" : parent.type,
      title: `Supporting ${parent.type.toLowerCase()} ${String(index + 1).padStart(2, "0")}`,
      detail: `Evidence or context connected to “${parent.title}”.`,
      provenance:
        index % 3 === 0 ? "PRIVATE GRAPH · LINKED" : "SOURCE EVIDENCE · CITED",
      parentId: parent.id,
    } as GraphNode;
  }),
];

const GRAPH_COLORS: Record<GraphNode["type"], number> = {
  THOUGHT: 0xa48aff,
  SOURCE: 0x35d8ff,
  CREATOR: 0xff79c6,
  RESEARCH: 0x77f2b4,
  RULE: 0xffc857,
  OUTCOME: 0xf4f1ff,
};

function InspectableGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedRef = useRef("outcome-engine");
  const [selectedId, setSelectedId] = useState("outcome-engine");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  selectedRef.current = selectedId;
  const selected =
    GRAPH_NODES.find((node) => node.id === selectedId) ?? GRAPH_CORE[5];
  const relatedCount =
    GRAPH_NODES.filter(
      (node) => node.parentId === selected.id || node.id === selected.parentId,
    ).length + 3;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.z = 12.5;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));

    const graph = new THREE.Group();
    graph.rotation.x = -0.18;
    scene.add(graph);

    const typeOrder: GraphNode["type"][] = [
      "THOUGHT",
      "SOURCE",
      "CREATOR",
      "RESEARCH",
      "RULE",
      "OUTCOME",
    ];
    const positions: THREE.Vector3[] = [];
    const meshes: THREE.Mesh[] = [];
    const materials: THREE.MeshBasicMaterial[] = [];
    let seed = 91827;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    GRAPH_NODES.forEach((node, index) => {
      const cluster = typeOrder.indexOf(node.type);
      const clusterAngle = (cluster / typeOrder.length) * Math.PI * 2;
      const cx = Math.cos(clusterAngle) * 3.5;
      const cy = Math.sin(clusterAngle) * 2.45;
      const coreIndex = GRAPH_CORE.findIndex((item) => item.id === node.id);
      const spread = coreIndex >= 0 ? 0.25 : 1.2 + random() * 1.25;
      const angle = random() * Math.PI * 2;
      const position = new THREE.Vector3(
        cx + Math.cos(angle) * spread,
        cy + Math.sin(angle) * spread * 0.7,
        (random() - 0.5) * 4.4,
      );
      positions.push(position);

      const isCore = coreIndex >= 0;
      const geometry = new THREE.SphereGeometry(
        isCore ? 0.16 : 0.055 + random() * 0.035,
        isCore ? 18 : 8,
        isCore ? 18 : 8,
      );
      const material = new THREE.MeshBasicMaterial({
        color: GRAPH_COLORS[node.type],
        transparent: true,
        opacity: isCore ? 1 : 0.72,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.userData.graphId = node.id;
      graph.add(mesh);
      meshes.push(mesh);
      materials.push(material);

      if (isCore) {
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.22, 0.25, 28),
          new THREE.MeshBasicMaterial({
            color: GRAPH_COLORS[node.type],
            transparent: true,
            opacity: 0.38,
            side: THREE.DoubleSide,
          }),
        );
        halo.position.copy(position);
        halo.lookAt(camera.position);
        graph.add(halo);
      }
    });

    const indexById = new Map(
      GRAPH_NODES.map((node, index) => [node.id, index]),
    );
    const edgePairs: Array<[number, number]> = [];
    GRAPH_NODES.forEach((node, index) => {
      if (node.parentId) {
        const parentIndex = indexById.get(node.parentId);
        if (parentIndex !== undefined) edgePairs.push([index, parentIndex]);
      }
      if (index > GRAPH_CORE.length && index % 3 !== 0)
        edgePairs.push([index, index - 1]);
    });
    [
      ["seed", "reel"],
      ["seed", "old-paid"],
      ["seed", "old-seo"],
      ["reel", "creator"],
      ["creator", "creator-branch"],
      ["intent", "difficulty"],
      ["intent", "cpc"],
      ["route-rule", "fallback"],
      ["route-rule", "validation"],
      ["route-rule", "outcome-engine"],
      ["outcome-engine", "brief"],
      ["outcome-engine", "spec"],
      ["outcome-engine", "skill"],
      ["outcome-engine", "bridge"],
      ["landing-data", "validation"],
    ].forEach(([a, b]) => {
      const ai = indexById.get(a);
      const bi = indexById.get(b);
      if (ai !== undefined && bi !== undefined) edgePairs.push([ai, bi]);
    });

    const edgeData: number[] = [];
    edgePairs.forEach(([a, b]) =>
      edgeData.push(...positions[a].toArray(), ...positions[b].toArray()),
    );
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(edgeData, 3),
    );
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: 0x8c74de,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
      }),
    );
    graph.add(lines);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(4, 4);
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    let targetZoom = 12.5;

    const setPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      setPointer(event);
      if (dragging) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        graph.rotation.y += dx * 0.006;
        graph.rotation.x += dy * 0.004;
        lastX = event.clientX;
        lastY = event.clientY;
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!moved) {
        setPointer(event);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(meshes, false)[0];
        if (hit) setSelectedId(hit.object.userData.graphId as string);
      }
      dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetZoom = THREE.MathUtils.clamp(
        targetZoom + event.deltaY * 0.008,
        7.5,
        18,
      );
    };
    const resize = () => {
      const width = Math.max(canvas.clientWidth, 1);
      const height = Math.max(canvas.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    resize();

    let raf = 0;
    const draw = () => {
      camera.position.z += (targetZoom - camera.position.z) * 0.08;
      if (!dragging && !reducedMotion()) graph.rotation.y += 0.0007;
      raycaster.setFromCamera(pointer, camera);
      const hovered = raycaster.intersectObjects(meshes, false)[0];
      const hoverId = hovered?.object.userData.graphId as string | undefined;
      setHoveredId((current) =>
        current === (hoverId ?? null) ? current : (hoverId ?? null),
      );
      canvas.style.cursor = dragging
        ? "grabbing"
        : hoverId
          ? "pointer"
          : "grab";

      const selectedNode = GRAPH_NODES.find(
        (node) => node.id === selectedRef.current,
      );
      meshes.forEach((mesh, index) => {
        const node = GRAPH_NODES[index];
        const connected =
          node.id === selectedRef.current ||
          node.parentId === selectedRef.current ||
          selectedNode?.parentId === node.id;
        const isHovered = node.id === hoverId;
        materials[index].opacity = connected
          ? 1
          : selectedRef.current
            ? 0.24
            : 0.72;
        const targetScale = isHovered ? 2.1 : connected ? 1.35 : 1;
        mesh.scale.lerp(
          new THREE.Vector3(targetScale, targetScale, targetScale),
          0.16,
        );
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      meshes.forEach((mesh) => mesh.geometry.dispose());
      materials.forEach((material) => material.dispose());
      lineGeometry.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fb-graph-inspector">
      <header>
        <span>FARTBRAIN / KNOWLEDGE GRAPH</span>
        <b>96 NODES · 108+ RELATIONSHIPS</b>
      </header>
      <div className="fb-graph-stage">
        <canvas
          ref={canvasRef}
          aria-label="Inspectable three-dimensional Fartbrain knowledge graph"
        />
        <div className="fb-graph-legend">
          {(
            [
              "THOUGHT",
              "SOURCE",
              "CREATOR",
              "RESEARCH",
              "RULE",
              "OUTCOME",
            ] as const
          ).map((type) => (
            <span
              key={type}
              style={{
                color: `#${GRAPH_COLORS[type].toString(16).padStart(6, "0")}`,
              }}
            >
              ● {type}
            </span>
          ))}
        </div>
        <small className="fb-graph-hint">
          DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A NODE
        </small>
      </div>
      <aside className="fb-node-inspector" aria-live="polite">
        <small>
          {hoveredId ? "HOVERING" : "SELECTED NODE"} · {selected.type}
        </small>
        <h3>{selected.title}</h3>
        <p>{selected.detail}</p>
        <div>
          <span>PROVENANCE</span>
          <b>{selected.provenance}</b>
        </div>
        <div>
          <span>RELATIONSHIPS</span>
          <b>{relatedCount} TRACED</b>
        </div>
        <button
          className={savedId === selected.id ? "saved" : ""}
          onClick={() => setSavedId(selected.id)}
        >
          {savedId === selected.id ? "SAVED TO YOUR BRAIN ✓" : "SAVE THIS +"}
        </button>
      </aside>
    </div>
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
            <span>FINISHED PRODUCT</span>
          </div>
          <button className="fb-connect-mcp">
            BUILD TYPE: ONE SHOT <b>DELIVER THE FINISHED PRODUCT →</b>
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
  const [terminal, setTerminal] = useState(false);
  const [buildMode, setBuildMode] = useState<"ONE SHOT" | "PREPARE ONLY">("ONE SHOT");
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
  return (
    <div className="fbc">
      <style>{styles}</style>
      <style>{enhancementStyles}</style>
      <ThoughtWorld chapter={chapter} pulse={pulse} />
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
          className="fb-chapter fb-graph-chapter"
        >
          <div className="fb-copy">
            <span className="fb-eyebrow">03 / FARTBRAIN IS THE GRAPH</span>
            <h2>
              Inspect the
              <br />
              thought behind
              <br />
              <em>the thought.</em>
            </h2>
            <p>
              Not a folder tree and not a decorative constellation. Fartbrain
              owns a dense, inspectable graph of notes, sources, creators,
              evidence, rules and outcomes—with every relationship traceable
              back to why it exists.
            </p>
          </div>
          <InspectableGraph />
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
              From reel
              <br />
              <em>to real.</em>
              <br />
              Not another
              <br />
              summary.
              <br />
              <em>A starting line.</em>
            </h2>
            <p>
              One creator gatekept a complete build across five separate
              videos. Drop in one link and Fartbrain can find the related
              videos—or link the exact sources yourself. Then choose what you
              want built. Behind the scenes, Fartbrain turns the full source set
              into a controlled build loop and ships the finished product.
            </p>
          </div>
          <div className="fb-build-surface">
            <header>
              SOURCE SET → FINISHED PRODUCT <span>{buildMode}</span>
            </header>
            <section className="fb-jarvis-flow">
              <div>
                {["YT 01", "YT 02", "YT 03", "YT 04", "YT 05"].map((video) => (
                  <span key={video}>{video}</span>
                ))}
              </div>
              <i>→</i>
              <strong>COMPLETE BUILD INTELLIGENCE</strong>
            </section>
            <div className="fb-build-mode">
              <span>BUILD MODE</span>
              <button className={buildMode === "ONE SHOT" ? "active" : ""} onClick={() => setBuildMode("ONE SHOT")}>ONE SHOT</button>
              <button className={buildMode === "PREPARE ONLY" ? "active" : ""} onClick={() => setBuildMode("PREPARE ONLY")}>PREPARE ONLY</button>
            </div>
            <div className="fb-build-loop" aria-label="One Shot build loop">
              {["LINK SOURCES", "EXTRACT SYSTEM", "BUILD", "VALIDATE", "DELIVER"].map((stage, i) => (
                <span key={stage} className={buildMode === "ONE SHOT" ? "lit" : i < 2 ? "lit" : ""}>
                  <b>{String(i + 1).padStart(2, "0")}</b>{stage}
                </span>
              ))}
            </div>
            {[
              { title: "Web application", meta: "working product" },
              {
                title: "AI agent",
                meta: "configured + operational",
              },
              { title: "Automation system", meta: "working workflow" },
              {
                title: "MVP",
                meta: "ready to use",
              },
              {
                title: "Your chosen product",
                meta: "the actual deliverable",
                featured: true,
              },
            ].map((x, i) => (
              <div key={x.title} className={x.featured ? "featured" : ""}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{x.title}</b>
                <small>{x.meta}</small>
              </div>
            ))}
            <button onClick={run}>{buildMode === "ONE SHOT" ? "RUN ONE SHOT BUILD →" : "PREPARE BUILD PACKAGE →"}</button>
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
.fb-related article{display:grid;grid-template-columns:1fr auto;transition:opacity .25s ease,border-color .25s ease,box-shadow .25s ease}
.fb-related article small,.fb-related article b{grid-column:1}.fb-related article i{grid-column:2;grid-row:1/3;align-self:center;color:#5d5868;font:700 7px ui-monospace;letter-spacing:.08em;font-style:normal}
.fb-related article.untraced{opacity:.48}.fb-related article.traced{opacity:1;border-color:rgba(53,216,255,.48);box-shadow:0 0 28px rgba(53,216,255,.07)}.fb-related article.traced i{color:var(--cyan)}
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
.fb-graph-chapter{display:block;padding-top:13vh}
.fb-graph-chapter>.fb-copy{width:min(680px,70vw);position:relative;z-index:2}
.fb-graph-chapter>.fb-copy h2{font-size:clamp(48px,5.8vw,88px)}
.fb-graph-chapter>.fb-copy p{max-width:610px}
.fb-graph-inspector{position:relative;width:88vw;height:680px;margin:42px auto 0;border:1px solid rgba(164,138,255,.28);background:linear-gradient(145deg,rgba(9,8,17,.94),rgba(5,7,13,.88));box-shadow:0 55px 140px -65px #000,0 0 100px rgba(112,80,220,.08);overflow:hidden}
.fb-graph-inspector>header{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(255,255,255,.09);color:#777282;font:700 8px ui-monospace;letter-spacing:.1em}
.fb-graph-inspector>header b{color:var(--cyan)}
.fb-graph-stage{position:absolute;inset:49px 310px 0 0}
.fb-graph-stage canvas{width:100%;height:100%;display:block;touch-action:none;background:radial-gradient(circle at 50% 46%,rgba(89,55,170,.14),transparent 56%)}
.fb-graph-legend{position:absolute;top:16px;left:16px;display:flex;gap:10px;flex-wrap:wrap;max-width:460px;pointer-events:none}
.fb-graph-legend span{font:700 7px ui-monospace;letter-spacing:.08em}
.fb-graph-hint{position:absolute;left:18px;bottom:16px;color:#615c6c;font:700 8px ui-monospace;letter-spacing:.09em;pointer-events:none}
.fb-node-inspector{position:absolute;top:49px;right:0;bottom:0;width:310px;padding:32px 25px;border-left:1px solid rgba(255,255,255,.09);background:rgba(7,7,12,.76);backdrop-filter:blur(16px)}
.fb-node-inspector>small{color:var(--violet);font:700 8px ui-monospace;letter-spacing:.1em}
.fb-node-inspector h3{margin:20px 0 15px;font-size:26px;line-height:1.02;letter-spacing:-.035em}
.fb-node-inspector p{min-height:110px;color:#9b96a8;font-size:13px;line-height:1.6}
.fb-node-inspector div{display:grid;gap:7px;padding:15px 0;border-top:1px solid rgba(255,255,255,.09)}
.fb-node-inspector div span{color:#5f5a68;font:700 7px ui-monospace;letter-spacing:.1em}
.fb-node-inspector div b{color:#d8d4e5;font:700 9px ui-monospace;letter-spacing:.04em}
.fb-node-inspector>button{width:100%;margin-top:18px;padding:14px;border:1px solid rgba(164,138,255,.45);background:rgba(164,138,255,.08);color:#c8bbff;font:800 9px ui-monospace;letter-spacing:.09em;transition:.2s ease}
.fb-node-inspector>button:hover{border-color:var(--cyan);color:var(--cyan);background:rgba(53,216,255,.08)}
.fb-node-inspector>button.saved{border-color:rgba(119,242,180,.5);color:#77f2b4;background:rgba(119,242,180,.07)}
.fb-jarvis-flow{display:grid;grid-template-columns:1fr auto 120px;align-items:center;gap:15px;padding:18px 20px;border-top:1px solid rgba(255,255,255,.09);border-bottom:1px solid rgba(164,138,255,.32);background:linear-gradient(90deg,rgba(164,138,255,.08),rgba(53,216,255,.035))}
.fb-jarvis-flow>div{display:flex;gap:5px;flex-wrap:wrap}.fb-jarvis-flow>div span{padding:6px;border:1px solid rgba(255,255,255,.12);color:#777282;font:700 7px ui-monospace;letter-spacing:.08em}
.fb-jarvis-flow>i{color:var(--cyan);font-size:18px;font-style:normal}.fb-jarvis-flow>strong{color:#d8ceff;font:800 10px ui-monospace;letter-spacing:.08em}
.fb-build-surface>div.featured{border-left:2px solid var(--violet);background:rgba(164,138,255,.07)}.fb-build-surface>div.featured b{color:#c9bdff}.fb-build-surface>div.featured small{color:var(--cyan)}
.fb-build-mode{display:flex;align-items:center;gap:7px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.09);color:#777282;font:700 8px ui-monospace;letter-spacing:.1em}.fb-build-mode span{margin-right:auto}.fb-build-mode button{padding:7px 9px;border:1px solid rgba(255,255,255,.13);background:transparent;color:#777282;font:700 8px ui-monospace;letter-spacing:.08em}.fb-build-mode button.active{border-color:var(--cyan);color:var(--cyan);background:rgba(53,216,255,.08)}.fb-build-loop{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:0;padding:14px 20px!important;border-top:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.12)}.fb-build-loop span{display:grid;gap:7px;color:#45414d;font:700 7px ui-monospace;letter-spacing:.06em}.fb-build-loop span+span{border-left:1px solid rgba(255,255,255,.09);padding-left:10px}.fb-build-loop span.lit{color:#bcb6cb}.fb-build-loop span.lit b{color:var(--violet)}
@media(max-width:760px){.fb-graph-inspector{height:820px}.fb-graph-stage{bottom:320px}.fb-node-inspector{height:320px}.fb-jarvis-flow{grid-template-columns:1fr auto}.fb-jarvis-flow>strong{grid-column:1/-1}}
@media(max-width:760px){.fb-graph-chapter{padding-top:15vh}.fb-graph-chapter>.fb-copy{width:100%}.fb-graph-inspector{width:100%;height:760px;margin-top:45px}.fb-graph-stage{inset:49px 0 260px}.fb-node-inspector{top:auto;left:0;bottom:0;width:100%;height:260px;border-left:0;border-top:1px solid rgba(255,255,255,.09);padding:22px}.fb-node-inspector p{min-height:auto}.fb-graph-legend{max-width:88%}.fb-extraction-stack,.fb-related,.fb-ash,.fb-reason-engine,.fb-build-surface,.fb-bridge-panel{width:100%;margin-top:70px}.fb-extraction-stack div:nth-child(5){translate:32px}.fb-reason-engine>div{grid-template-columns:82px 1fr auto}.fb-reason-engine>div.alt{margin-left:20px}.fb-connect-mcp{gap:14px;text-align:left}.fb-bridge-map{grid-template-columns:1fr}.fb-bridge-core{grid-template-columns:auto auto auto;justify-content:center;margin:8px}.fb-bridge-core strong{rotate:90deg}}
`;

const styles = `
html.fb-cinema-route,html.fb-cinema-route body,html.fb-cinema-route #root{height:auto!important;min-height:100%;max-width:none!important;width:auto!important;overflow:visible!important;border-radius:0!important;box-shadow:none!important;background:#07070c!important}html.fb-cinema-route body{padding:0!important}html.fb-cinema-route body::before,html.fb-cinema-route body::after{display:none!important}.fbc{--violet:#a48aff;--cyan:#35d8ff;--ink:#07070c;--paper:#f4f1ff;--muted:#9995aa;position:relative;background:var(--ink);color:var(--paper);font-family:Inter,system-ui,sans-serif;overflow:clip}.fbc *{box-sizing:border-box}.fb-world{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;background:radial-gradient(circle at 60% 45%,#171129 0,#090910 48%,#050508 100%)}.fb-vignette{position:fixed;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgba(5,5,8,.92) 0%,rgba(5,5,8,.32) 47%,rgba(5,5,8,.1) 72%,rgba(5,5,8,.45) 100%),radial-gradient(circle at 55% 40%,transparent 20%,rgba(0,0,0,.46) 92%)}.fb-cinema-nav{position:fixed;z-index:20;top:0;left:0;right:0;height:72px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 38px;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(7,7,12,.56);backdrop-filter:blur(18px)}.fb-wordmark{display:flex;gap:10px;align-items:center;color:#fff;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:.1em}.fb-wordmark i{display:grid;place-items:center;width:25px;height:25px;border:1px solid var(--violet);border-radius:7px;color:var(--cyan);font-style:normal;box-shadow:0 0 20px rgba(164,138,255,.26)}.fb-cinema-nav>div{display:flex;gap:19px}.fb-cinema-nav>div a{color:#625e70;font:700 9px/1 ui-monospace,monospace;text-decoration:none}.fb-cinema-nav>div a.active{color:var(--cyan)}.fb-cinema-nav>button{justify-self:end;border:0;background:transparent;color:#fff;font:700 10px/1 ui-monospace,monospace;letter-spacing:.08em}.fb-global-status{position:fixed;z-index:12;right:30px;bottom:24px;display:flex;gap:12px;align-items:center;color:#777282;font:700 8px/1 ui-monospace,monospace;letter-spacing:.1em}.fb-global-status b{padding:7px 9px;border:1px solid rgba(164,138,255,.3);border-radius:5px;color:var(--violet);font-size:9px}.fb-chapter{position:relative;z-index:3;min-height:115vh;padding:16vh 6vw 12vh;display:flex;align-items:center}.fb-copy{width:min(560px,46vw)}.fb-eyebrow{display:block;margin-bottom:24px;color:var(--cyan);font:700 10px/1 ui-monospace,monospace;letter-spacing:.17em}.fb-copy h1,.fb-copy h2,.fb-final h2{margin:0;font-size:clamp(56px,7.2vw,116px);line-height:.86;letter-spacing:-.07em;font-weight:740}.fb-copy h2{font-size:clamp(52px,6.4vw,96px)}.fb-copy em,.fb-final em{font-family:"Instrument Serif",Georgia,serif;font-weight:400;color:var(--violet)}.fb-copy p,.fb-final>p{max-width:480px;margin:32px 0;color:var(--muted);font-size:17px;line-height:1.6}.fb-primary,.fb-ghost{border:0;padding:15px 18px;background:var(--paper);color:#090910;font-weight:750;font-size:13px}.fb-primary span{margin-left:35px}.fb-copy>small{display:block;margin-top:13px;color:#5e596b;font:700 8px/1 ui-monospace,monospace;letter-spacing:.12em}.fb-opening{align-items:center}.fb-opening footer,.fb-final footer{position:absolute;left:6vw;right:6vw;bottom:28px;display:flex;justify-content:space-between;color:#666171;font:700 9px/1 ui-monospace,monospace;letter-spacing:.12em}.fb-opening footer a,.fb-final footer a{color:#9f9aaa;text-decoration:none}.fb-capture-card{position:absolute;right:7vw;top:31%;width:280px;padding:18px;border:1px solid rgba(164,138,255,.38);background:rgba(10,9,17,.72);backdrop-filter:blur(18px);transform:rotate(3deg);box-shadow:0 40px 80px -30px rgba(0,0,0,.9),0 0 60px rgba(164,138,255,.1)}.fb-capture-card small,.fb-capture-card p{display:block;color:var(--cyan);font:700 9px/1 ui-monospace,monospace;letter-spacing:.1em}.fb-capture-card strong{display:block;margin:22px 0 48px;font-size:24px;line-height:1.15}.fb-capture-card p{color:#676271}.fb-capture-card b{display:block;margin-top:10px;font-size:13px;line-height:1.45;color:#d8d4e5}.fb-extract,.fb-connect,.fb-synthesize,.fb-build{justify-content:space-between;gap:8vw}.fb-extraction-stack{width:min(520px,43vw);perspective:900px}.fb-extraction-stack div{display:grid;grid-template-columns:42px 1fr auto;align-items:center;margin:-4px 0;padding:25px 22px;border:1px solid rgba(255,255,255,.13);background:rgba(11,10,19,.78);backdrop-filter:blur(16px);transform:rotateY(-17deg) rotateX(3deg);box-shadow:0 22px 55px -35px #000}.fb-extraction-stack div:nth-child(2){translate:22px}.fb-extraction-stack div:nth-child(3){translate:44px}.fb-extraction-stack div:nth-child(4){translate:66px;border-color:rgba(53,216,255,.45)}.fb-extraction-stack span{color:var(--violet);font:700 10px ui-monospace}.fb-extraction-stack b{font-size:12px;letter-spacing:.08em}.fb-extraction-stack small{color:#716c7f;font-size:10px}.fb-copy label{display:block;margin-top:44px;color:#777282;font:700 9px ui-monospace;letter-spacing:.1em}.fb-copy label b{float:right;color:var(--cyan)}.fb-copy input{display:block;width:100%;margin-top:15px;accent-color:var(--violet)}.fb-related{width:min(540px,44vw)}.fb-related article{position:relative;margin:10px 0;padding:20px 22px;border:1px solid rgba(255,255,255,.12);background:rgba(9,9,15,.74);backdrop-filter:blur(14px)}.fb-related article:nth-child(2){translate:34px}.fb-related article:nth-child(3){translate:68px;border-color:rgba(164,138,255,.46)}.fb-related small{display:block;margin-bottom:9px;color:#777282;font:700 8px ui-monospace;letter-spacing:.1em}.fb-related article b{font-size:14px;line-height:1.45}.fb-related>div{display:flex;justify-content:space-between;margin:32px 0 0 68px;padding-top:16px;border-top:1px solid rgba(53,216,255,.3);font:700 9px ui-monospace;letter-spacing:.1em;color:#777282}.fb-related>div strong{color:var(--cyan)}.fb-ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.18)}.fb-ash{width:min(560px,45vw);border:1px solid rgba(164,138,255,.35);background:rgba(9,8,16,.78);backdrop-filter:blur(22px);box-shadow:0 0 100px rgba(100,70,220,.12)}.fb-ash header{display:flex;justify-content:space-between;padding:14px 17px;border-bottom:1px solid rgba(255,255,255,.1);font:700 8px ui-monospace;letter-spacing:.1em}.fb-ash header b{color:var(--cyan)}.fb-ash p{margin:0;padding:22px 25px 0;font-size:18px;line-height:1.55}.fb-ash p:nth-of-type(2){color:#aaa5b7}.fb-ash>div{display:flex;gap:7px;padding:26px 25px}.fb-ash>div span{padding:7px 8px;border:1px solid rgba(255,255,255,.12);color:#777282;font:700 8px ui-monospace}.fb-build-surface{width:min(550px,45vw);border-top:1px solid rgba(164,138,255,.55);background:rgba(8,8,14,.74);backdrop-filter:blur(18px)}.fb-build-surface header{display:flex;justify-content:space-between;padding:18px 20px;color:#fff;font:800 10px ui-monospace;letter-spacing:.1em}.fb-build-surface header span{color:var(--cyan)}.fb-build-surface>div{display:grid;grid-template-columns:42px 1fr auto;padding:17px 20px;border-top:1px solid rgba(255,255,255,.09);align-items:center}.fb-build-surface>div span,.fb-build-surface>div small{color:#777282;font:700 9px ui-monospace}.fb-build-surface>div b{font-size:13px}.fb-build-surface button{width:100%;padding:17px;border:0;background:linear-gradient(90deg,var(--violet),var(--cyan));color:#08080d;font-weight:800;font-size:10px;letter-spacing:.09em}.fb-final{min-height:110vh;display:block;padding-top:25vh;text-align:center}.fb-final h2{font-size:clamp(62px,8.4vw,128px)}.fb-final>p{margin:35px auto}.fb-final footer{text-align:left}.fb-terminal-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:24px;background:rgba(3,3,7,.82);backdrop-filter:blur(14px)}.fb-terminal{width:min(1000px,96vw);max-height:90vh;overflow:auto;border:1px solid rgba(164,138,255,.42);background:#09090f;box-shadow:0 50px 140px #000}.fb-terminal>header{display:grid;grid-template-columns:1fr auto auto;gap:24px;padding:17px 20px;border-bottom:1px solid rgba(255,255,255,.1);font:700 9px ui-monospace;letter-spacing:.1em}.fb-terminal>header span{color:var(--cyan)}.fb-terminal>header button{border:0;background:none;color:#888391;font:inherit}.fb-terminal-grid{display:grid;grid-template-columns:1fr 1fr}.fb-terminal-source,.fb-terminal-state{padding:38px;border-bottom:1px solid rgba(255,255,255,.1)}.fb-terminal-source{border-right:1px solid rgba(255,255,255,.1)}.fb-terminal small{color:#777282;font:700 9px ui-monospace;letter-spacing:.1em}.fb-terminal-source h3{margin:22px 0;font-size:28px}.fb-terminal-source p{color:#aaa5b7;line-height:1.6}.fb-terminal-state>strong{display:block;margin:22px 0;color:var(--cyan);font-size:25px}.fb-terminal-state div{display:grid;gap:10px}.fb-terminal-state span{color:#45414d;font:700 9px ui-monospace;letter-spacing:.08em}.fb-terminal-state span.done{color:#bcb6cb}.fb-terminal-result{padding:28px 38px;opacity:.25;transition:.5s}.fb-terminal-result.visible{opacity:1}.fb-terminal-result h2{margin:10px 0 20px;font-size:40px}.fb-terminal-result div{display:flex;gap:8px;flex-wrap:wrap}.fb-terminal-result div span{padding:9px;border:1px solid rgba(164,138,255,.3);color:var(--violet);font:700 8px ui-monospace}
@media(max-width:760px){.fb-cinema-nav{height:60px;padding:0 16px;grid-template-columns:1fr auto}.fb-cinema-nav>div{display:none}.fb-cinema-nav>button{font-size:8px}.fb-global-status{right:13px;bottom:12px}.fb-chapter{min-height:118vh;padding:18vh 22px 12vh;display:block}.fb-copy{width:100%}.fb-copy h1,.fb-copy h2{font-size:clamp(52px,16vw,72px)}.fb-copy p{font-size:15px}.fb-world{opacity:.7}.fb-vignette{background:linear-gradient(180deg,rgba(5,5,8,.82),rgba(5,5,8,.22) 35%,rgba(5,5,8,.72))}.fb-capture-card{position:relative;top:auto;right:auto;width:80%;margin:70px 0 0 auto}.fb-extraction-stack,.fb-related,.fb-ash,.fb-build-surface{width:100%;margin-top:70px}.fb-extraction-stack div{grid-template-columns:32px 1fr}.fb-extraction-stack small{display:none}.fb-extraction-stack div:nth-child(2){translate:8px}.fb-extraction-stack div:nth-child(3){translate:16px}.fb-extraction-stack div:nth-child(4){translate:24px}.fb-related article:nth-child(2){translate:10px}.fb-related article:nth-child(3){translate:20px}.fb-related>div{margin-left:20px}.fb-terminal-grid{grid-template-columns:1fr}.fb-terminal-source{border-right:0}.fb-terminal-source,.fb-terminal-state{padding:25px}.fb-terminal-result{padding:25px}.fb-final{padding-top:24vh}.fb-final h2{font-size:clamp(58px,17vw,82px)}.fb-opening footer span:last-child,.fb-final footer span:nth-child(2){display:none}}
@media(prefers-reduced-motion:reduce){html.fb-cinema-route{scroll-behavior:auto!important}}
`;
