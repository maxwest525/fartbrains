import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useFolders } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";

type GraphNode = {
  id: string;
  title: string;
  folderId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  degree: number;
};

type GraphEdge = { a: string; b: string; w: number; kind: "folder" | "ref" | "kw" };

const STOP = new Set([
  "the","and","for","with","that","this","from","your","you","are","but","not","have","has","was","were","its","into","about","what","when","where","which","who","how","why","they","them","their","our","ours","ive","im","ill","cant","wont","dont","just","like","more","most","some","any","all","one","two","over","under","then","than","also","very","much","make","made","get","got","let","via","onto","off","out","new","old"
]);

function tokens(s: string | null | undefined) {
  if (!s) return [] as string[];
  const out = new Set<string>();
  for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length < 4 || w.length > 24) continue;
    if (STOP.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

function hashColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 85% 62%)`;
}

type Props = {
  onOpenIdea: (id: string) => void;
  onBack?: () => void;
};

export const GraphPage = ({ onOpenIdea, onBack }: Props) => {
  const { data: folders = [] } = useFolders();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const hoverRef = useRef<string | null>(null);
  const draggingRef = useRef<{ id: string | null; px: number; py: number; panning: boolean }>({ id: null, px: 0, py: 0, panning: false });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);

  const folderColor = useMemo(() => {
    const m = new Map<string, string>();
    folders.forEach((f) => m.set(f.id, hashColor(f.id + f.name)));
    return m;
  }, [folders]);

  const ideasQuery = useQuery({
    queryKey: ["graph-ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ideas")
        .select("id,title,folder_id,raw_note,ai_summary,extracted_text")
        .order("updated_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refsQuery = useQuery({
    queryKey: ["graph-refs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("idea_references")
        .select("idea_id,url,title");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build nodes + edges
  useEffect(() => {
    if (!ideasQuery.data) return;
    const ideas = ideasQuery.data;
    const W = size.w, H = size.h;

    // tokens per idea
    const ideaTokens = new Map<string, string[]>();
    ideas.forEach((i: any) => {
      const t = tokens(`${i.title ?? ""} ${i.raw_note ?? ""} ${i.ai_summary ?? ""}`).slice(0, 12);
      ideaTokens.set(i.id, t);
    });

    // edges
    const edgeMap = new Map<string, GraphEdge>();
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const addEdge = (a: string, b: string, w: number, kind: GraphEdge["kind"]) => {
      if (a === b) return;
      const k = key(a, b);
      const e = edgeMap.get(k);
      if (e) { e.w = Math.max(e.w, w); if (kind === "ref") e.kind = "ref"; }
      else edgeMap.set(k, { a, b, w, kind });
    };

    // same-folder edges (lightly, only nearest neighbours by recency)
    const byFolder = new Map<string, any[]>();
    ideas.forEach((i: any) => {
      if (!i.folder_id) return;
      const arr = byFolder.get(i.folder_id) ?? [];
      arr.push(i); byFolder.set(i.folder_id, arr);
    });
    byFolder.forEach((arr) => {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < Math.min(arr.length, i + 4); j++) {
          addEdge(arr[i].id, arr[j].id, 0.4, "folder");
        }
      }
    });

    // shared keyword edges (cap to keep it readable)
    const tokenIndex = new Map<string, string[]>();
    ideaTokens.forEach((toks, id) => {
      toks.forEach((t) => {
        const a = tokenIndex.get(t) ?? [];
        a.push(id); tokenIndex.set(t, a);
      });
    });
    tokenIndex.forEach((ids, tok) => {
      if (ids.length < 2 || ids.length > 8) return; // skip ultra-common words
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          addEdge(ids[i], ids[j], 0.7, "kw");
        }
      }
    });

    // explicit refs — connect ideas that reference overlapping URLs
    if (refsQuery.data) {
      const byUrl = new Map<string, string[]>();
      refsQuery.data.forEach((r: any) => {
        if (!r.url) return;
        const a = byUrl.get(r.url) ?? [];
        a.push(r.idea_id); byUrl.set(r.url, a);
      });
      byUrl.forEach((ids) => {
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++)
            addEdge(ids[i], ids[j], 1.2, "ref");
      });
    }

    const edges = [...edgeMap.values()];

    // degree map
    const degree = new Map<string, number>();
    edges.forEach((e) => {
      degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
      degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
    });

    // nodes
    const nodes: GraphNode[] = ideas.map((i: any) => {
      const deg = degree.get(i.id) ?? 0;
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * Math.min(W, H) * 0.35;
      return {
        id: i.id,
        title: i.title || "Untitled",
        folderId: i.folder_id,
        x: W / 2 + Math.cos(angle) * radius,
        y: H / 2 + Math.sin(angle) * radius,
        vx: 0, vy: 0,
        r: 4 + Math.min(14, deg * 1.2),
        color: i.folder_id ? (folderColor.get(i.folder_id) ?? "hsl(262 80% 65%)") : "hsl(200 8% 70%)",
        degree: deg,
      };
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
    setReady(true);
  }, [ideasQuery.data, refsQuery.data, folderColor, size.w, size.h]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, Math.floor(r.width)), h: Math.max(320, Math.floor(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Simulation + render loop
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let alpha = 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.scale(dpr, dpr);

    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const W = size.w, H = size.h;
      const cx = W / 2, cy = H / 2;

      // Repulsion (n^2 — fine for <=400)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { d2 = 0.01; dx = Math.random(); dy = Math.random(); }
          const d = Math.sqrt(d2);
          const f = (800 * alpha) / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      // Spring edges
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.a);
        const b = nodes.find((n) => n.id === e.b);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = 90 / e.w;
        const k = 0.02 * alpha;
        const f = (d - target) * k;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Gravity to center
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.002;
        n.vy += (cy - n.y) * 0.002;
        n.vx *= 0.86; n.vy *= 0.86;
        if (draggingRef.current.id !== n.id) {
          n.x += n.vx; n.y += n.vy;
        }
      }
      alpha = Math.max(0.05, alpha * 0.995);

      // Render
      ctx.clearRect(0, 0, W, H);
      const cam = cameraRef.current;
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      // edges
      const hover = hoverRef.current;
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.a);
        const b = nodes.find((n) => n.id === e.b);
        if (!a || !b) continue;
        const active = hover && (a.id === hover || b.id === hover);
        ctx.strokeStyle = active
          ? "rgba(168,85,247,0.85)"
          : e.kind === "ref" ? "rgba(34,211,238,0.28)"
          : e.kind === "kw" ? "rgba(168,85,247,0.16)"
          : "rgba(255,255,255,0.08)";
        ctx.lineWidth = active ? 1.4 : 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // nodes
      const q = search.trim().toLowerCase();
      for (const n of nodes) {
        const match = q && n.title.toLowerCase().includes(q);
        const isHover = hover === n.id;
        ctx.beginPath();
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = isHover || match ? 22 : 8;
        ctx.arc(n.x, n.y, n.r + (isHover ? 2 : 0), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isHover || match || n.r > 9) {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = "12px ui-sans-serif, system-ui";
          ctx.textAlign = "center";
          ctx.fillText(n.title.slice(0, 28), n.x, n.y - n.r - 6);
        }
      }
      ctx.restore();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready, size.w, size.h, search]);

  // Pointer interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toWorld = (cx: number, cy: number) => {
      const cam = cameraRef.current;
      return { x: (cx - cam.x) / cam.zoom, y: (cy - cam.y) / cam.zoom };
    };
    const pick = (cx: number, cy: number) => {
      const { x, y } = toWorld(cx, cy);
      const ns = nodesRef.current;
      for (let i = ns.length - 1; i >= 0; i--) {
        const n = ns[i];
        const dx = n.x - x, dy = n.y - y;
        if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n;
      }
      return null;
    };
    const onMove = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const drag = draggingRef.current;
      if (drag.id) {
        const { x, y } = toWorld(cx, cy);
        const n = nodesRef.current.find((m) => m.id === drag.id);
        if (n) { n.x = x; n.y = y; n.vx = 0; n.vy = 0; }
      } else if (drag.panning) {
        cameraRef.current.x += cx - drag.px;
        cameraRef.current.y += cy - drag.py;
        drag.px = cx; drag.py = cy;
      } else {
        const hit = pick(cx, cy);
        hoverRef.current = hit?.id ?? null;
        canvas.style.cursor = hit ? "pointer" : "grab";
      }
    };
    const onDown = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const hit = pick(cx, cy);
      if (hit) draggingRef.current = { id: hit.id, px: cx, py: cy, panning: false };
      else draggingRef.current = { id: null, px: cx, py: cy, panning: true };
      canvas.setPointerCapture(ev.pointerId);
    };
    const onUp = (ev: PointerEvent) => {
      const drag = draggingRef.current;
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const movedFar = Math.abs(cx - drag.px) > 4 || Math.abs(cy - drag.py) > 4;
      if (drag.id && !movedFar) onOpenIdea(drag.id);
      draggingRef.current = { id: null, px: 0, py: 0, panning: false };
      try { canvas.releasePointerCapture(ev.pointerId); } catch { /* */ }
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const cam = cameraRef.current;
      const factor = Math.exp(-ev.deltaY * 0.0015);
      const nextZoom = Math.min(3, Math.max(0.3, cam.zoom * factor));
      // zoom around cursor
      cam.x = cx - (cx - cam.x) * (nextZoom / cam.zoom);
      cam.y = cy - (cy - cam.y) * (nextZoom / cam.zoom);
      cam.zoom = nextZoom;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [onOpenIdea]);

  const recenter = () => {
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-0 overflow-hidden"
      style={{ paddingBottom: "var(--mobile-tabbar-h, 0px)" }}
    >
      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
            aria-label="Back"
          >
            <MaterialIcon name="arrow_back" size={20} />
          </button>
        )}
        <div className="flex-1 max-w-md relative">
          <MaterialIcon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Highlight nodes…"
            className="w-full h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 pl-9 pr-3 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />
        </div>
        <button
          onClick={recenter}
          className="h-9 px-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[13px] text-white/80 hover:text-white inline-flex items-center gap-1.5"
        >
          <MaterialIcon name="my_location" size={16} />
          Recenter
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 text-[11px] text-white/70 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2">
        <div className="flex items-center gap-2"><span className="h-2 w-6 rounded-full" style={{ background: "rgba(34,211,238,0.7)" }} /> shared reference</div>
        <div className="flex items-center gap-2"><span className="h-2 w-6 rounded-full" style={{ background: "rgba(168,85,247,0.55)" }} /> shared keyword</div>
        <div className="flex items-center gap-2"><span className="h-2 w-6 rounded-full" style={{ background: "rgba(255,255,255,0.35)" }} /> same folder</div>
      </div>

      {/* Stats */}
      <div className="absolute top-16 right-3 z-10 text-[11px] text-white/60 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2">
        {nodesRef.current.length} ideas · {edgesRef.current.length} links
      </div>

      {/* Background glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <canvas
        ref={canvasRef}
        className={cn("block touch-none select-none", !ready && "opacity-0")}
      />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
          Mapping your brain…
        </div>
      )}
    </div>
  );
};
