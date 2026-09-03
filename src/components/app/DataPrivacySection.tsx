import { useState } from "react";
import { Download, FileJson, FileText, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  buildAccountExport,
  downloadFile,
  exportFilename,
  exportToMarkdown,
} from "@/lib/exportAccount";

/**
 * Data ownership: take everything with you, or remove it entirely.
 *
 * Export runs as the signed-in user, so row level security guarantees the file
 * only ever contains that account's rows. Deletion requires the customer to
 * re-enter their password and type the confirmation phrase.
 */
export const DataPrivacySection = () => {
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState<"json" | "markdown" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const runExport = async (format: "json" | "markdown") => {
    setExporting(format);
    try {
      const data = await buildAccountExport();
      if (format === "json") {
        downloadFile(exportFilename("json"), JSON.stringify(data, null, 2), "application/json");
      } else {
        downloadFile(exportFilename("md"), exportToMarkdown(data), "text/markdown");
      }
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build the export");
    } finally {
      setExporting(null);
    }
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    if (!user?.email) {
      toast.error("Sign in again before deleting your account");
      return;
    }
    setDeleting(true);
    try {
      // Re-authenticate immediately before the destructive call.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (reauthErr) {
        toast.error("That password didn't match");
        return;
      }

      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirm: "DELETE" },
      });
      if (error || data?.status !== "deleted") {
        toast.error(data?.error ?? "Couldn't delete your account. Contact support.");
        return;
      }

      toast.success("Your account and data have been deleted");
      await signOut();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete your account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-5 rounded-2xl bg-card border border-border/60 overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <p className="text-sm font-medium">Your data</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Everything you've captured is yours. Take a copy any time.
        </p>
      </div>

      <div className="px-4 pb-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-full"
          onClick={() => runExport("json")}
          disabled={exporting !== null}
        >
          {exporting === "json"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><FileJson className="h-4 w-4 mr-1.5" /> JSON</>}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-full"
          onClick={() => runExport("markdown")}
          disabled={exporting !== null}
        >
          {exporting === "markdown"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><FileText className="h-4 w-4 mr-1.5" /> Markdown</>}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="w-full border-t border-border/60 px-4 py-3 flex items-center gap-3 press text-left"
      >
        <div className="h-9 w-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
          <TriangleAlert className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">Delete account</p>
          <p className="text-[11px] text-muted-foreground">
            Removes your brain and everything in it, permanently.
          </p>
        </div>
      </button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>This permanently removes:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>every item, note, transcript and summary</li>
                  <li>folders, tags, references and reminders</li>
                  <li>AI chats and your personal instructions</li>
                  <li>every share link you created</li>
                </ul>
                <p className="flex items-start gap-1.5">
                  <Download className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Export your data first — this cannot be undone.
                </p>
                <p>
                  If you have a paid subscription, cancel it in Billing first so
                  you are not charged again.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="del-password">Confirm your password</Label>
              <Input
                id="del-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="del-confirm">Type DELETE to confirm</Label>
              <Input
                id="del-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <Button
              variant="destructive"
              className="w-full rounded-full"
              onClick={deleteAccount}
              disabled={deleting || confirmText !== "DELETE" || !password}
            >
              {deleting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</>
                : "Delete my account permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
