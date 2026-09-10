import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, MotionConfig, type MotionProps } from "motion/react";
import {
  Inbox,
  Rewind,
  MessageSquareDashed,
  CircleSlash2,
  Link2,
  AudioLines,
  Tags,
  Waypoints,
  Rocket,
  Search,
  type LucideIcon,
} from "lucide-react";
import { setLandingActive } from "@/lib/landingMode";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * The marketing page.
 *
 * It is deliberately built out of the app's own tokens rather than a palette
 * of its own. The previous version was recast from a template (see
 * docs/LANDING_TEMPLATE.md) and had drifted into a different product: pure
 * black with an amber accent, while the app itself ships dark violet with the
 * brand gradient. Someone arriving from an ad and someone signing in were
 * looking at two different companies. Everything below uses `bg-background`,
 * `bg-card`, `border-border` and `.brand-gradient`, so re-skinning the app
 * re-skins this page with it.
 *
 * Structure and copy tone are modeled on altari.ai (sticky nav, bold
 * numbers-driven hero, pain-point section, three-step process, stats bar,
 * feature cards, integrations, FAQ) minus the parts that would require
 * fabricating things Fart Brains doesn't have: customer logos, testimonials,
 * a case study, a founder/team bio, and an ROI calculator.
 */

const REDUCED = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type RevealOptions = { y?: number; delay?: number };

const reveal = ({ y = 24, delay = 0 }: RevealOptions = {}): MotionProps => ({
  initial: REDUCED() ? undefined : { opacity: 0, y },
  whileInView: REDUCED() ? undefined : { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
});

const PRESS: MotionProps = {
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 400, damping: 28 },
};

/** Italic serif accent — the one piece of the old page's voice kept. */
const S = ({ children }: { children: React.ReactNode }) => (
  <em className="brand-gradient-text font-serif-accent font-normal italic">
    {children}
  </em>
);

/* ------------------------------- content -------------------------------- */

const CATCHES: { kind: string; tone: string; quote: string; note: React.ReactNode }[] = [
  {
    kind: "instagram reel · 47s",
    tone: "text-primary",
    quote: "the SEO play from that reel",
    note: (
      <>
        Transcribed, cut to three tactics, tagged{" "}
        <span className="text-foreground/70">seo</span>.
      </>
    ),
  },
  {
    kind: "podcast · 51 min",
    tone: "text-[hsl(220_95%_65%)]",
    quote: "how they did multi-tenancy",
    note: <>The whole architecture, in six lines you can actually reread.</>,
  },
  {
    kind: "conference talk · 22 min",
    tone: "text-accent",
    quote: "why their onboarding converts",
    note: (
      <>
        Filed under <span className="text-foreground/70">Growth</span> before you
        closed the tab.
      </>
    ),
  },
  {
    kind: "your own note · 9 words",
    tone: "text-muted-foreground",
    quote: "the one you had in the shower",
    note: <>Typed in four seconds. Still findable in four months.</>,
  },
];

const FOLDERS: { name: string; count: number; dot: string }[] = [
  { name: "Growth ideas", count: 64, dot: "bg-primary" },
  { name: "Architecture", count: 39, dot: "bg-[hsl(220_95%_58%)]" },
  { name: "Client work", count: 27, dot: "bg-accent" },
  { name: "Read later", count: 91, dot: "bg-muted-foreground/50" },
];

const SUMMARY_POINTS = [
  "Never show a new account a blank screen — the first save happens inside onboarding, with their own content.",
  "Ask for one thing, not a profile. Every extra field costs about 8% of signups.",
  "Show the value before the paywall, every time. The card comes after the win.",
];

type GraphCluster = { id: string; label: string; hue: number };
type GraphNode = { id: string; cluster: string; label: string; detail: string };
type LaidOutNode = GraphNode & { x: number; y: number };

/**
 * Fifty real, publicly documented product and growth practices — not
 * fabricated flavor text, and not anyone's private content attributed to
 * them without consent. These are facts about companies and products,
 * the same kind of thing you'd read in a case study or hear on a podcast:
 * safe to reference factually, the way any industry blog does, with no
 * implied claim that Fart Brains captured it or that anyone endorses this
 * product. Grouped into ten themes so the graph shows real clustering
 * instead of an arbitrary scatter.
 */
const GRAPH_CLUSTERS: GraphCluster[] = [
  { id: "growth",       label: "Growth",              hue: 262 },
  { id: "onboarding",   label: "Onboarding",          hue: 298 },
  { id: "design",       label: "Design & UX",         hue: 334 },
  { id: "engineering",  label: "Engineering",         hue: 10 },
  { id: "content",      label: "Content",             hue: 46 },
  { id: "community",    label: "Community",           hue: 82 },
  { id: "monetization", label: "Monetization",        hue: 118 },
  { id: "culture",      label: "Culture & ops",       hue: 154 },
  { id: "productivity", label: "Productivity tools",  hue: 190 },
  { id: "social",       label: "Social platforms",    hue: 226 },
];

