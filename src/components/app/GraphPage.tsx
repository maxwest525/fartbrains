import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useFolders } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";

type EdgeKind = "folder" | "ref" | "kw";

type GraphNode = {
  id: string;
  title: string;
  folderId: string | null;
  tokens: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  degree: number;
};

type GraphEdge = { a: string; b: string; w: number; kind: EdgeKind };

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

const EDGE_STYLE: Record<EdgeKind, { stroke: string; label: string; icon: string }> = {
  ref:    { stroke: "rgba(34,211,238,0.45)",  label: "Shared reference", icon: "link" },
  kw:     { stroke: "rgba(168,85,247,0.28)",  label: "Shared keyword",   icon: "tag" },
  folder: { stroke: "rgba(255,255,255,0.16)", label: "Same folder",      icon: "folder" },
};

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
  const visibleNodeIdsRef = useRef<Set<string>>(new Set());
  const enabledKindsRef = useRef<Record<EdgeKind, boolean>>({ folder: true, ref: true, kw: true });
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1, animating: false });
  const hoverRef = useRef<string | null>(null);
  const draggingRef = useRef<{ id: string | null; px: number; py: number; panning: boolean }>({ id: null, px: 0, py: 0, panning: false });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);

  const [enabledKinds, setEnabledKinds] = useState<Record<EdgeKind, boolean>>({ folder: true, ref: true, kw: true });
  const [folderFilter, setFolderFilter] = useState<Set<string>>(new Set()); // empty = all
  const [keywordFilter, setKeywordFilter] = useState<Set<string>>(new Set()); // empty = no constraint
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { enabledKindsRef.current = enabledKinds; }, [enabledKinds]);

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
        .select("id,title,folder_id,raw_note,ai_summary,extracted_text,tags")
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

    const ideaTokens = new Map<string, string[]>();
    ideas.forEach((i: any) => {
      const t = tokens(`${i.title ?? ""} ${i.raw_note ?? ""} ${i.ai_summary ?? ""}`).slice(0, 12);
      ideaTokens.set(i.id, t);
    });

    const edgeMap = new Map<string, GraphEdge>();
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const addEdge = (a: string, b: string, w: number, kind: EdgeKind) => {
      if (a === b) return;
      const k = key(a, b);
      const e = edgeMap.get(k);
      if (e) {
        e.w = Math.max(e.w, w);
        // priority: ref > kw > folder
        if (kind === "ref" || (kind === "kw" && e.kind === "folder")) e.kind = kind;
      } else edgeMap.set(k, { a, b, w, kind });
    };

    // Folder edges: only link each idea to its 1 nearest folder-mate (low weight).
    // Folders alone would create a giant cluster — keep them as a faint scaffold.
    const byFolder = new Map<string, any[]>();
    ideas.forEach((i: any) => {
      if (!i.folder_id) return;
      const arr = byFolder.get(i.folder_id) ?? [];
      arr.push(i); byFolder.set(i.folder_id, arr);
    });
    byFolder.forEach((arr) => {
      for (let i = 0; i < arr.length; i++) {
        // chain: i → i+1 only, so a folder is a thin necklace not a clique
        if (i + 1 < arr.length) addEdge(arr[i].id, arr[i + 1].id, 0.25, "folder");
      }
    });

    // Keyword edges: stricter. Require longer tokens, ignore very common ones,
    // and only emit when a token is shared by 2-4 ideas (otherwise it's noise).
    const tokenIndex = new Map<string, string[]>();
    ideaTokens.forEach((toks, id) => {
      toks.forEach((t) => {
        if (t.length < 5) return;
        const a = tokenIndex.get(t) ?? [];
        a.push(id); tokenIndex.set(t, a);
      });
    });
    // Count shared tokens between pairs — require at least 2 shared tokens to draw an edge.
    const pairShared = new Map<string, number>();
    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    tokenIndex.forEach((ids) => {
      if (ids.length < 2 || ids.length > 4) return;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const k = pairKey(ids[i], ids[j]);
          pairShared.set(k, (pairShared.get(k) ?? 0) + 1);
        }
      }
    });
    pairShared.forEach((count, k) => {
      if (count < 2) return;
      const [a, b] = k.split("|");
      addEdge(a, b, 0.6 + Math.min(count, 4) * 0.2, "kw");
    });

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

    const degree = new Map<string, number>();
    edges.forEach((e) => {
      degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
      degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
    });

    const nodes: GraphNode[] = ideas.map((i: any) => {
      const deg = degree.get(i.id) ?? 0;
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * Math.min(W, H) * 0.35;
      return {
        id: i.id,
        title: i.title || "Untitled",
        folderId: i.folder_id,
        tokens: ideaTokens.get(i.id) ?? [],
        x: W / 2 + Math.cos(angle) * radius,
        y: H / 2 + Math.sin(angle) * radius,
        vx: 0, vy: 0,
        r: 2.5 + Math.min(7, deg * 0.6),
        color: i.folder_id ? (folderColor.get(i.folder_id) ?? "hsl(262 80% 65%)") : "hsl(200 8% 70%)",
        degree: deg,
      };
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
    setReady(true);
  }, [ideasQuery.data, refsQuery.data, folderColor, size.w, size.h]);

  // Top keywords for filter chips
  const topKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    nodesRef.current.forEach((n) => n.tokens.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([t]) => t);
  }, [ready, ideasQuery.data]);

  // Compute visible set based on filters
  useEffect(() => {
    const vis = new Set<string>();
    const useFolder = folderFilter.size > 0;
    const useKw = keywordFilter.size > 0;
    for (const n of nodesRef.current) {
      if (useFolder) {
        const key = n.folderId ?? "__none__";
        if (!folderFilter.has(key)) continue;
      }
      if (useKw) {
        if (!n.tokens.some((t) => keywordFilter.has(t))) continue;
      }
      vis.add(n.id);
    }
    visibleNodeIdsRef.current = vis;
  }, [folderFilter, keywordFilter, ready]);

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
      const enabledNow = enabledKindsRef.current;
      const visible = visibleNodeIdsRef.current;
      const hasFilter = visible.size > 0 && visible.size !== nodes.length;
      const isVis = (id: string) => !hasFilter || visible.has(id);
      const W = size.w, H = size.h;
      const cx = W / 2, cy = H / 2;

      // Repulsion
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
      // Spring edges (only enabled)
      for (const e of edges) {
        if (!enabledNow[e.kind]) continue;
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
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.002;
        n.vy += (cy - n.y) * 0.002;
        n.vx *= 0.86; n.vy *= 0.86;
        if (draggingRef.current.id !== n.id) {
          n.x += n.vx; n.y += n.vy;
        }
      }
      alpha = Math.max(0.05, alpha * 0.995);

      // Camera tween
      const cam = cameraRef.current;
      if (cam.animating) {
        cam.x += (cam.tx - cam.x) * 0.18;
        cam.y += (cam.ty - cam.y) * 0.18;
        cam.zoom += (cam.tz - cam.zoom) * 0.18;
        if (Math.abs(cam.tx - cam.x) < 0.3 && Math.abs(cam.ty - cam.y) < 0.3 && Math.abs(cam.tz - cam.zoom) < 0.005) {
          cam.x = cam.tx; cam.y = cam.ty; cam.zoom = cam.tz; cam.animating = false;
        }
      }

      // Render
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      const hover = hoverRef.current;
      const q = search.trim().toLowerCase();
      const matchSet = new Set<string>();
      if (q) for (const n of nodes) if (n.title.toLowerCase().includes(q)) matchSet.add(n.id);
      const hasQuery = matchSet.size > 0;

      // edges
      for (const e of edges) {
        if (!enabledNow[e.kind]) continue;
        if (!isVis(e.a) || !isVis(e.b)) continue;
        const a = nodes.find((n) => n.id === e.a);
        const b = nodes.find((n) => n.id === e.b);
        if (!a || !b) continue;
        const active = hover && (a.id === hover || b.id === hover);
        const dim = hasQuery && !(matchSet.has(a.id) || matchSet.has(b.id));
        ctx.strokeStyle = active
          ? "rgba(168,85,247,0.95)"
          : dim
          ? "rgba(255,255,255,0.04)"
          : EDGE_STYLE[e.kind].stroke;
        ctx.lineWidth = active ? 1.6 : 0.7;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // nodes
      for (const n of nodes) {
        const visN = isVis(n.id);
        const match = matchSet.has(n.id);
        const dim = (hasQuery && !match) || !visN;
        const isHover = hover === n.id;
        const alphaNode = dim ? 0.22 : 1;
        ctx.globalAlpha = alphaNode;

        // outer halo
        if (isHover || match) {
          ctx.beginPath();
          ctx.fillStyle = n.color;
          ctx.globalAlpha = 0.18 * alphaNode;
          ctx.arc(n.x, n.y, n.r + 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alphaNode;
        }

        ctx.beginPath();
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = isHover || match ? 24 : 10;
        ctx.arc(n.x, n.y, n.r + (isHover ? 2 : 0), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // inner highlight
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.arc(n.x - n.r * 0.3, n.y - n.r * 0.3, Math.max(1, n.r * 0.35), 0, Math.PI * 2);
        ctx.fill();

        if (isHover || match || n.r > 9) {
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = `${isHover || match ? 13 : 12}px ui-sans-serif, system-ui`;
          ctx.textAlign = "center";
          ctx.fillText(n.title.slice(0, 28), n.x, n.y - n.r - 6);
        }
        ctx.globalAlpha = 1;
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
      const vis = visibleNodeIdsRef.current;
      const hasFilter = vis.size > 0 && vis.size !== ns.length;
      for (let i = ns.length - 1; i >= 0; i--) {
        const n = ns[i];
        if (hasFilter && !vis.has(n.id)) continue;
        const dx = n.x - x, dy = n.y - y;
        if (dx * dx + dy * dy <= (n.r + 6) * (n.r + 6)) return n;
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
        cameraRef.current.animating = false;
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
      cam.x = cx - (cx - cam.x) * (nextZoom / cam.zoom);
      cam.y = cy - (cy - cam.y) * (nextZoom / cam.zoom);
      cam.zoom = nextZoom;
      cam.animating = false;
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
    const cam = cameraRef.current;
    cam.tx = 0; cam.ty = 0; cam.tz = 1; cam.animating = true;
  };

  const focusOnMatch = () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const hit = nodesRef.current.find((n) => n.title.toLowerCase().includes(q));
    if (!hit) return;
    const targetZoom = 1.6;
    const cam = cameraRef.current;
    cam.tz = targetZoom;
    cam.tx = size.w / 2 - hit.x * targetZoom;
    cam.ty = size.h / 2 - hit.y * targetZoom;
    cam.animating = true;
    hoverRef.current = hit.id;
  };

  const toggleKind = (k: EdgeKind) => setEnabledKinds((p) => ({ ...p, [k]: !p[k] }));

  const toggleFolder = (id: string) => {
    setFolderFilter((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleKeyword = (k: string) => {
    setKeywordFilter((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const clearFilters = () => { setFolderFilter(new Set()); setKeywordFilter(new Set()); };
  const filterCount = folderFilter.size + keywordFilter.size;

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-0 overflow-hidden"
      style={{ paddingBottom: "var(--mobile-tabbar-h, 0px)" }}
    >
      {/* Top toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="h-9 w-9 shrink-0 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
            aria-label="Back"
          >
            <MaterialIcon name="arrow_back" size={20} />
          </button>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); focusOnMatch(); }}
          className="flex-1 max-w-md relative"
        >
          <MaterialIcon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ideas… (Enter to focus)"
            className="w-full h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 pl-9 pr-9 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-white/50 hover:text-white"
              aria-label="Clear"
            >
              <MaterialIcon name="close" size={14} />
            </button>
          )}
        </form>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-full backdrop-blur-md border text-[13px] inline-flex items-center gap-1.5 transition-colors",
            filtersOpen || filterCount
              ? "bg-violet-500/20 border-violet-400/40 text-white"
              : "bg-black/40 border-white/10 text-white/80 hover:text-white"
          )}
          aria-label="Filters"
        >
          <MaterialIcon name="tune" size={16} />
          <span className="hidden sm:inline">Filters</span>
          {filterCount > 0 && (
            <span className="ml-0.5 h-5 min-w-[20px] px-1 rounded-full bg-violet-500/80 text-[10px] font-semibold flex items-center justify-center">{filterCount}</span>
          )}
        </button>
        <button
          onClick={recenter}
          className="h-9 w-9 shrink-0 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
          aria-label="Recenter"
          title="Recenter"
        >
          <MaterialIcon name="my_location" size={16} />
        </button>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="absolute top-14 right-3 z-10 w-[min(360px,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-3 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold text-white">Filters</h3>
            {filterCount > 0 && (
              <button onClick={clearFilters} className="text-[11px] text-white/60 hover:text-white">Clear all</button>
            )}
          </div>

          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Folders</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => toggleFolder("__none__")}
                className={cn(
                  "px-2.5 h-7 rounded-full text-[11px] border inline-flex items-center gap-1.5 transition-colors",
                  folderFilter.has("__none__")
                    ? "bg-white/20 border-white/30 text-white"
                    : "bg-white/[0.04] border-white/10 text-white/70 hover:text-white"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-white/40" />
                Unfiled
              </button>
              {folders.map((f) => {
                const active = folderFilter.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFolder(f.id)}
                    className={cn(
                      "px-2.5 h-7 rounded-full text-[11px] border inline-flex items-center gap-1.5 transition-colors",
                      active
                        ? "bg-white/15 border-white/30 text-white"
                        : "bg-white/[0.04] border-white/10 text-white/70 hover:text-white"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: folderColor.get(f.id) }} />
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>

          {topKeywords.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Keywords</div>
              <div className="flex flex-wrap gap-1.5">
                {topKeywords.map((k) => {
                  const active = keywordFilter.has(k);
                  return (
                    <button
                      key={k}
                      onClick={() => toggleKeyword(k)}
                      className={cn(
                        "px-2.5 h-7 rounded-full text-[11px] border transition-colors",
                        active
                          ? "bg-violet-500/30 border-violet-400/50 text-white"
                          : "bg-white/[0.04] border-white/10 text-white/70 hover:text-white"
                      )}
                    >
                      #{k}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend + edge toggles */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 text-[11px] text-white/70 bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl px-2.5 py-2 shadow-2xl">
        <div className="px-1 pb-0.5 text-[10px] uppercase tracking-wider text-white/40">Connections</div>
        {(["ref", "kw", "folder"] as EdgeKind[]).map((k) => {
          const on = enabledKinds[k];
          return (
            <button
              key={k}
              onClick={() => toggleKind(k)}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-lg transition-colors text-left",
                on ? "text-white hover:bg-white/10" : "text-white/35 hover:bg-white/5"
              )}
            >
              <span className="h-2 w-6 rounded-full" style={{ background: on ? EDGE_STYLE[k].stroke.replace(/0\.\d+/, "0.85") : "rgba(255,255,255,0.1)" }} />
              <span className="flex-1">{EDGE_STYLE[k].label}</span>
              <MaterialIcon name={on ? "visibility" : "visibility_off"} size={14} />
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="absolute top-14 left-3 z-10 text-[11px] text-white/60 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
        {nodesRef.current.length} ideas · {edgesRef.current.length} links
      </div>

      {/* Background glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-fuchsia-500/5 blur-3xl" />
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
