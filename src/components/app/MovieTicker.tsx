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
  { title: "I Know What You Forgot", src: iKnowWhatYouForgot },
];

/**
 * Decorative horizontal ticker shown above the idea capture form.
 *
 * Cinema-style poster strip that scrolls infinitely from right to left.
 * The track is duplicated so the loop is seamless. Animation pauses on hover
 * (desktop) and respects `prefers-reduced-motion`.
 */
export const MovieTicker = () => {
  return (
    <div
      className="relative w-full overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Edge fade masks so posters dissolve into the background */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-background to-transparent" />

      <div className="group flex w-max animate-[ticker_45s_linear_infinite] motion-reduce:animate-none hover:[animation-play-state:paused]">
        {[...POSTERS, ...POSTERS].map((p, i) => (
          <div
            key={`${p.title}-${i}`}
            className="shrink-0 px-2 flex items-center gap-2"
          >
            <div className="h-14 sm:h-16 aspect-[2/3] rounded-md overflow-hidden bg-card shadow-sm ring-1 ring-border/60">
              <img
                src={p.src}
                alt={p.title}
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
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
  );
};
