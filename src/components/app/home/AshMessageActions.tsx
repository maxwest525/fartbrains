import { useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Save } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onSave: () => void | Promise<void>;
  onCopy: () => void;
  onRegenerate?: () => void;
  saving?: boolean;
  disabled?: boolean;
};

/**
 * Per-message action row shown under each Ash assistant reply.
 * Save → drops the exchange into the Idea Vault.
 */
export const AshMessageActions = ({
  onSave,
  onCopy,
  onRegenerate,
  saving,
  disabled,
}: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="mt-2 flex items-center gap-1 text-white/55">
      <Btn
        onClick={() => void onSave()}
        disabled={disabled || saving}
        title="Save to Idea Vault"
        accent
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        <span>Save to Vault</span>
      </Btn>
      <Btn onClick={handleCopy} title="Copy reply">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Btn>
      {onRegenerate && (
        <Btn onClick={onRegenerate} title="Regenerate">
          <RefreshCw className="h-3.5 w-3.5" />
        </Btn>
      )}
    </div>
  );
};

const Btn = ({
  children,
  accent,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { accent?: boolean }) => (
  <button
    type="button"
    className={cn(
      "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition",
      "border border-white/10 bg-white/[0.04] hover:bg-white/[0.10] hover:text-white",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      accent && "bg-white/[0.10] text-white/90 hover:bg-white/[0.16]",
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);
