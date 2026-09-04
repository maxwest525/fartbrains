import { useState } from "react";
import { Loader2, Lock, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCreateIdea } from "@/hooks/useIdeas";
import { track } from "@/lib/analytics";
import {
  completeStep,
  dismissOnboarding,
  nextStep,
  readOnboarding,
  type OnboardingState,
} from "@/lib/onboarding";

type Props = {
  userId: string;
  onDone: () => void;
  /** Opens the captured item so the customer sees where it landed. */
  onOpenItem?: (id: string) => void;
  onOpenSearch?: () => void;
};

/**
 * First run: capture anything, find it later, everything stays private.
 *
 * Three short steps, skippable at any point. The first capture is the
 * customer's own real thought — no sample data is written into someone's
 * private brain on their behalf.
 */
export const OnboardingFlow = ({ userId, onDone, onOpenItem, onOpenSearch }: Props) => {
  const [state, setState] = useState<OnboardingState>(() => readOnboarding(userId));
  const [note, setNote] = useState("");
  const createIdea = useCreateIdea();
  const step = nextStep(state);

  const advance = (s: Parameters<typeof completeStep>[1]) => {
    const next = completeStep(userId, s);
    setState(next);
    if (!nextStep(next)) {
      track("onboarding_completed");
      onDone();
    }
  };

  const skip = () => {
    setState(dismissOnboarding(userId));
    onDone();
  };

  const captureFirst = async () => {
    const text = note.trim();
    if (!text) {
      toast.error("Write anything at all — a thought, a link, a reminder.");
      return;
    }
    try {
      const created = await createIdea.mutateAsync({
        title: text.split("\n")[0].slice(0, 80) || "First thought",
        raw_note: text,
        source_type: "manual",
        folder_id: null,
      });
      track("first_capture_completed", { source_type: "manual" });
      const id = (created as { id?: string } | null)?.id;
      if (id) onOpenItem?.(id);
      advance("capture");
    } catch {
      toast.error("Couldn't save that. Try again.");
    }
  };

  if (!step) return null;

  return (
    <section
      className="flex-1 overflow-y-auto px-6 py-10"
      aria-labelledby="onboarding-heading"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-start gap-3 mb-6">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Getting started
            </p>
            <h1 id="onboarding-heading" className="text-2xl font-semibold leading-tight mt-1">
              Capture anything. Find it or ask about it later.
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={skip}
            aria-label="Skip getting started"
            className="shrink-0 -mr-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {step === "capture" && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Start with one real thing — a thought, a link you want to come back
              to, something someone said. Don't overthink it.
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on your mind?"
              rows={5}
              className="mb-3"
              aria-label="Your first capture"
            />
            <Button
              className="w-full rounded-full"
              onClick={captureFirst}
              disabled={createIdea.isPending}
            >
              {createIdea.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Save it"}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-3">
              You can also paste a URL, record your voice, or import a whole
              folder of notes later.
            </p>
          </div>
        )}

        {step === "find" && (
          <div>
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">It's in your Library now</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Search finds anything you've captured. Or ask your brain a
                  question and it answers from your own notes — and shows you
                  which ones it used.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => { onOpenSearch?.(); advance("find"); }}
              >
                <Search className="h-4 w-4 mr-1.5" /> Try search
              </Button>
              <Button className="flex-1 rounded-full" onClick={() => advance("find")}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "privacy" && (
          <div>
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">This brain is yours alone</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Nobody else can see what you capture. There are no shared
                  folders and no team accounts. If you want to send one idea to a
                  friend, you make a read-only link for that one item — and you
                  can revoke it any time.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  You can export everything, or delete your account entirely,
                  from Settings whenever you like.
                </p>
              </div>
            </div>
            <Button className="w-full rounded-full" onClick={() => advance("privacy")}>
              <Sparkles className="h-4 w-4 mr-1.5" /> Start using Fartbrains
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={skip}
          className="mt-6 w-full text-[12px] text-muted-foreground underline underline-offset-2"
        >
          Skip for now
        </button>
      </div>
    </section>
  );
};
