import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, MotionConfig, type MotionProps } from "motion/react";
import { setLandingActive } from "@/lib/landingMode";

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

const TIMELINE: { when: string; what: string }[] = [
  { when: "12 MAR", what: "Reel — isolation is the selling point, nobody shares a database" },
  { when: "03 JUN", what: "Podcast — onboarding costs them two engineer-days" },
  { when: "28 AUG", what: "Note — “same idea, but provisioning has to be automatic”" },
];

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
    document.title = "Fart Brains — save the reel, get the build brief";
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
        <nav className="flex items-center justify-between border-b border-border px-6 py-[22px] md:px-20">
          <Wordmark />
          <div className="flex items-center gap-5 text-[14.5px] font-medium text-muted-foreground md:gap-[30px]">
            <a href="#catches" className="hidden hover:text-foreground sm:inline">What it does</a>
            <a href="#pricing" className="hidden hover:text-foreground sm:inline">Pricing</a>
            <button type="button" onClick={enter} className="hidden hover:text-foreground sm:inline">Log in</button>
            <motion.button
              type="button"
              onClick={enter}
              className="brand-gradient rounded-[10px] px-[19px] py-[9px] font-semibold text-white"
              {...PRESS}
            >
              Start free
            </motion.button>
          </div>
        </nav>

        {/* -------------------------------- hero -------------------------------- */}
        <header className="relative overflow-hidden px-6 pb-[104px] pt-24 md:px-20 md:pt-32">
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
              Save the reel.
              <br />
              Get the <S>build brief</S>.
            </h1>
            <p className="mb-[42px] max-w-[660px] text-[17px] leading-[1.55] text-muted-foreground sm:text-xl [text-wrap:pretty]">
              Somebody explains exactly how they did it &mdash; the strategy, the order,
              the reason it works. It&rsquo;s a 47-second reel, and by Thursday it&rsquo;s
              gone. Paste the link. Fart Brains transcribes it, researches around it,
              files it where it belongs, and hands you a spec you can actually build.
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
              {TIMELINE.map((t, i) => (
                <motion.div
                  key={t.when}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
                  {...reveal({ y: 20, delay: i * 0.08 })}
                >
                  <span className="w-[76px] shrink-0 text-[11.5px] font-medium text-muted-foreground">
                    {t.when}
                  </span>
                  <span className="text-[15.5px] text-foreground/85">{t.what}</span>
                </motion.div>
              ))}
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

        {/* -------------------------------- footer ------------------------------ */}
        <footer className="flex flex-col items-start justify-between gap-4 border-t border-border px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center md:px-20">
          <span>Fart Brains &mdash; fartbrain.app</span>
          <div className="flex gap-[26px]">
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
`;
