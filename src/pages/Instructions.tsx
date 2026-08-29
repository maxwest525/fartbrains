import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BrainCircuit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Label } from "@/components/ui/label";
import { useUserInstructions, type UserInstructions } from "@/hooks/useUserInstructions";

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
  const [draft, setDraft] = useState<UserInstructions>(instructions);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading) setDraft(instructions);
  }, [loading, instructions]);

  const update = (key: FieldKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
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
          {FIELDS.map((f) => (
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
            </div>
          ))}

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
