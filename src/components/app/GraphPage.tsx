import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { useFolders } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";

type EdgeKind = "tag" | "folder" | "ref" | "kw";

type GraphNode = {
  id: string;
  title: string;
  folderId: string | null;
  tags: string[];
  primaryTag: string | null;
  tokens: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  degree: number;
};

type GraphEdge = { a: string; b: string; w: number; kind: EdgeKind; label?: string };

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
  tag:    { stroke: "rgba(244,114,182,0.50)", label: "Shared tag",       icon: "label" },
  ref:    { stroke: "rgba(34,211,238,0.45)",  label: "Shared reference", icon: "link" },
  kw:     { stroke: "rgba(168,85,247,0.28)",  label: "Shared keyword",   icon: "tag" },
  folder: { stroke: "rgba(255,255,255,0.16)", label: "Same folder",      icon: "folder" },
};

type Props = {
  onOpenIdea: (id: string) => void;
  onBack?: () => void;
};

const LS_KEY = "graph-tuning-v1";
type Tuning = {
  repulsion: number;     // 0..1
  linkStrength: number;  // 0..1
  tagGravity: number;    // 0..1 — how hard tags pull their cluster together
  strictness: number;    // 1..5 — min shared signal before drawing edges
  clusterCount: number;  // 2..10 — forced max number of distinct tag clusters
  labelsAlwaysOn: boolean; // show label under every node
  labelSize: number;     // 9..16 px
};
const DEFAULT_TUNING: Tuning = { repulsion: 0.75, linkStrength: 0.5, tagGravity: 0.95, strictness: 2, clusterCount: 8, labelsAlwaysOn: true, labelSize: 11 };

