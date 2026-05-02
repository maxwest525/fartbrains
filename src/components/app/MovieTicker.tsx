import { useState } from "react";
import { ImageOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import forgetClub from "@/assets/movie-posters/forget-club.png";
import savePrivateIdeas from "@/assets/movie-posters/save-private-ideas.png";
import fastForgetful from "@/assets/movie-posters/the-fast-and-the-forgetful.png";
import silenceIdeas from "@/assets/movie-posters/silence-of-the-ideas.png";
import noIdeaOldMen from "@/assets/movie-posters/no-idea-for-old-men.png";
import forgetFiction from "@/assets/movie-posters/forget-fiction.png";
import beautifulForgetMind from "@/assets/movie-posters/a-beautiful-forget-mind.png";
import iKnowWhatYouForgot from "@/assets/movie-posters/i-know-what-you-forgot.png";

type Poster = { title: string; src: string };

const POSTERS: Poster[] = [
  { title: "Forget Club", src: forgetClub },
  { title: "Save Private Ideas", src: savePrivateIdeas },
  { title: "The Fast & The Forgetful", src: fastForgetful },
  { title: "Silence of the Ideas", src: silenceIdeas },
  { title: "No Idea for Old Men", src: noIdeaOldMen },
  { title: "Forget Fiction", src: forgetFiction },
  { title: "A Beautiful Forget Mind", src: beautifulForgetMind },
  { title: "I Know What You Forgot Last Summer", src: iKnowWhatYouForgot },
];

/**
 * Decorative horizontal ticker shown at the very top of the Capture view.
 *
 * Cinema-style poster strip that scrolls infinitely from right to left.
 * The track is duplicated so the loop is seamless. Animation pauses on hover
 * (desktop) and respects `prefers-reduced-motion`. Tapping a poster opens a
 * full-screen lightbox so the user can read the title at full size.
 */
export const MovieTicker = () => {
  const [active, setActive] = useState<Poster | null>(null);

  return (
    <>
      <div className="relative w-full overflow-hidden select-none">
        {/* Edge fade masks so posters dissolve into the background */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-background to-transparent" />

        <div className="group flex w-max animate-[ticker_45s_linear_infinite] motion-reduce:animate-none hover:[animation-play-state:paused]">
          {[...POSTERS, ...POSTERS].map((p, i) => (
            <div
              key={`${p.title}-${i}`}
              className="shrink-0 pl-2 pr-4 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setActive(p)}
                aria-label={`Expand poster: ${p.title}`}
                className="relative h-14 sm:h-16 aspect-[2/3] rounded-md overflow-hidden bg-muted shadow-sm ring-1 ring-border/60 shrink-0 press transition-transform hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <img
                  src={p.src}
                  alt={p.title}
                  loading="eager"
                  draggable={false}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = "none";
                    const fallback = img.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div
                  className="absolute inset-0 hidden items-center justify-center bg-muted text-muted-foreground"
                  aria-hidden="true"
                >
                  <ImageOff className="h-5 w-5" />
                </div>
              </button>
              <span className="shrink-0 text-xs sm:text-sm font-medium text-muted-foreground leading-tight w-20 sm:w-24 break-words hyphens-auto">
                {p.title}
              </span>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes ticker {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {/* Expanded poster lightbox */}
      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-border">
          <DialogTitle className="sr-only">{active?.title ?? "Poster"}</DialogTitle>
          {active && (
            <div className="flex flex-col">
              <div className="relative aspect-[2/3] w-full bg-muted">
                <img
                  src={active.src}
                  alt={active.title}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  aria-label="Close"
                  className="absolute top-2 right-2 h-9 w-9 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center text-foreground hover:bg-background transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-4 py-3 border-t border-border">
                <div className="text-base font-semibold leading-tight">{active.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">A film about forgetting your best ideas.</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