const GRAPH_NODES: GraphNode[] = [
  { id: "n1",  cluster: "growth",       label: "Dropbox's double-sided referral",     detail: "Give space, get space — both sides got extra storage, and it drove roughly 60% of Dropbox's early signups." },
  { id: "n2",  cluster: "growth",       label: "PayPal's $10-for-signup",             detail: "PayPal paid new users and referrers real cash in its early days to bootstrap two-sided adoption." },
  { id: "n3",  cluster: "growth",       label: "Airbnb's Craigslist cross-post",      detail: "Airbnb let hosts one-click cross-post listings to Craigslist to tap into existing housing-search traffic." },
  { id: "n4",  cluster: "growth",       label: "Slack's time-to-2,000-messages",      detail: "Slack tracked how fast a team hit 2,000 messages as its core activation metric, not signups." },
  { id: "n5",  cluster: "growth",       label: "Superhuman's onboarding score",       detail: "Superhuman optimized onboarding by tracking the % who'd be 'very disappointed' without it, targeting 40%+." },

  { id: "n6",  cluster: "onboarding",   label: "Duolingo's streak mechanic",          detail: "A visible daily streak, and the fear of breaking it, is Duolingo's single biggest retention lever." },
  { id: "n7",  cluster: "onboarding",   label: "Notion's template gallery",           detail: "New users pick a template instead of a blank page, so day one already has something in it." },
  { id: "n8",  cluster: "onboarding",   label: "Canva's 'design for X' prompt",       detail: "Canva asks what you're making before showing a blank canvas, then narrows the toolset to match." },
  { id: "n9",  cluster: "onboarding",   label: "Calendly's link-first setup",         detail: "One link replaces a scheduling back-and-forth; the product is themed around avoiding a second email." },
  { id: "n10", cluster: "onboarding",   label: "Linear's opinionated defaults",       detail: "Linear ships almost no configuration up front — the defaults are the product's opinion on how teams work." },

  { id: "n11", cluster: "design",       label: "Figma's live multiplayer cursors",    detail: "Seeing a teammate's cursor move in real time was Figma's biggest differentiator over file-based tools." },
  { id: "n12", cluster: "design",       label: "Apple's 'one more thing'",            detail: "Structuring a keynote with a late surprise is a storytelling beat Apple reused for two decades." },
  { id: "n13", cluster: "design",       label: "Material Design's elevation scale",   detail: "Shadows in Material Design map to a strict elevation scale, not arbitrary drop-shadow values." },
  { id: "n14", cluster: "design",       label: "Stripe's checkout auto-fill",         detail: "Stripe's checkout detects card type and country from the first few digits, before you finish typing." },
  { id: "n15", cluster: "design",       label: "Airbnb's 11-star experience",         detail: "Airbnb's internal framework imagines an absurd 11-star stay to find ideas worth stealing at 5 stars." },

  { id: "n16", cluster: "engineering",  label: "How Slack shards workspaces",         detail: "Each Slack workspace is effectively an isolated tenant, sharded so one huge workspace can't slow another." },
  { id: "n17", cluster: "engineering",  label: "Stripe's idempotency keys",           detail: "Every write API call takes an idempotency key so a retried request can never double-charge a customer." },
  { id: "n18", cluster: "engineering",  label: "GitHub's contribution graph",         detail: "The green squares are a gamified visualization of commits — a retention mechanic, not a technical need." },
  { id: "n19", cluster: "engineering",  label: "Basecamp's boring stack",             detail: "Basecamp is famously built on an intentionally 'boring' Rails stack instead of chasing new frameworks." },
  { id: "n20", cluster: "engineering",  label: "Netflix's chaos engineering",         detail: "Netflix built Chaos Monkey to randomly kill production servers on purpose, forcing resilience." },

  { id: "n21", cluster: "content",      label: "Wistia's video-first blog",           detail: "Wistia built its content marketing around video tutorials instead of text posts, matching its product." },
  { id: "n22", cluster: "content",      label: "Ahrefs' content-decay tracking",      detail: "Ahrefs tracks when old posts start losing rankings and schedules a refresh instead of net-new content." },
  { id: "n23", cluster: "content",      label: "Patagonia's ‘Don't Buy This Jacket’", detail: "Patagonia ran a Black Friday ad telling people not to buy their jacket — and it grew sales." },
  { id: "n24", cluster: "content",      label: "Mailchimp's freemium ladder",         detail: "Mailchimp's free tier is generous enough to get a business fully dependent before the first bill." },
  { id: "n25", cluster: "content",      label: "HubSpot's inbound methodology",       detail: "HubSpot built an entire category, 'inbound marketing,' just to have a name for what it was selling." },

  { id: "n26", cluster: "community",    label: "Reddit's karma system",               detail: "Karma has no monetary value, but it's enough of a score to shape years of posting behavior." },
  { id: "n27", cluster: "community",    label: "Discord's server-first structure",    detail: "Discord grew by embedding inside existing gaming communities instead of building its own social graph." },
  { id: "n28", cluster: "community",    label: "Product Hunt's launch-day spike",     detail: "A single day of concentrated attention on Product Hunt can outweigh months of steady organic traffic." },
  { id: "n29", cluster: "community",    label: "'Do things that don't scale'",        detail: "Paul Graham's Y Combinator essay argues early growth almost always comes from manual, unscalable effort." },
  { id: "n30", cluster: "community",    label: "Duolingo's owl on social media",      detail: "Duolingo's unhinged mascot voice on TikTok is a scrappy alternative to traditional brand marketing." },

  { id: "n31", cluster: "monetization", label: "Gumroad's simple payout split",       detail: "Gumroad's pitch is a flat, transparent cut instead of the tiered fee structures competitors used." },
  { id: "n32", cluster: "monetization", label: "Substack's flat 10% cut",             detail: "Substack takes a flat 10% of subscription revenue, betting writers will grow the pie, not haggle the cut." },
  { id: "n33", cluster: "monetization", label: "Zoom's 40-minute free limit",         detail: "Zoom's free group-call limit was calibrated just short enough to nudge upgrades without killing adoption." },
  { id: "n34", cluster: "monetization", label: "Spotify's family-plan upsell",        detail: "Spotify's family plan is priced to make individual premium look like the worse deal for two or more." },
  { id: "n35", cluster: "monetization", label: "Dropbox's storage-based pricing",     detail: "Dropbox charges for the resource that scales with how deeply embedded you already are in the product." },

  { id: "n36", cluster: "culture",      label: "Basecamp's Shape Up cycles",          detail: "Basecamp's 'Shape Up' method runs six-week cycles with a mandatory cool-down week instead of endless sprints." },
  { id: "n37", cluster: "culture",      label: "Amazon's two-pizza teams",            detail: "Amazon's rule of thumb: if a team can't be fed by two pizzas, it's too big to move fast." },
  { id: "n38", cluster: "culture",      label: "Netflix's 'freedom and responsibility'", detail: "Netflix's culture deck traded approval chains for high autonomy and high accountability." },
  { id: "n39", cluster: "culture",      label: "Buffer's public salary formula",      detail: "Buffer publishes the exact formula used to calculate every employee's salary, founders included." },
  { id: "n40", cluster: "culture",      label: "Automattic's fully remote org",       detail: "WordPress.com's parent company has operated fully distributed since before remote work was mainstream." },

  { id: "n41", cluster: "productivity", label: "Trello's kanban simplicity",          detail: "Trello took a manufacturing scheduling method, kanban, and stripped it to cards and columns." },
  { id: "n42", cluster: "productivity", label: "Airtable's flexible views",           detail: "The same Airtable data can be a grid, calendar, or kanban board — one dataset, several lenses." },
  { id: "n43", cluster: "productivity", label: "Miro's infinite canvas",              detail: "Removing the page boundary entirely changed how teams used Miro for workshops versus a fixed deck." },
  { id: "n44", cluster: "productivity", label: "Asana's task dependencies",           detail: "Asana's dependency graph quietly turns a to-do list into something closer to a project scheduler." },
  { id: "n45", cluster: "productivity", label: "Loom's async video culture",          detail: "Loom's pitch was replacing a meeting with a 90-second video the other person watches on their own time." },

  { id: "n46", cluster: "social",       label: "TikTok's For You algorithm",          detail: "TikTok's feed optimizes on watch time per video, not follower graphs — why unknown accounts can go viral." },
  { id: "n47", cluster: "social",       label: "Instagram's pivot to Reels",          detail: "Instagram restructured its feed algorithm around short video once TikTok's growth was impossible to ignore." },
  { id: "n48", cluster: "social",       label: "LinkedIn's dwell-time ranking",       detail: "LinkedIn's algorithm rewards posts that keep people reading in-app longer — hence the hook-and-pause format." },
  { id: "n49", cluster: "social",       label: "X's tweetstorm format",               detail: "The tweetstorm emerged from users working around a character limit; the platform later built it in natively." },
  { id: "n50", cluster: "social",       label: "YouTube Shorts' discovery feed",      detail: "YouTube built a separate short-form discovery surface instead of blending Shorts into regular search." },
];

