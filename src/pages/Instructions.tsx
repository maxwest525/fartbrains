import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BrainCircuit, Loader2, Sparkles, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Label } from "@/components/ui/label";
import { useUserInstructions, type UserInstructions } from "@/hooks/useUserInstructions";
import { useInstructionSuggestions } from "@/hooks/useInstructionSuggestions";

const AUTO_KEY = "asher.instructions.autofill";

type FieldKey = keyof UserInstructions;

const FIELDS: Array<{
  key: FieldKey;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: "general",
    label: "How I think",
    hint: "Applied to every Asher reply, summary, and tag.",
    placeholder:
      "I'm a founder building a moving company. Be blunt, skip pleasantries, lead with the decision.",
    rows: 5,
  },
  {
    key: "capture",
    label: "Capturing",
    hint: "What matters when I dump something in.",
    placeholder:
      "Always pull out the concrete claim and who said it. Flag anything that needs a follow-up date.",
    rows: 4,
  },
  {
    key: "summarize",
    label: "Summarizing",
    hint: "How summaries should read.",
    placeholder:
      "Max 3 bullets. Numbers over adjectives. Always end with the single next action.",
    rows: 4,
  },
  {
    key: "tagging",
    label: "Tagging",
    hint: "Your tag vocabulary and rules.",
    placeholder:
      "Prefer my existing tags: growth, ops, hiring, product. Never tag anything 'misc'.",
    rows: 4,
  },
  {
    key: "organizing",
    label: "Organizing",
    hint: "Folders, priorities, and structure rules.",
    placeholder:
      "Anything with a deadline goes to Todo. Research links go to Notes. Keep Ideas for unproven bets.",
    rows: 4,
  },
];

const InstructionsInner = () => {
  const navigate = useNavigate();
  const { instructions, loading, saving, save } = useUserInstructions();
  const {
    suggestions,
    ideaCount,
    loading: drafting,
    error: draftError,
    generate,
    clear,
  } = useInstructionSuggestions();
  const [draft, setDraft] = useState<UserInstructions>(instructions);
  const [dirty, setDirty] = useState(false);
  const [autoFill, setAutoFill] = useState(
    () => localStorage.getItem(AUTO_KEY) !== "off",
  );
  const autoRan = useRef(false);

  useEffect(() => {
    if (!loading) setDraft(instructions);
  }, [loading, instructions]);

  // Autofill on open when the user hasn't written rules yet (or opted in) —
  // never overwrites: everything lands as an editable suggestion.
  useEffect(() => {
    if (loading || autoRan.current || !autoFill) return;
    autoRan.current = true;
    void generate(instructions);
  }, [loading, autoFill, instructions, generate]);

  const update = (key: FieldKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const applySuggestion = (key: FieldKey, mode: "replace" | "append") => {
    const value = suggestions?.[key]?.trim();
    if (!value) return;
    setDraft((prev) => {
      const current = prev[key].trim();
      const next =
        mode === "replace" || !current ? value : `${current}\n${value}`;
      return { ...prev, [key]: next };
    });
    setDirty(true);
  };

  const useAllSuggestions = () => {
    if (!suggestions) return;
    setDraft((prev) => {
      const next = { ...prev };
      (Object.keys(next) as FieldKey[]).forEach((k) => {
        const s = suggestions[k]?.trim();
        if (s && !next[k].trim()) next[k] = s;
      });
      return next;
    });
    setDirty(true);
    toast.success("Draft filled in — edit anything before saving");
  };

  const toggleAuto = () => {
    setAutoFill((prev) => {
      const next = !prev;
      localStorage.setItem(AUTO_KEY, next ? "on" : "off");
      return next;
    });
  };

  const onSave = async () => {
    const ok = await save(draft);
    if (ok) {
      setDirty(false);
      toast.success("Instructions saved — Asher will use these from now on");
    } else {
      toast.error("Could not save your instructions");
    }
  };

  return (
    <div className="min-h-dvh px-5 pt-6 pb-24 max-w-md mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="press inline-flex items-center gap-1.5 text-primary text-[15px] mb-5"
      >
        <ArrowLeft className="h-[18px] w-[18px]" />
        Back
      </button>

      <div className="flex items-center gap-2 mb-1.5">
        <BrainCircuit className="h-5 w-5 text-primary" />
        <h1 className="text-[22px] font-semibold tracking-tight">Personal instructions</h1>
      </div>
      <p className="text-[13.5px] text-foreground/70 leading-snug mb-6">
        Your standing rules. Asher injects these into every reply, summary, generated prompt, and
        auto-tag pass.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-foreground/70 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your rules…
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Drafted from your vault
            </div>
            <p className="text-[12px] text-foreground/65 leading-snug">
              {drafting
                ? "Reading your ideas, tags, and folders…"
                : suggestions
                  ? `Suggestions based on ${ideaCount ?? 0} ideas. Nothing is applied until you accept it, and every field stays editable.`
                  : "Ask Asher to draft rules from how you already capture and organize."}
            </p>
            {draftError && (
              <p className="text-[12px] text-destructive">{draftError}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
              <button
                type="button"
                onClick={() => void generate(draft)}
                disabled={drafting}
                className="press inline-flex items-center gap-1.5 text-[13px] text-primary disabled:opacity-50"
              >
                {drafting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {suggestions ? "Refresh suggestions" : "Draft from my vault"}
              </button>
              {suggestions && (
                <>
                  <button
                    type="button"
                    onClick={useAllSuggestions}
                    className="press inline-flex items-center gap-1.5 text-[13px] text-primary"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Fill empty fields
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    className="press inline-flex items-center gap-1.5 text-[13px] text-foreground/60"
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={toggleAuto}
              className="press text-[12px] text-foreground/60"
            >
              Auto-draft when I open this page: {autoFill ? "on" : "off"}
            </button>
          </div>

          {FIELDS.map((f) => {
            const suggestion = suggestions?.[f.key]?.trim() ?? "";
            const isNew = suggestion && suggestion !== draft[f.key].trim();
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-[14px] font-medium">
                  {f.label}
                </Label>
                <p className="text-[12px] text-foreground/60 leading-snug">{f.hint}</p>
                <textarea
                  id={f.key}
                  rows={f.rows}
                  value={draft[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="bubble-input w-full resize-y text-[14.5px] leading-relaxed"
                />
                {isNew && (
                  <div className="rounded-xl border border-primary/30 bg-primary/[0.07] p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-primary/90">
                      <Sparkles className="h-3 w-3" />
                      Suggested
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] text-foreground/80 leading-snug">
                      {suggestion}
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => applySuggestion(f.key, "replace")}
                        className="press inline-flex items-center gap-1 text-[12.5px] text-primary"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Use this
                      </button>
                      {draft[f.key].trim() && (
                        <button
                          type="button"
                          onClick={() => applySuggestion(f.key, "append")}
                          className="press inline-flex items-center gap-1 text-[12.5px] text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add to mine
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}


          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="press w-full h-12 rounded-2xl border border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 disabled:opacity-50 text-[15px] font-medium inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {dirty ? "Save instructions" : "Saved"}
          </button>
        </div>
      )}
    </div>
  );
};

export const Instructions = () => (
  <ProtectedRoute>
    <InstructionsInner />
  </ProtectedRoute>
);

export default Instructions;