// Tracks whether the graph intro animation has already played this session,
// so re-entering the Graph view doesn't replay the spin every time.
let __graphIntroPlayed = false;
const prefersReducedMotion = () => {
  try { return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};


export const GraphPage = ({ onOpenIdea, onBack }: Props) => {
  const { data: folders = [] } = useFolders();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const tagAnchorsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const visibleNodeIdsRef = useRef<Set<string>>(new Set());
  const enabledKindsRef = useRef<Record<EdgeKind, boolean>>({ tag: true, folder: true, ref: true, kw: true });
  const tuningRef = useRef<Tuning>(DEFAULT_TUNING);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 0.6, tx: 0, ty: 0, tz: 0.6, animating: false });
  const introRef = useRef<{ start: number; duration: number } | null>(null);
  const reducedMotionRef = useRef<boolean>(prefersReducedMotion());

  const hoverRef = useRef<string | null>(null);
  const draggingRef = useRef<{ id: string | null; px: number; py: number; panning: boolean }>({ id: null, px: 0, py: 0, panning: false });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);

  const [enabledKinds, setEnabledKinds] = useState<Record<EdgeKind, boolean>>({ tag: true, folder: true, ref: true, kw: true });
  const [folderFilter, setFolderFilter] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"filters" | "clusters" | "legend">("filters");
  const [selectedId, setSelectedId] = useState<string | null>(null);



  // Hides bottom overlays (legend + zoom) so the cluster gets the full viewport.
  const [overlaysHidden, setOverlaysHidden] = useState<boolean>(() => {
    try { return window.localStorage.getItem("graph-overlays-hidden") === "1"; } catch { return false; }
  });
  const toggleOverlays = () => setOverlaysHidden((v) => {
    const next = !v;
    try { window.localStorage.setItem("graph-overlays-hidden", next ? "1" : "0"); } catch { /* */ }
    return next;
  });



  // Tuning persisted to localStorage
  const [tuning, setTuning] = useState<Tuning>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
      if (raw) return { ...DEFAULT_TUNING, ...JSON.parse(raw) };
    } catch { /* */ }
    return DEFAULT_TUNING;
  });
  useEffect(() => {
    tuningRef.current = tuning;
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(tuning)); } catch { /* */ }
  }, [tuning]);

  useEffect(() => { enabledKindsRef.current = enabledKinds; }, [enabledKinds]);

  // Track prefers-reduced-motion live so a mid-session toggle is respected.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotionRef.current = mql.matches; };
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

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

  // Build nodes + edges. Re-runs when ideas, refs, or strictness change.
  useEffect(() => {
    if (!ideasQuery.data) return;
    const ideas = ideasQuery.data;
    const W = size.w, H = size.h;
    const strict = tuning.strictness;

    // Normalize tags per idea
    const ideaTagsRaw = new Map<string, string[]>();
    ideas.forEach((i: any) => {
      const t = Array.isArray(i.tags)
        ? i.tags.map((s: string) => String(s).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")).filter((s: string) => s.length >= 2)
        : [];
      ideaTagsRaw.set(i.id, [...new Set<string>(t)]);
    });

    // Count tag frequency to pick "primary tag" per idea (= most common tag in dataset)
    const tagCount = new Map<string, number>();
    ideaTagsRaw.forEach((ts) => ts.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
    const ideaPrimaryTag = new Map<string, string | null>();
    ideaTagsRaw.forEach((ts, id) => {
      let best: string | null = null;
      let bestCount = 0;
      for (const t of ts) {
        const c = tagCount.get(t) ?? 0;
        if (c > bestCount) { best = t; bestCount = c; }
      }
      ideaPrimaryTag.set(id, best);
    });

    const ideaTokens = new Map<string, string[]>();
    ideas.forEach((i: any) => {
      const t = tokens(`${i.title ?? ""} ${i.raw_note ?? ""} ${i.ai_summary ?? ""}`).slice(0, 10);
      ideaTokens.set(i.id, t);
    });

    const edgeMap = new Map<string, GraphEdge>();
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const addEdge = (a: string, b: string, w: number, kind: EdgeKind, label?: string) => {
      if (a === b) return;
      const k = key(a, b);
      const e = edgeMap.get(k);
      if (e) {
        e.w = Math.max(e.w, w);
        // priority: ref > tag > kw > folder
        const rank = { ref: 4, tag: 3, kw: 2, folder: 1 } as Record<EdgeKind, number>;
        if (rank[kind] > rank[e.kind]) { e.kind = kind; if (label) e.label = label; }
        else if (!e.label && label) e.label = label;
      } else edgeMap.set(k, { a, b, w, kind, label });
    };

    // Tag edges — strong, drive clustering. Pair ideas that share a tag.
    // For very popular tags (used by lots of ideas), require more shared tags
    // so we don't make every idea a hub.
    const byTag = new Map<string, string[]>();
    ideaTagsRaw.forEach((ts, id) => {
      ts.forEach((t) => {
        const a = byTag.get(t) ?? [];
        a.push(id); byTag.set(t, a);
      });
    });
    const pairTagShared = new Map<string, { count: number; tags: string[] }>();
    byTag.forEach((ids, tag) => {
      if (ids.length < 2) return;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const k = key(ids[i], ids[j]);
          const cur = pairTagShared.get(k) ?? { count: 0, tags: [] };
          cur.count += 1;
          cur.tags.push(tag);
          pairTagShared.set(k, cur);
        }
      }
    });
    pairTagShared.forEach(({ count, tags }, k) => {
      // strictness 1 → any shared tag connects; strictness 5 → need 3+ shared tags
      const minShared = Math.max(1, Math.ceil(strict / 2));
      if (count < minShared) return;
      const [a, b] = k.split("|");
      // pick rarest shared tag as label (most informative)
      const label = tags.slice().sort((x, y) => (tagCount.get(x) ?? 0) - (tagCount.get(y) ?? 0))[0];
      addEdge(a, b, 0.9 + Math.min(count, 4) * 0.3, "tag", `#${label}`);
    });

    // Folder edges: faint scaffold chain (only with strictness ≤ 3)
    if (strict <= 3) {
      const byFolder = new Map<string, any[]>();
      ideas.forEach((i: any) => {
        if (!i.folder_id) return;
        const arr = byFolder.get(i.folder_id) ?? [];
        arr.push(i); byFolder.set(i.folder_id, arr);
      });
      byFolder.forEach((arr) => {
        for (let i = 0; i < arr.length; i++) {
          if (i + 1 < arr.length) addEdge(arr[i].id, arr[i + 1].id, 0.25, "folder");
        }
      });
    }

    // Keyword edges: stricter. Increase floor with strictness slider.
    const tokenIndex = new Map<string, string[]>();
    ideaTokens.forEach((toks, id) => {
      toks.forEach((t) => {
        if (t.length < 5) return;
        const a = tokenIndex.get(t) ?? [];
        a.push(id); tokenIndex.set(t, a);
      });
    });
    const pairShared = new Map<string, { count: number; tokens: string[] }>();
    const maxCluster = Math.max(2, 6 - strict); // strict=1 → up to 5; strict=5 → only pairs
    tokenIndex.forEach((ids, tok) => {
      if (ids.length < 2 || ids.length > maxCluster) return;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const k = key(ids[i], ids[j]);
          const cur = pairShared.get(k) ?? { count: 0, tokens: [] };
          cur.count += 1;
          cur.tokens.push(tok);
          pairShared.set(k, cur);
        }
      }
    });
    const kwMinShared = Math.max(2, strict);
    pairShared.forEach(({ count, tokens: toks }, k) => {
      if (count < kwMinShared) return;
      const [a, b] = k.split("|");
      addEdge(a, b, 0.6 + Math.min(count, 4) * 0.2, "kw", toks[0]);
    });

    if (refsQuery.data) {
      const byUrl = new Map<string, string[]>();
      refsQuery.data.forEach((r: any) => {
        if (!r.url) return;
        const a = byUrl.get(r.url) ?? [];
        a.push(r.idea_id); byUrl.set(r.url, a);
      });
      byUrl.forEach((ids, url) => {
        let host = url;
        try { host = new URL(url).host.replace(/^www\./, ""); } catch { /* */ }
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++)
            addEdge(ids[i], ids[j], 1.2, "ref", host);
      });
    }

    const edges = [...edgeMap.values()];

    const degree = new Map<string, number>();
    edges.forEach((e) => {
      degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
      degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
    });

    // Tag anchors: lay top tags around a circle so they form distinct clusters.
    const topTags = [...tagCount.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(2, Math.min(10, tuning.clusterCount)))
      .map(([t]) => t);
    const topTagSet = new Set(topTags);
    const anchors = new Map<string, { x: number; y: number }>();
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.34;
    topTags.forEach((t, i) => {
      const ang = (i / Math.max(1, topTags.length)) * Math.PI * 2 - Math.PI / 2;
      anchors.set(t, { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R });
    });
    tagAnchorsRef.current = anchors;

    const nodes: GraphNode[] = ideas.map((i: any) => {
      const deg = degree.get(i.id) ?? 0;
      // Prefer a primary tag that is one of the displayed clusters
      const ts = ideaTagsRaw.get(i.id) ?? [];
      let pTag: string | null = null;
      let bestC = 0;
      for (const t of ts) {
        if (!topTagSet.has(t)) continue;
        const c = tagCount.get(t) ?? 0;
        if (c > bestC) { bestC = c; pTag = t; }
      }
      if (!pTag) pTag = ideaPrimaryTag.get(i.id) ?? null;
      const anchor = pTag ? anchors.get(pTag) : null;
      const angle = Math.random() * Math.PI * 2;
      const jitter = 30 + Math.random() * 60;
      const sx = anchor ? anchor.x + Math.cos(angle) * jitter : cx + (Math.random() - 0.5) * R;
      const sy = anchor ? anchor.y + Math.sin(angle) * jitter : cy + (Math.random() - 0.5) * R;
      const tagColor = pTag ? hashColor(`tag:${pTag}`) : null;
      const fColor = i.folder_id ? folderColor.get(i.folder_id) : null;
      return {
        id: i.id,
        title: i.title || "Untitled",
        folderId: i.folder_id,
        tags: ideaTagsRaw.get(i.id) ?? [],
        primaryTag: pTag,
        tokens: ideaTokens.get(i.id) ?? [],
        x: sx,
        y: sy,
        vx: 0, vy: 0,
        r: 2.5 + Math.min(7, deg * 0.6),
        color: tagColor ?? fColor ?? "hsl(220 10% 70%)",
        degree: deg,
      };
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
    if (!ready && !__graphIntroPlayed && !reducedMotionRef.current) {
      // Fast spin-and-settle; user reaches the compact view in under half a second.
      introRef.current = { start: performance.now(), duration: 380 };
      __graphIntroPlayed = true;
    } else {
      introRef.current = null;
    }
    setReady(true);


  }, [ideasQuery.data, refsQuery.data, folderColor, size.w, size.h, tuning.strictness, tuning.clusterCount]);

  // Top tags / keywords for filter chips
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    nodesRef.current.forEach((n) => n.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([t, c]) => ({ tag: t, count: c }));
  }, [ready, ideasQuery.data]);

  const topKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    nodesRef.current.forEach((n) => n.tokens.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([t]) => t);
  }, [ready, ideasQuery.data]);

  // Panel search — narrows the chips shown in the Filters tab.
  const panelQuery = search.trim().toLowerCase().replace(/^#/, "");
  const visibleTags = useMemo(
    () => (panelQuery ? topTags.filter(({ tag }) => tag.includes(panelQuery)) : topTags),
    [topTags, panelQuery],
  );
  const visibleKeywords = useMemo(
    () => (panelQuery ? topKeywords.filter((k) => k.includes(panelQuery)) : topKeywords),
    [topKeywords, panelQuery],
  );
  const visibleFolders = useMemo(
    () => (panelQuery ? folders.filter((f) => f.name.toLowerCase().includes(panelQuery)) : folders),
    [folders, panelQuery],
  );


  // Compute visible set based on filters
  useEffect(() => {
    const vis = new Set<string>();
    const useFolder = folderFilter.size > 0;
    const useKw = keywordFilter.size > 0;
    const useTag = tagFilter.size > 0;
    for (const n of nodesRef.current) {
      if (useFolder) {
        const k = n.folderId ?? "__none__";
        if (!folderFilter.has(k)) continue;
      }
      if (useKw && !n.tokens.some((t) => keywordFilter.has(t))) continue;
      if (useTag && !n.tags.some((t) => tagFilter.has(t))) continue;
      vis.add(n.id);
    }
    visibleNodeIdsRef.current = vis;
  }, [folderFilter, keywordFilter, tagFilter, ready]);

  // Snap-to-cluster when tag filter changes — pan to first selected tag's anchor
  useEffect(() => {
    if (!ready || tagFilter.size === 0) return;
    const firstTag = [...tagFilter][0];
    const anchor = tagAnchorsRef.current.get(firstTag);
    if (!anchor) return;
    const cam = cameraRef.current;
    const targetZoom = 1.4;
    cam.tz = targetZoom;
    cam.tx = size.w / 2 - anchor.x * targetZoom;
    cam.ty = size.h / 2 - anchor.y * targetZoom;
    cam.animating = true;
  }, [tagFilter, ready, size.w, size.h]);

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
      const tun = tuningRef.current;
      const visible = visibleNodeIdsRef.current;
      const hasFilter = visible.size > 0 && visible.size !== nodes.length;
      const isVis = (id: string) => !hasFilter || visible.has(id);
      const anchors = tagAnchorsRef.current;
      const W = size.w, H = size.h;
      const cx = W / 2, cy = H / 2;

      const repulseStrength = (400 + tun.repulsion * 1400) * (hasFilter ? 2.2 : 1); // spread out under filter
      const linkK = 0.005 + tun.linkStrength * 0.06;      // 0.005..0.065
      const tagPullK = (hasFilter ? 0 : tun.tagGravity) * 0.04; // disable tag wells when filtering

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { d2 = 0.01; dx = Math.random(); dy = Math.random(); }
          const d = Math.sqrt(d2);
          const f = (repulseStrength * alpha) / d2;
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
        const target = (90 / e.w) * (hasFilter ? 1.8 : 1);
        const k = linkK * alpha * (e.kind === "tag" ? 1.4 : 1);
        const f = (d - target) * k;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Tag gravity wells — pull each node toward its primary tag anchor
      if (tagPullK > 0) {
        for (const n of nodes) {
          if (!n.primaryTag) continue;
          const an = anchors.get(n.primaryTag);
          if (!an) continue;
          n.vx += (an.x - n.x) * tagPullK;
          n.vy += (an.y - n.y) * tagPullK;
        }
      }
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.001;
        n.vy += (cy - n.y) * 0.001;
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
      // Intro animation: spin + slope (Y-skew) that eases out
      const intro = introRef.current;
      let introRot = 0;
      let introSkew = 0;
      let introScale = 1;
      if (intro) {
        const t = Math.min(1, (performance.now() - intro.start) / intro.duration);
        if (t >= 1) {
          introRef.current = null;
        } else {
          const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
          const remain = 1 - ease;
          // Fast multi-turn spin that winds down, slightly spread (scale > 1 -> 1), no skew.
          introRot = remain * Math.PI * 2.5;     // ~1.25 turns -> 0 (snappier)
          introSkew = 0;
          introScale = 1.1 - 0.1 * ease;         // slight spread -> settle
        }
      }
      ctx.translate(cam.x, cam.y);
      if (introRot || introSkew || introScale !== 1) {
        ctx.translate(W / 2 - cam.x, H / 2 - cam.y);
        ctx.rotate(introRot);
        ctx.transform(1, introSkew, 0, 1, 0, 0);
        ctx.scale(introScale, introScale);
        ctx.translate(-(W / 2 - cam.x), -(H / 2 - cam.y));
      }
      ctx.scale(cam.zoom, cam.zoom);


      const hover = hoverRef.current;
      const q = search.trim().toLowerCase();
      const matchSet = new Set<string>();
      if (q) for (const n of nodes) if (n.title.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q))) matchSet.add(n.id);
      const hasQuery = matchSet.size > 0;

      // tag cluster halos (subtle background bubble per tag)
      anchors.forEach((pos, tag) => {
        ctx.beginPath();
        ctx.fillStyle = hashColor(`tag:${tag}`);
        ctx.globalAlpha = 0.05;
        ctx.arc(pos.x, pos.y, 110, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "11px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`#${tag}`, pos.x, pos.y - 118);
      });

      // edges
      const labeledEdges: { e: GraphEdge; ax: number; ay: number; bx: number; by: number; active: boolean }[] = [];
      for (const e of edges) {
        if (!enabledNow[e.kind]) continue;
        if (!isVis(e.a) || !isVis(e.b)) continue;
        const a = nodes.find((n) => n.id === e.a);
        const b = nodes.find((n) => n.id === e.b);
        if (!a || !b) continue;
        const active = !!hover && (a.id === hover || b.id === hover);
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
        // queue label if relevant — show on hover, or whenever a filter narrows the view
        if (e.label && !dim && (active || hasFilter)) {
          labeledEdges.push({ e, ax: a.x, ay: a.y, bx: b.x, by: b.y, active });
        }
      }

      // Edge labels — drawn after lines so they sit on top, rotated along the edge
      if (labeledEdges.length) {
        ctx.font = "10px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const { e, ax, ay, bx, by, active } of labeledEdges) {
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          let ang = Math.atan2(by - ay, bx - ax);
          if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI; // keep upright
          const label = e.label!;
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ang);
          const padX = 5;
          const w = ctx.measureText(label).width + padX * 2;
          ctx.fillStyle = active ? "rgba(168,85,247,0.85)" : "rgba(0,0,0,0.55)";
          ctx.fillRect(-w / 2, -8, w, 14);
          ctx.fillStyle = active ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.78)";
          ctx.fillText(label, 0, -1);
          ctx.restore();
        }
      }

      // nodes
      for (const n of nodes) {
        const visN = isVis(n.id);
        const match = matchSet.has(n.id);
        const dim = (hasQuery && !match) || !visN;
        const isHover = hover === n.id;
        const alphaNode = dim ? 0.22 : 1;
        ctx.globalAlpha = alphaNode;

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

        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.arc(n.x - n.r * 0.3, n.y - n.r * 0.3, Math.max(1, n.r * 0.35), 0, Math.PI * 2);
        ctx.fill();

        // Label density from tuning
        const focused = isHover || match || n.r > 9;
        const showLabel = tun.labelsAlwaysOn || focused;
        const short = n.primaryTag ? `#${n.primaryTag}` : n.title.slice(0, focused ? 28 : 16);
        ctx.textAlign = "center";
        if (showLabel) {
          if (focused) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.font = `${tun.labelSize + 2}px ui-sans-serif, system-ui`;
            ctx.fillText(n.title.slice(0, 28), n.x, n.y - n.r - 6);
            if (n.primaryTag) {
              ctx.fillStyle = "rgba(255,255,255,0.55)";
              ctx.font = `${Math.max(9, tun.labelSize - 1)}px ui-sans-serif, system-ui`;
              ctx.fillText(`#${n.primaryTag}`, n.x, n.y + n.r + 12);
            }
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.font = `${tun.labelSize}px ui-sans-serif, system-ui`;
            ctx.fillText(short, n.x, n.y - n.r - 5);
          }
        }
        ctx.globalAlpha = 1;

      }
      ctx.restore();

      // Minimap
      const mini = minimapRef.current;
      if (mini) {
        const mctx = mini.getContext("2d");
        if (mctx) {
          const MW = mini.width / dpr, MH = mini.height / dpr;
          // Compute world bounds from nodes
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const n of nodes) {
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x > maxX) maxX = n.x;
            if (n.y > maxY) maxY = n.y;
          }
          if (!isFinite(minX)) { minX = 0; minY = 0; maxX = W; maxY = H; }
          const pad = 40;
          minX -= pad; minY -= pad; maxX += pad; maxY += pad;
          const sx = MW / (maxX - minX);
          const sy = MH / (maxY - minY);
          const s = Math.min(sx, sy);
          const ox = (MW - (maxX - minX) * s) / 2 - minX * s;
          const oy = (MH - (maxY - minY) * s) / 2 - minY * s;
          mctx.clearRect(0, 0, MW, MH);
          mctx.fillStyle = "rgba(0,0,0,0.35)";
          mctx.fillRect(0, 0, MW, MH);
          // tag halos
          anchors.forEach((pos, tag) => {
            mctx.beginPath();
            mctx.fillStyle = hashColor(`tag:${tag}`);
            mctx.globalAlpha = 0.18;
            mctx.arc(pos.x * s + ox, pos.y * s + oy, 14, 0, Math.PI * 2);
            mctx.fill();
          });
          mctx.globalAlpha = 1;
          // nodes
          for (const n of nodes) {
            mctx.beginPath();
            mctx.fillStyle = n.color;
            mctx.arc(n.x * s + ox, n.y * s + oy, 1.4, 0, Math.PI * 2);
            mctx.fill();
          }
          // viewport rectangle (inverse of camera transform)
          const cam2 = cameraRef.current;
          const vx = (-cam2.x) / cam2.zoom;
          const vy = (-cam2.y) / cam2.zoom;
          const vw = W / cam2.zoom;
          const vh = H / cam2.zoom;
          mctx.strokeStyle = "rgba(255,255,255,0.85)";
          mctx.lineWidth = 1;
          mctx.strokeRect(vx * s + ox, vy * s + oy, vw * s, vh * s);
          // store transform for click-pan
          (mini as any).__tx = { s, ox, oy };
        }
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready, size.w, size.h, search]);

  // Pointer interaction (mouse + touch with pinch zoom)
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
        if (dx * dx + dy * dy <= (n.r + 8) * (n.r + 8)) return n;
      }
      return null;
    };
    const rectXY = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    const onMove = (ev: PointerEvent) => {
      const { x: cx, y: cy } = rectXY(ev);
      if (pointersRef.current.has(ev.pointerId)) {
        pointersRef.current.set(ev.pointerId, { x: cx, y: cy });
      }
      // Pinch zoom with two pointers
      if (pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()];
        const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        if (!pinchRef.current) {
          pinchRef.current = { dist, zoom: cameraRef.current.zoom, cx: midX, cy: midY };
        } else {
          const cam = cameraRef.current;
          const nextZoom = Math.min(3, Math.max(0.25, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
          // zoom around the midpoint
          cam.x = midX - (midX - cam.x) * (nextZoom / cam.zoom);
          cam.y = midY - (midY - cam.y) * (nextZoom / cam.zoom);
          cam.zoom = nextZoom;
          cam.animating = false;
        }
        return;
      }
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
      const { x: cx, y: cy } = rectXY(ev);
      pointersRef.current.set(ev.pointerId, { x: cx, y: cy });
      if (pointersRef.current.size >= 2) {
        // entering pinch — cancel any drag/pan
        draggingRef.current = { id: null, px: 0, py: 0, panning: false };
        pinchRef.current = null;
        return;
      }
      const hit = pick(cx, cy);
      if (hit) draggingRef.current = { id: hit.id, px: cx, py: cy, panning: false };
      else draggingRef.current = { id: null, px: cx, py: cy, panning: true };
      canvas.setPointerCapture(ev.pointerId);
    };
    const onUp = (ev: PointerEvent) => {
      const drag = draggingRef.current;
      const { x: cx, y: cy } = rectXY(ev);
      const movedFar = Math.abs(cx - drag.px) > 4 || Math.abs(cy - drag.py) > 4;
      if (drag.id && !movedFar && pointersRef.current.size <= 1) setSelectedId(drag.id);
      draggingRef.current = { id: null, px: 0, py: 0, panning: false };
      pointersRef.current.delete(ev.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      try { canvas.releasePointerCapture(ev.pointerId); } catch { /* */ }
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const cam = cameraRef.current;
      const factor = Math.exp(-ev.deltaY * 0.0015);
      const nextZoom = Math.min(3, Math.max(0.25, cam.zoom * factor));
      cam.x = cx - (cx - cam.x) * (nextZoom / cam.zoom);
      cam.y = cy - (cy - cam.y) * (nextZoom / cam.zoom);
      cam.zoom = nextZoom;
      cam.animating = false;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [onOpenIdea]);

  const centerCamera = (zoom = 0.6, animate = true) => {
    const cam = cameraRef.current;
    const W = size.w, H = size.h;
    const targetX = W / 2 - (W / 2) * zoom;
    const targetY = H / 2 - (H / 2) * zoom;
    cam.tx = targetX; cam.ty = targetY; cam.tz = zoom;
    if (!animate) { cam.x = targetX; cam.y = targetY; cam.zoom = zoom; cam.animating = false; }
    else cam.animating = true;
  };

  const recenter = () => centerCamera(0.9, true);

  // Initial centering after first layout / when the cluster (re)builds.
  const didCenterRef = useRef(false);
  useEffect(() => {
    if (!ready || size.w < 2 || size.h < 2) return;
    if (didCenterRef.current) return;
    didCenterRef.current = true;
    centerCamera(0.6, false);
  }, [ready, size.w, size.h]);

  const stepZoom = (dir: 1 | -1) => {
    const cam = cameraRef.current;
    const factor = dir === 1 ? 1.25 : 0.8;
    const mx = size.w / 2, my = size.h / 2;
    const nextZoom = Math.min(3, Math.max(0.25, cam.zoom * factor));
    cam.tx = mx - (mx - cam.x) * (nextZoom / cam.zoom);
    cam.ty = my - (my - cam.y) * (nextZoom / cam.zoom);
    cam.tz = nextZoom;
    cam.animating = true;
  };

  const focusOnMatch = () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const hit = nodesRef.current.find((n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q)));
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
  const toggleIn = <T,>(set: Set<T>, v: T): Set<T> => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    return n;
  };
  const toggleFolder = (id: string) => setFolderFilter((p) => toggleIn(p, id));
  const toggleKeyword = (k: string) => setKeywordFilter((p) => toggleIn(p, k));
  const toggleTag = (t: string) => setTagFilter((p) => toggleIn(p, t));
  const clearFilters = () => { setFolderFilter(new Set()); setKeywordFilter(new Set()); setTagFilter(new Set()); };
  const filterCount = folderFilter.size + keywordFilter.size + tagFilter.size;

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-0 overflow-hidden"
      style={{ paddingBottom: "var(--mobile-tabbar-h, 0px)" }}
    >
      {/* Top toolbar — single row: Back · Search · Settings */}
      <div className="absolute top-3 left-3 right-3 z-10">
        {(() => {
          const baseBtn = "h-9 rounded-full backdrop-blur-xl border flex items-center justify-center gap-1.5 px-3 transition-colors shadow-sm text-[12px] font-medium";
          const idle = "bg-white/15 border-white/25 text-foreground/85 hover:bg-white/25 hover:text-foreground";
          const activeViolet = "bg-violet-400/30 border-violet-300/60 text-foreground";
          return (
            <div className="flex items-center gap-2">
              {onBack ? (
                <button onClick={onBack} className={cn(baseBtn, idle)} aria-label="Back" title="Back">
                  <MaterialIcon name="arrow_back" size={16} />
                  <span>Back</span>
                </button>
              ) : null}

              <form
                onSubmit={(e) => { e.preventDefault(); focusOnMatch(); }}
                className="flex-1 min-w-0 relative"
              >
                <MaterialIcon name="search" size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/60 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search ideas or tags"
                  className="w-full h-9 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 pl-8 pr-8 text-[12px] leading-none text-foreground placeholder:text-foreground/55 outline-none focus:border-white/50 focus:bg-white/20 shadow-sm transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <MaterialIcon name="close" size={12} />
                  </button>
                )}
              </form>

              <button
                onClick={() => setPanelOpen((v) => !v)}
                className={cn(baseBtn, panelOpen ? activeViolet : idle, "relative")}
                aria-label="Graph settings"
                title="Graph settings"
              >
                <MaterialIcon name="tune" size={16} />
                <span>Settings</span>
                {filterCount > 0 && (
                  <span className="ml-0.5 h-4 min-w-[16px] px-1 rounded-full bg-violet-500 text-[9px] font-semibold flex items-center justify-center text-white">{filterCount}</span>
                )}
              </button>
            </div>
          );
        })()}
      </div>



      {panelOpen && (
        <div className="absolute top-[3.5rem] left-1/2 -translate-x-1/2 z-10 w-[min(360px,calc(100vw-1.5rem))] max-h-[72vh] overflow-y-auto rounded-2xl glass-card-clear p-3 shadow-2xl">
          {/* View controls */}
          <div className="flex items-center gap-1.5 mb-3">
            <button onClick={() => stepZoom(-1)} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/85" aria-label="Zoom out" title="Zoom out">
              <MaterialIcon name="remove" size={16} />
            </button>
            <button onClick={() => stepZoom(1)} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/85" aria-label="Zoom in" title="Zoom in">
              <MaterialIcon name="add" size={16} />
            </button>
            <button onClick={recenter} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/85" aria-label="Recenter" title="Recenter">
              <MaterialIcon name="my_location" size={16} />
            </button>
            <button onClick={toggleOverlays} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/85 ml-auto" aria-label={overlaysHidden ? "Show overlays" : "Hide overlays"} title={overlaysHidden ? "Show overlays" : "Hide overlays"}>
              <MaterialIcon name={overlaysHidden ? "visibility" : "visibility_off"} size={16} />
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 mb-3">
            {([
              { key: "filters", icon: "tune", label: "Filters" },
              { key: "clusters", icon: "hub", label: "Clusters" },
              { key: "legend", icon: "share", label: "Links" },
            ] as const).map((t) => {
              const active = panelTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setPanelTab(t.key)}
                  className={cn(
                    "flex-1 h-8 rounded-full text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors",
                    active ? "bg-white/25 text-white" : "text-white/70 hover:bg-white/10"
                  )}
                >
                  <MaterialIcon name={t.icon} size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {panelTab === "filters" && (

            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-white">Filters</h3>
                {filterCount > 0 && (
                  <button onClick={clearFilters} className="text-[11px] text-white/60 hover:text-white">Clear all</button>
                )}
              </div>

              {visibleTags.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleTags.map(({ tag, count }) => {

                      const active = tagFilter.has(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            "px-2.5 h-7 rounded-full text-[11px] border inline-flex items-center gap-1.5 transition-colors",
                            active
                              ? "bg-white/15 border-white/30 text-white"
                              : "bg-white/[0.04] border-white/10 text-white/70 hover:text-white"
                          )}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: hashColor(`tag:${tag}`) }} />
                          #{tag}
                          <span className="opacity-50">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  {visibleFolders.map((f) => {
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

              {visibleKeywords.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Keywords</div>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleKeywords.map((k) => {

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
                          ·{k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {panelTab === "clusters" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-white">Clustering</h3>
                <button
                  onClick={() => setTuning(DEFAULT_TUNING)}
                  className="text-[11px] text-white/60 hover:text-white"
                >
                  Reset
                </button>
              </div>
              <Slider label="Cluster count" hint="Force this many distinct tag groupings" value={tuning.clusterCount} min={2} max={10} step={1} onChange={(v) => setTuning((t) => ({ ...t, clusterCount: v }))} />
              <Slider label="Strictness" hint="How much shared signal before two ideas connect" value={tuning.strictness} min={1} max={5} step={1} onChange={(v) => setTuning((t) => ({ ...t, strictness: v }))} />
              <Slider label="Tag gravity" hint="Pulls ideas toward their primary tag cluster" value={tuning.tagGravity} min={0} max={1} step={0.05} onChange={(v) => setTuning((t) => ({ ...t, tagGravity: v }))} />
              <Slider label="Link tension" hint="Tighter springs = denser clusters" value={tuning.linkStrength} min={0} max={1} step={0.05} onChange={(v) => setTuning((t) => ({ ...t, linkStrength: v }))} />
              <Slider label="Repulsion" hint="Spreads nodes apart" value={tuning.repulsion} min={0} max={1} step={0.05} onChange={(v) => setTuning((t) => ({ ...t, repulsion: v }))} />
              <Slider label="Label size" hint="Text size under each node" value={tuning.labelSize} min={9} max={16} step={1} onChange={(v) => setTuning((t) => ({ ...t, labelSize: v }))} />
              <label className="flex items-center justify-between gap-2 pt-1">
                <div>
                  <div className="text-[12px] text-white/85 font-medium">Always-on labels</div>
                  <div className="text-[10.5px] text-white/45">Show a label under every node</div>
                </div>
                <input
                  type="checkbox"
                  checked={tuning.labelsAlwaysOn}
                  onChange={(e) => setTuning((t) => ({ ...t, labelsAlwaysOn: e.target.checked }))}
                  className="h-4 w-4 accent-violet-400"
                />
              </label>
            </div>
          )}

          {panelTab === "legend" && (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Cluster groups</div>
                <div className="flex flex-col gap-1">
                  {[...tagAnchorsRef.current.keys()].length === 0 && (
                    <div className="text-[12px] text-white/50">No clusters yet — add tags to your ideas.</div>
                  )}
                  {[...tagAnchorsRef.current.keys()].map((tag) => {
                    const count = nodesRef.current.filter((n) => n.primaryTag === tag).length;
                    const active = tagFilter.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors",
                          active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"
                        )}
                        title={active ? "Showing this cluster only — tap to clear" : "Isolate this cluster"}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: hashColor(`tag:${tag}`) }} />
                        <span className="flex-1 text-[12px] font-medium">#{tag}</span>
                        <span className="text-[10.5px] text-white/50 tabular-nums">{count}</span>
                        <MaterialIcon name={active ? "center_focus_strong" : "filter_center_focus"} size={14} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Connections</div>
                <div className="flex flex-col gap-1 text-[12px] text-white/70">
                  {(["tag", "ref", "kw", "folder"] as EdgeKind[]).map((k) => {
                    const on = enabledKinds[k];
                    return (
                      <button
                        key={k}
                        onClick={() => toggleKind(k)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left",
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* Node info panel — appears when a node is tapped */}
      {selectedId && (() => {
        const idea = (ideasQuery.data ?? []).find((i: any) => i.id === selectedId) as any;
        const node = nodesRef.current.find((n) => n.id === selectedId);
        if (!idea || !node) return null;
        const summary: string = (idea.ai_summary || idea.raw_note || idea.extracted_text || "").toString().trim();
        const excerpt = summary ? summary.slice(0, 220) + (summary.length > 220 ? "…" : "") : "No summary yet — open the idea to add details.";
        const cluster = node.primaryTag;
        return (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(var(--mobile-tabbar-h,0px)+12px)] z-20 w-[min(400px,calc(100vw-1.5rem))] rounded-2xl glass-card-strong p-3 shadow-2xl">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: node.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                  {cluster ? <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: hashColor(`tag:${cluster}`) }} />#{cluster} cluster</span> : <span>Unclustered</span>}
                  {node.degree > 0 && <span className="opacity-60">· {node.degree} links</span>}
                </div>
                <div className="text-[14px] font-semibold text-white leading-snug mt-0.5 truncate">{idea.title || "Untitled"}</div>
                {idea.tags && idea.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {idea.tags.slice(0, 6).map((t: string) => (
                      <span key={t} className="text-[10px] px-1.5 h-5 rounded-full bg-white/10 text-white/75 inline-flex items-center">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="text-[12px] text-white/75 mt-2 leading-relaxed">{excerpt}</div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => { onOpenIdea(selectedId); setSelectedId(null); }}
                    className="h-8 px-3 rounded-full bg-violet-500/80 hover:bg-violet-500 text-white text-[12px] font-medium inline-flex items-center gap-1"
                  >
                    <MaterialIcon name="open_in_new" size={14} /> Open idea
                  </button>
                  {cluster && (() => {
                    const isolatedHere = tagFilter.size === 1 && tagFilter.has(cluster);
                    return (
                      <button
                        onClick={() => setTagFilter(isolatedHere ? new Set() : new Set([cluster]))}
                        className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white/85 text-[12px] font-medium inline-flex items-center gap-1"
                      >
                        <MaterialIcon name={isolatedHere ? "close_fullscreen" : "filter_center_focus"} size={14} />
                        {isolatedHere ? "Show all" : "Isolate cluster"}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => setSelectedId(null)}
                    className="ml-auto h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 inline-flex items-center justify-center"
                    aria-label="Close"
                  >
                    <MaterialIcon name="close" size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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


      {/* Cluster header label — always shows at least one orienting tag/keyword/match
          unless filters are explicitly emptying the view. Uses the new white-glass
          variant so it pops against the dark aurora. */}
    </div>
  );
};

function Slider({
  label, hint, value, min, max, step, onChange,
}: {
  label: string; hint?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[12px] text-white/85 font-medium">{label}</label>
        <span className="text-[11px] text-white/55 tabular-nums">{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-1 accent-violet-400"
      />
      {hint && <div className="text-[10.5px] text-white/45 mt-0.5">{hint}</div>}
    </div>
  );
}