const CLUSTER_BY_ID = Object.fromEntries(GRAPH_CLUSTERS.map((c) => [c.id, c]));

const CLUSTER_COL_SPACING = 195;
const CLUSTER_ROW_SPACING = 260;
const CLUSTER_MARGIN = 110;
const PENTAGON_RADIUS = 58;

/** Cluster "home" positions in a grid with the given column count, spaced
 * far enough apart that no cluster's pentagon of nodes can reach another
 * cluster's — the fix for the earlier bug where a cross-cluster edge's
 * label landed on an unrelated node. Column count varies by viewport: a
 * 5×2 grid is a wide, short shape that fits a desktop card; the same grid
 * on a narrow phone screen would shrink until the nodes were unreadable
 * and unTappable, so mobile uses a narrower, taller 3×4 grid instead. */
const clusterHome = (columns: number): Record<string, { x: number; y: number }> =>
  Object.fromEntries(
    GRAPH_CLUSTERS.map((c, i) => [
      c.id,
      {
        x: CLUSTER_MARGIN + (i % columns) * CLUSTER_COL_SPACING,
        y: CLUSTER_MARGIN + 30 + Math.floor(i / columns) * CLUSTER_ROW_SPACING,
      },
    ]),
  );

const graphViewBox = (columns: number) => {
  const rows = Math.ceil(GRAPH_CLUSTERS.length / columns);
  return {
    width: CLUSTER_MARGIN * 2 + (columns - 1) * CLUSTER_COL_SPACING,
    height: CLUSTER_MARGIN * 2 + 30 + (rows - 1) * CLUSTER_ROW_SPACING,
  };
};

const layoutNodes = (nodes: GraphNode[], columns: number): LaidOutNode[] => {
  const home = clusterHome(columns);
  const seen: Record<string, number> = {};
  return nodes.map((n) => {
    const i = (seen[n.cluster] ??= 0);
    seen[n.cluster] += 1;
    const c = home[n.cluster];
    const angle = (-90 + i * 72) * (Math.PI / 180);
    return { ...n, x: c.x + PENTAGON_RADIUS * Math.cos(angle), y: c.y + PENTAGON_RADIUS * Math.sin(angle) };
  });
};

/** Each cluster's five nodes form a closed pentagon (node 0→1→2→3→4→0) —
 * "filed under the same theme," same honest reasoning as a shared folder,
 * scaled up. No edge ever crosses into another cluster. */
const GRAPH_EDGES: { a: string; b: string; cluster: string }[] = GRAPH_CLUSTERS.flatMap((c) => {
  const ids = GRAPH_NODES.filter((n) => n.cluster === c.id).map((n) => n.id);
  return ids.map((id, i) => ({ a: id, b: ids[(i + 1) % ids.length], cluster: c.id }));
});

