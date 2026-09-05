import { useState } from "react";
import { Bug, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  clearCrashes,
  formatCrashes,
  readCrashes,
  type CrashReport,
} from "@/lib/crashReport";

/**
 * Lets a customer see and hand over the errors their own device recorded.
 *
 * Nothing is sent anywhere: the log lives in this browser until they copy it
 * or clear it. What it holds has already been stripped of note content by
 * `buildCrashReport`, which is what makes it safe to put a copy button on —
 * the text they paste into a support message cannot contain their vault.
 *
 * Hidden entirely when nothing has gone wrong, which is the normal case.
 */
export function CrashLogSection() {
  const [reports, setReports] = useState<CrashReport[]>(() => readCrashes());

  if (reports.length === 0) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatCrashes(reports));
      toast.success("Copied", { description: "Paste it into your message to support." });
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked clipboard access." });
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <Bug className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {reports.length} error{reports.length === 1 ? "" : "s"} on this device
          </p>
          <p className="text-xs text-muted-foreground">
            Diagnostics only — no note content, and nothing is sent anywhere.
          </p>
        </div>
      </div>

      <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
        {formatCrashes(reports)}
      </pre>

      <div className="flex gap-2 mt-2">
        <Button type="button" variant="secondary" size="sm" onClick={copy} className="gap-1.5">
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            clearCrashes();
            setReports([]);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>
    </div>
  );
}
