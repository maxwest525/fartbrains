import { Link } from "react-router-dom";
import { ChevronLeft, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  PROMPT_RULES,
  MIN_PROMPT_LENGTH,
  MAX_PROMPT_LENGTH,
  MAX_PROMPT_LINES,
} from "@/lib/promptValidation";
import { cn } from "@/lib/utils";

/**
 * Settings → Prompt rules
 *
 * Read-only reference for the validation rules applied to AI-optimized
 * prompts before they can be saved as ideas. Sourced from the same
 * `PROMPT_RULES` array used by the ComposeIdea optimizer and mirrored on
 * the server in the optimize-prompt edge function.
 */
const PromptRulesPage = () => {
  const errors = PROMPT_RULES.filter((r) => r.severity === "error");
  const warnings = PROMPT_RULES.filter((r) => r.severity === "warning");

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/60">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
            <Link
              to="/"
              className="press -ml-2 p-2 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-[17px] font-semibold tracking-tight">Prompt rules</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-5 space-y-5 safe-bottom">
          <section className="rounded-2xl bg-card border border-border/60 p-4 flex gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-[13.5px] leading-snug text-muted-foreground">
              When the Prompt Optimizer rewrites your draft, the result is
              checked against the rules below before the <span className="font-medium text-foreground">Save</span> button
              activates. The same checks run on the server so bad AI output can
              never reach your idea list — even if a future client skips them.
            </div>
          </section>

          <section className="rounded-2xl bg-card border border-border/60 p-4 space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Limits
            </h2>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Min chars" value={MIN_PROMPT_LENGTH.toLocaleString()} />
              <Stat label="Max chars" value={MAX_PROMPT_LENGTH.toLocaleString()} />
              <Stat label="Max lines" value={MAX_PROMPT_LINES.toLocaleString()} />
            </dl>
          </section>

          <RuleGroup
            title="Hard blocks"
            description="Save is disabled until these are fixed or you re-optimize."
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            tone="error"
            rules={errors}
          />

          <RuleGroup
            title="Warnings"
            description="Save still works, but you'll be asked to confirm with 'Save anyway'."
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            tone="warning"
            rules={warnings}
          />
        </main>
      </div>
    </ProtectedRoute>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-secondary/40 px-3 py-2.5">
    <div className="text-[18px] font-semibold tracking-tight">{value}</div>
    <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mt-0.5">
      {label}
    </div>
  </div>
);

const RuleGroup = ({
  title,
  description,
  icon,
  tone,
  rules,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  tone: "error" | "warning";
  rules: typeof PROMPT_RULES;
}) => (
  <section
    className={cn(
      "rounded-2xl border p-4 space-y-3",
      tone === "error"
        ? "bg-destructive/5 border-destructive/30"
        : "bg-amber-500/5 border-amber-500/30",
    )}
  >
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
    </div>
    <p className="text-[12.5px] text-muted-foreground -mt-1">{description}</p>
    <ul className="divide-y divide-border/50 rounded-xl bg-card border border-border/60">
      {rules.map((r) => (
        <li key={r.id} className="px-3 py-2.5">
          <div className="text-[14px] font-medium">{r.label}</div>
          <div className="text-[12.5px] text-muted-foreground mt-0.5">{r.description}</div>
        </li>
      ))}
    </ul>
  </section>
);

export default PromptRulesPage;