const PAIN_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Inbox,
    title: "You save it, then you lose it",
    body: "Screenshots in your camera roll, tabs you never closed, a “Watch Later” list with 400 videos in it. The idea is in there somewhere. Good luck.",
  },
  {
    icon: Rewind,
    title: "Re-watching for the one part that mattered",
    body: "You remember it was a podcast, somewhere around the middle, and it was about pricing. Scrubbing a 51-minute episode to find nine seconds isn’t research.",
  },
  {
    icon: MessageSquareDashed,
    title: "The idea dies in the DMs",
    body: "You sent it to yourself, or to a teammate, and it sat there. A link with no context is a chore for future-you, so future-you skips it.",
  },
  {
    icon: CircleSlash2,
    title: "Nothing turns into anything",
    body: "Reading and doing are different verbs. Most tools stop at “saved.” The gap between the reel and the shipped thing is where the idea actually dies.",
  },
];

const HOW_IT_WORKS: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Paste the link",
    body: "A reel, a podcast, a talk, an article, or just type the thought. No app to install on the other end, no browser extension required.",
  },
  {
    step: "02",
    title: "It reads, transcribes, and files it",
    body: "Video and audio get transcribed in seconds. Everything gets summarized, tagged, and dropped into the right folder — automatically, not as a queue you manage.",
  },
  {
    step: "03",
    title: "You ask it to build the thing",
    body: "Point it at one idea or sixteen related ones, and it drafts the plan, the outline, or the working version — the step that used to be the part you never got to.",
  },
];

const STATS: { value: string; label: string }[] = [
  { value: "11s", label: "average transcription time for a saved video" },
  { value: "3", label: "tags and a folder assigned automatically, every save" },
  { value: "1,000", label: "AI actions a month on Pro, 50 free forever" },
  { value: "0", label: "extra fields required to sign up" },
];

const CAPABILITIES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Link2,
    title: "Capture",
    body: "Paste a link from anywhere — video, audio, an article, a screenshot — or drop in a raw thought. One box, no forms.",
  },
  {
    icon: AudioLines,
    title: "Transcribe",
    body: "Video and audio are transcribed automatically, so the actual words are searchable, not just the title you gave it.",
  },
  {
    icon: Tags,
    title: "Summarize & tag",
    body: "Every save gets a short summary, a handful of tags, and a folder — sorted the moment it lands, not the next time you tidy up.",
  },
  {
    icon: Waypoints,
    title: "Connect",
    body: "Ideas saved months apart get read together when they share a thread, so the plan you get back accounts for all of them, not just the last one.",
  },
  {
    icon: Rocket,
    title: "Ship",
    body: "Turn a saved idea, or a cluster of them, into a first draft — an outline, a spec, a working version — instead of one more open tab.",
  },
  {
    icon: Search,
    title: "Find it again",
    body: "Full-text search across every transcript and note you've ever saved. If you remember one phrase from it, you'll find it.",
  },
];

const SOURCES = [
  "TikTok", "Instagram Reels", "YouTube", "Podcasts", "X / Twitter",
  "Articles & blogs", "Voice notes", "Plain text",
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What counts as \"the thing\" it ships?",
    a: "Whatever the idea calls for — a written outline, a project spec, a first draft of code, or a plan broken into steps. It's scoped to get you from idea to a usable starting point, not to replace the work entirely.",
  },
  {
    q: "Does the free plan actually stay free?",
    a: "Yes. Free is a permanent tier, not a trial — unlimited saves, folders, tags, reminders, full search, and 50 AI actions a month, for as long as you use it.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You can export everything or delete your account at any point, on either plan. Nothing is held hostage behind a downgrade.",
  },
  {
    q: "How accurate is the transcription?",
    a: "It handles normal speech, accents, and typical background noise well. Heavily accented audio or overlapping speakers will occasionally need a manual correction, which you can do inline.",
  },
  {
    q: "Can I use this with a team?",
    a: "Today it's built around a single vault per account. Shared folders and team seats are on the roadmap — if that's the blocker for you, it helps to hear about it.",
  },
];

/* -------------------------------- pieces -------------------------------- */

const Wordmark = () => (
  <div className="flex items-center gap-[11px]">
    <span className="brand-gradient inline-flex h-7 w-7 items-center justify-center rounded-[9px]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5z" />
        <path d="M8 4v16" />
      </svg>
    </span>
    <span className="text-[15.5px] font-semibold tracking-[-0.01em]">Fart Brains</span>
  </div>
);

/**
 * A still of the real capture flow. It is a drawing, not a screenshot, so it
 * has to be kept honest by hand: every label here matches something the app
 * actually does today. If a capability leaves the product, it leaves this
 * panel in the same commit.
 */
const ProductShot = () => (
  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_40px_80px_-40px_hsl(var(--primary)/0.35)]">
    <div className="grid grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
      <div className="hidden flex-col gap-1 border-r border-border bg-background/60 px-3.5 py-5 md:flex">
        <div className="px-[10px] pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Vault
        </div>
        <div className="flex items-center gap-2.5 rounded-[10px] bg-primary/15 px-[11px] py-[9px] text-sm font-semibold text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" />
          </svg>
          All ideas <span className="ml-auto font-medium text-primary/60">412</span>
        </div>
        <div className="flex items-center gap-2.5 px-[11px] py-[9px] text-sm text-muted-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4l2.2 4.8L19 9.6l-3.5 3.5.9 5-4.4-2.4L7.6 18l.9-5L5 9.6l4.8-.8z" />
          </svg>
          Favorites <span className="ml-auto opacity-60">18</span>
        </div>
        <div className="px-[10px] pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Folders
        </div>
        {FOLDERS.map((f) => (
          <div key={f.name} className="flex items-center gap-2.5 px-[11px] py-[9px] text-sm text-muted-foreground">
            <span className={`h-2 w-2 rounded-[3px] ${f.dot}`} />
            {f.name}
            <span className="ml-auto opacity-60">{f.count}</span>
          </div>
        ))}
      </div>

      <div className="px-5 pb-8 pt-[26px] sm:px-7">
        <div className="mb-[22px] flex items-center gap-3 rounded-xl border border-primary/40 bg-background/60 px-4 py-[13px] shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden>
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
          </svg>
          <span className="truncate text-[14.5px] text-foreground/80">
            https://www.tiktok.com/@buildinpublic/video/7361…
          </span>
          <span className="brand-gradient ml-auto shrink-0 rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white">
            Capture
          </span>
        </div>

        <div className="mb-4 flex items-center gap-2 text-[12.5px] font-medium text-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12.5l5.2 5.2L20 7" />
          </svg>
          Transcribed in 11s · 2 min 04 · summarized · 3 tags added
        </div>

        <div className="flex flex-col gap-[15px] rounded-2xl border border-border bg-background/60 p-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div className="text-[19px] font-semibold leading-[1.32] tracking-[-0.015em]">
              Why their onboarding converts: remove the empty state
            </div>
            <span className="whitespace-nowrap pt-1 text-[11.5px] text-muted-foreground">just now</span>
          </div>
          <div className="flex flex-col gap-2.5 text-[14.5px] leading-[1.55] text-muted-foreground">
            {SUMMARY_POINTS.map((p) => (
              <div className="flex gap-[11px]" key={p}>
                <span className="text-muted-foreground/40">•</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {["onboarding", "conversion", "saas"].map((t) => (
              <span key={t} className="rounded-[7px] bg-secondary px-[11px] py-[5px] text-[12.5px] font-medium text-muted-foreground">
                {t}
              </span>
            ))}
            <span className="inline-flex items-center gap-[7px] rounded-[7px] bg-primary/15 px-[11px] py-[5px] text-[12.5px] font-semibold text-primary">
              <span className="h-[7px] w-[7px] rounded-[3px] bg-primary" />
              Growth ideas
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Fifty real, publicly documented product and growth practices, clustered
 * into ten themes and wired the same way the in-app Graph wires your own
 * saved ideas — same folder, effectively, scaled up. Not decoration: drag
 * any node, hover one to see its cluster light up, click one to read the
 * actual fact in the inspector below (that's what "inspectable" means here
 * — the graph is a browsable index, not just a picture).
 *
 * Every edge stays inside its own cluster's pentagon by construction — see
 * layoutNodes()/GRAPH_EDGES above — which is also what keeps fifty nodes
 * from turning into fifty crossing lines: a bug from an earlier, much
 * smaller version of this graph came from exactly that.
 *
 * Deliberately hand-rolled instead of a graph library or physics engine:
 * an early version of this page shipped three.js and a force-graph package
 * just for a hero visual (see docs/LANDING_TEMPLATE.md) and both got
 * dropped for bundle size. Fixed pentagon layouts don't need either.
 */
const IdeaGraph = () => {
  const isMobile = useIsMobile();
  const columns = isMobile ? 3 : 5;
  const home = clusterHome(columns);
  const viewBox = graphViewBox(columns);
  const [nodes, setNodes] = useState<LaidOutNode[]>(() => layoutNodes(GRAPH_NODES, columns));
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Re-lay-out when the column count changes (e.g. rotating the phone, or
  // resizing the desktop widget down to mobile width) rather than leaving
  // nodes positioned for a grid that no longer exists.
  const columnsRef = useRef(columns);
  useEffect(() => {
    if (columnsRef.current === columns) return;
    columnsRef.current = columns;
    setNodes(layoutNodes(GRAPH_NODES, columns));
  }, [columns]);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const box = svg?.viewBox.baseVal;
    if (!svg || !box) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: box.x + ((clientX - rect.left) / rect.width) * box.width,
      y: box.y + ((clientY - rect.top) / rect.height) * box.height,
    };
  };

  const onNodeDown = (id: string) => (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(id);
    setHovered(id);
  };
  const onSvgMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    setNodes((ns) => ns.map((n) => (n.id === dragging ? { ...n, x: p.x, y: p.y } : n)));
  };
  const endDrag = () => setDragging(null);

  const focusId = dragging ?? hovered ?? selectedId;
  const focusCluster = focusId ? byId[focusId]?.cluster ?? null : null;
  const selected = selectedId ? byId[selectedId] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-5">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Interactive diagram of fifty real product and growth ideas, clustered by theme"
        style={{ aspectRatio: `${viewBox.width} / ${viewBox.height}` }}
        className="w-full touch-none select-none"
        onPointerMove={onSvgMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {GRAPH_CLUSTERS.map((c) => {
          const clusterPos = home[c.id];
          const dim = focusCluster ? focusCluster !== c.id : false;
          return (
            <text
              key={c.id}
              x={clusterPos.x}
              y={clusterPos.y + 92}
              textAnchor="middle"
              opacity={dim ? 0.35 : 0.8}
              style={{ font: "600 11px system-ui, sans-serif", fill: `hsl(${c.hue} 70% 65%)` }}
            >
              {c.label}
            </text>
          );
        })}
        {GRAPH_EDGES.map((e) => {
          const na = byId[e.a];
          const nb = byId[e.b];
          if (!na || !nb) return null;
          const hue = CLUSTER_BY_ID[e.cluster].hue;
          const active = focusCluster === e.cluster;
          const dim = focusCluster ? !active : false;
          return (
            <line
              key={`${e.a}-${e.b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={`hsl(${hue} 75% 60%)`}
              strokeOpacity={dim ? 0.08 : active ? 0.7 : 0.3}
              strokeWidth={active ? 1.75 : 1.25}
            />
          );
        })}
        {nodes.map((n) => {
          const hue = CLUSTER_BY_ID[n.cluster].hue;
          const dim = focusCluster ? focusCluster !== n.cluster : false;
          const active = focusId === n.id;
          const isSelected = selectedId === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
              opacity={dim ? 0.25 : 1}
              className="cursor-pointer"
              onPointerDown={onNodeDown(n.id)}
              onPointerUp={() => {
                setDragging(null);
                setSelectedId(n.id);
              }}
              onPointerEnter={() => !dragging && setHovered(n.id)}
              onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
            >
              <circle
                r={active ? 7 : 5}
                fill={`hsl(${hue} 75% 60%)`}
                stroke={isSelected ? "hsl(var(--foreground))" : "hsl(var(--card))"}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              {active && (
                <text
                  x={0}
                  y={-13}
                  textAnchor="middle"
                  style={{ font: "600 10.5px system-ui, sans-serif", fill: "hsl(var(--foreground) / 0.9)" }}
                >
                  {n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-3 min-h-[72px] rounded-xl border border-border bg-background/60 p-3.5">
        {selected ? (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${CLUSTER_BY_ID[selected.cluster].hue} 75% 60%)` }} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {CLUSTER_BY_ID[selected.cluster].label}
              </span>
            </div>
            <div className="mb-1 text-[14.5px] font-semibold leading-[1.3]">{selected.label}</div>
            <p className="text-[13.5px] leading-[1.5] text-muted-foreground">{selected.detail}</p>
          </>
        ) : (
          <p className="flex h-full items-center text-[13px] text-muted-foreground">
            Click any node to read the real fact behind it.
          </p>
        )}
      </div>
      <p className="mt-2 px-0.5 text-[12px] text-muted-foreground">
        50 real, publicly documented ideas — not anyone's private content, and nobody shown or referenced here endorses this product. Drag a node; click one to inspect it.
      </p>
    </div>
  );
};

const IconBadge = ({ icon: Icon }: { icon: LucideIcon }) => (
  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-primary/25 bg-primary/10 text-primary">
    <Icon size={20} strokeWidth={1.8} aria-hidden />
  </div>
);

const FaqItem = ({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[16px] font-semibold"
        aria-expanded={open}
      >
        {q}
        <span
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-45" : ""}`}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5 text-[15px] leading-[1.6] text-muted-foreground">{a}</div>
      )}
    </div>
  );
};

/* --------------------------------- page --------------------------------- */

const Landing = ({ onEnter }: { onEnter?: () => void }) => {
  // The app shell locks body/#root to the viewport (it's a desktop-style
  // window). This is a long scrolling document, so it unlocks page scroll
  // while mounted and hides the app chrome.
  useEffect(() => {
    setLandingActive(true);
    document.documentElement.classList.add("fb-landing", "route-wide");
    return () => {
      setLandingActive(false);
      document.documentElement.classList.remove("fb-landing", "route-wide");
    };
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Fart Brains — save the reel, ship the thing";
    return () => {
      document.title = prev;
    };
  }, []);

  const enter = () => onEnter?.();

  return (
    <MotionConfig reducedMotion="user">
      <style>{CSS}</style>
      <div className="fb-root min-h-dvh bg-background text-foreground antialiased">
        {/* --------------------------------- nav -------------------------------- */}
        <div className="sticky top-0 z-30 px-4 pt-4 md:px-8">
          <nav className="mx-auto flex max-w-[1160px] items-center justify-between rounded-full border border-border bg-card/90 px-5 py-[12px] shadow-[0_10px_34px_-16px_rgba(0,0,0,0.35)] backdrop-blur-md md:px-7">
            <Wordmark />
            <div className="flex items-center gap-5 text-[14.5px] font-medium text-muted-foreground md:gap-7">
              <a href="#catches" className="hidden hover:text-foreground lg:inline">What it catches</a>
              <a href="#how-it-works" className="hidden hover:text-foreground lg:inline">How it works</a>
              <a href="#pricing" className="hidden hover:text-foreground sm:inline">Pricing</a>
              <a href="#faq" className="hidden hover:text-foreground lg:inline">FAQ</a>
              <button type="button" onClick={enter} className="hidden hover:text-foreground sm:inline">Log in</button>
              <motion.button
                type="button"
                onClick={enter}
                className="brand-gradient rounded-full px-[19px] py-[9px] font-semibold text-white"
                {...PRESS}
              >
                Start free
              </motion.button>
            </div>
          </nav>
        </div>

        {/* -------------------------------- hero -------------------------------- */}
        <header className="relative overflow-hidden px-6 pb-[104px] pt-20 md:px-20 md:pt-28">
          <div aria-hidden className="fb-dot-grid pointer-events-none absolute inset-0" />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[300px] left-[46%] h-[700px] w-[1000px] -translate-x-1/2"
            style={{
              background:
                "radial-gradient(closest-side, hsl(var(--primary) / 0.2), hsl(220 95% 58% / 0.1) 55%, transparent)",
            }}
          />
          <div className="relative max-w-[980px]">
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-[15px] py-[7px] text-[12.5px] font-medium text-muted-foreground">
              <span className="brand-gradient h-[7px] w-[7px] rounded-full" />
              every reel you swore you&rsquo;d come back to
            </div>
            <h1 className="mb-[30px] text-[44px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[62px] md:text-[82px]">
              You&rsquo;re losing good ideas.
              <br />
              We built the <S>fix</S>.
            </h1>
            <p className="mb-[42px] max-w-[660px] text-[17px] leading-[1.55] text-muted-foreground sm:text-xl [text-wrap:pretty]">
              Somebody explains exactly how they did it &mdash; the strategy, the order,
              the reason it works. It&rsquo;s a 47-second reel, and by Thursday it&rsquo;s
              gone. Paste the link. Fart Brains transcribes it, researches around it,
              files it where it belongs, and runs it out to something you can use
              tomorrow &mdash; a working MVP, an agent that does the thing, a skill
              shaped around how you actually work.
            </p>
            <div className="flex flex-wrap items-center gap-3.5">
              <motion.button
                type="button"
                onClick={enter}
                className="brand-gradient rounded-xl px-8 py-[15px] text-base font-semibold text-white"
                {...PRESS}
              >
                Start free
              </motion.button>
              <motion.a
                href="#catches"
                className="rounded-xl border border-border bg-card px-[26px] py-[15px] text-base font-medium"
                {...PRESS}
              >
                See what it catches
              </motion.a>
            </div>
            <p className="mt-[22px] text-[13.5px] text-muted-foreground">
              No card. The free plan is permanent, not a countdown.
            </p>
          </div>
        </header>

        {/* ------------------------------- catches ------------------------------ */}
        <section id="catches" className="border-t border-border px-6 py-[88px] md:px-20">
          <div className="mb-7 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            What it catches
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {CATCHES.map((c, i) => (
              <motion.div
                key={c.quote}
                className="flex flex-col gap-[13px] rounded-2xl border border-border bg-card p-6"
                {...reveal({ y: 28, delay: Math.min(i, 3) * 0.07 })}
              >
                <div className={`text-xs font-semibold ${c.tone}`}>{c.kind}</div>
                <div className="text-[16.5px] font-medium leading-[1.4]">&ldquo;{c.quote}&rdquo;</div>
                <div className="text-sm leading-[1.55] text-muted-foreground">{c.note}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ------------------------------ pain points ---------------------------- */}
        <section className="border-t border-border bg-muted/40 px-6 py-24 md:px-20">
          <div className="mb-6 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Who this is for
          </div>
          <h2 className="mb-14 max-w-[760px] text-[32px] font-bold leading-[1.15] tracking-[-0.03em] sm:text-[42px]">
            If any of this sounds familiar, the problem isn&rsquo;t your discipline
            &mdash; it&rsquo;s that <S>nothing was built to close the loop</S>.
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {PAIN_POINTS.map((p, i) => (
              <motion.div
                key={p.title}
                className="rounded-2xl border border-border bg-card p-7"
                {...reveal({ y: 24, delay: i * 0.06 })}
              >
                <IconBadge icon={p.icon} />
                <div className="mb-3 text-[18px] font-semibold leading-[1.3]">{p.title}</div>
                <div className="text-[15px] leading-[1.6] text-muted-foreground">{p.body}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ----------------------------- how it works ---------------------------- */}
        <section id="how-it-works" className="border-t border-border px-6 py-24 md:px-20">
          <div className="mb-6 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            How it works
          </div>
          <h2 className="mb-14 max-w-[640px] text-[32px] font-bold leading-[1.15] tracking-[-0.03em] sm:text-[42px]">
            Three steps. None of them are &ldquo;organize it yourself.&rdquo;
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {HOW_IT_WORKS.map((s, i) => (
              <motion.div
                key={s.step}
                className="relative rounded-2xl border border-border bg-card p-7"
                {...reveal({ y: 26, delay: i * 0.08 })}
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[15px] font-semibold text-primary">
                  {s.step}
                </div>
                <div className="mb-2.5 text-[19px] font-semibold leading-[1.3]">{s.title}</div>
                <div className="text-[15px] leading-[1.6] text-muted-foreground">{s.body}</div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div
                    aria-hidden
                    className="absolute right-[-13px] top-[38px] hidden h-px w-[26px] bg-border lg:block"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* ----------------------------- product shot --------------------------- */}
        <section className="px-6 pb-24 pt-6 md:px-20">
          <motion.div {...reveal({ y: 40 })}>
            <ProductShot />
          </motion.div>
        </section>

        {/* ----------------------------- connections ---------------------------- */}
        <section className="relative overflow-hidden border-t border-border px-6 py-24 md:px-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-[220px] top-5 h-[560px] w-[760px]"
            style={{
              background:
                "radial-gradient(closest-side, hsl(var(--accent) / 0.12), transparent)",
            }}
          />
          <div className="relative grid grid-cols-1 items-center gap-11 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="mb-6 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                The pile does this on its own
              </div>
              <h2 className="mb-6 text-[34px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[46px]">
                It connected the dots you <S>forgot you had</S>.
              </h2>
              <p className="text-[17.5px] leading-[1.6] text-muted-foreground">
                Sixteen things you saved months apart, sitting next to each other. It
                reads across them, finds the through-line, and hands you the plan
                &mdash; not a reading list.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-7">
              <motion.div {...reveal({ y: 24 })}>
                <IdeaGraph />
              </motion.div>
              <motion.div
                className="mt-2 flex gap-4 rounded-xl border border-primary/40 px-5 py-[22px]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.14) 0%, hsl(var(--accent) / 0.08) 100%)",
                }}
                {...reveal({ y: 20, delay: 0.24 })}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M12 3v3" /><path d="M12 18v3" /><path d="M5.6 5.6l2.1 2.1" />
                  <path d="M16.3 16.3l2.1 2.1" /><path d="M3 12h3" /><path d="M18 12h3" />
                </svg>
                <span className="text-[15.5px] leading-[1.55] text-foreground/90">
                  One control plane they explicitly said they don&rsquo;t have: one
                  database, row-level isolation, tenant id on every path, provisioning
                  as an API call.
                </span>
              </motion.div>
            </div>
          </div>
        </section>

        {/* --------------------------------- stats ------------------------------- */}
        <section className="border-t border-border bg-muted/40 px-6 py-[68px] md:px-20">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <motion.div key={s.label} {...reveal({ y: 20, delay: i * 0.06 })}>
                <div className="brand-gradient-text mb-2 text-[38px] font-bold tracking-[-0.03em] sm:text-[46px]">
                  {s.value}
                </div>
                <div className="text-[14px] leading-[1.5] text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ----------------------------- capabilities ---------------------------- */}
        <section className="border-t border-border px-6 py-24 md:px-20">
          <div className="mb-6 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            In production
          </div>
          <h2 className="mb-14 max-w-[640px] text-[32px] font-bold leading-[1.15] tracking-[-0.03em] sm:text-[42px]">
            Everything that happens between paste and done.
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => (
              <motion.div
                key={c.title}
                className="rounded-2xl border border-border bg-card p-7"
                {...reveal({ y: 24, delay: (i % 3) * 0.07 })}
              >
                <IconBadge icon={c.icon} />
                <div className="mb-2.5 text-[18px] font-semibold leading-[1.3]">{c.title}</div>
                <div className="text-[15px] leading-[1.6] text-muted-foreground">{c.body}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ----------------------------- integrations ---------------------------- */}
        <section className="border-t border-border bg-muted/40 px-6 py-20 md:px-20">
          <div className="mb-8 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Paste a link from anywhere
          </div>
          <div className="flex flex-wrap gap-3">
            {SOURCES.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-card px-[18px] py-[9px] text-[14px] font-medium text-foreground/80"
              >
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* ------------------------------- pricing ------------------------------ */}
        <section id="pricing" className="border-t border-border px-6 py-24 md:px-20">
          <h2 className="mb-3.5 text-[34px] font-bold tracking-[-0.03em] sm:text-[46px]">
            Free forever, or <S>nine dollars</S>.
          </h2>
          <p className="mb-[52px] max-w-[640px] text-[17.5px] text-muted-foreground">
            The free plan is real and permanent, not a trial with a countdown. Export
            everything or delete the account whenever you want, on either plan.
          </p>
          <div className="grid max-w-[860px] grid-cols-1 gap-6 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <motion.div
                key={plan.name}
                className={`flex flex-col gap-[21px] rounded-2xl border bg-card p-8 ${
                  plan.featured ? "border-primary/40" : "border-border"
                }`}
                {...reveal({ y: 30 })}
              >
                <div
                  className={`text-[12.5px] font-semibold uppercase tracking-[0.05em] ${
                    plan.featured ? "brand-gradient-text" : "text-muted-foreground"
                  }`}
                >
                  {plan.name}
                </div>
                <div className="text-[46px] font-bold tracking-[-0.035em]">
                  {plan.price}
                  <span className="text-base font-medium tracking-normal text-muted-foreground">
                    /month
                  </span>
                </div>
                <div className="flex flex-col gap-[11px] text-[15px] leading-[1.5] text-muted-foreground">
                  {plan.items.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
                <motion.button
                  type="button"
                  onClick={enter}
                  className={`mt-auto rounded-[11px] py-3.5 text-[15.5px] font-semibold ${
                    plan.featured ? "brand-gradient text-white" : "border border-border"
                  }`}
                  {...PRESS}
                >
                  Start free
                </motion.button>
              </motion.div>
            ))}
          </div>
          <p className="mt-[22px] text-[13.5px] text-muted-foreground">
            $90 a year if you&rsquo;d rather &mdash; two months free.
          </p>
        </section>

        {/* --------------------------------- faq --------------------------------- */}
        <section id="faq" className="border-t border-border bg-muted/40 px-6 py-24 md:px-20">
          <h2 className="mb-14 text-[32px] font-bold tracking-[-0.03em] sm:text-[42px]">
            Questions people actually ask
          </h2>
          <div className="mx-auto flex max-w-[760px] flex-col gap-3">
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
            ))}
          </div>
        </section>

        {/* -------------------------------- footer ------------------------------ */}
        <footer className="flex flex-col items-start justify-between gap-4 border-t border-border px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center md:px-20">
          <span>Fart Brains &mdash; fartbrain.app</span>
          <div className="flex gap-[26px]">
            <a href="#catches" className="hidden hover:text-foreground sm:inline">What it catches</a>
            <a href="#faq" className="hidden hover:text-foreground sm:inline">FAQ</a>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <button type="button" onClick={enter} className="hover:text-foreground">Log in</button>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
};

export default Landing;

const PLANS: {
  name: string;
  price: string;
  items: string[];
  featured: boolean;
}[] = [
  {
    name: "Free",
    price: "$0",
    featured: false,
    items: [
      "Unlimited saves, folders, tags, reminders",
      "Full search and share links",
      "50 AI actions a month",
      "Full export and account deletion",
    ],
  },
  {
    name: "Pro",
    price: "$9",
    featured: true,
    items: [
      "Everything in Free",
      "1,000 AI actions a month",
      "Longer transcripts, bigger pages",
      "Priority support",
    ],
  },
];

/**
 * Only what the app shell cannot express in utilities: undoing the phone-frame
 * lock, and the serif accent face. The background here must stay in step with
 * the Suspense fallback in Index.tsx, which paints while this chunk loads.
 */
const CSS = `
html.fb-landing, html.fb-landing body, html.fb-landing #root {
  height: auto !important; min-height: 100%; max-width: none !important;
  width: auto !important; overflow: visible !important;
  border-radius: 0 !important; box-shadow: none !important;
  transform: none !important; scroll-behavior: smooth;
  background: hsl(var(--background));
}
html.fb-landing body { padding-right: 0 !important; }
html.fb-landing body::before { display: none !important; }

.fb-root { overflow-x: hidden; }
.fb-root ::selection { background: hsl(var(--primary) / 0.3); color: hsl(var(--foreground)); }
.fb-root .font-serif-accent { font-family: "Instrument Serif", Georgia, serif; }

.fb-dot-grid {
  background-image: radial-gradient(hsl(var(--foreground) / 0.14) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%);
}
`;
