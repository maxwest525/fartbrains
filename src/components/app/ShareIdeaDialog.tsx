import { useEffect, useState } from "react";
import { Copy, Check, Link2, Loader2, ShieldOff, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { shareStatus, shareUrl } from "@/lib/share";
import {
  useCreateShare,
  useIdeaShares,
  useRevokeShare,
  type ShareOptions,
} from "@/hooks/useIdeaShares";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ideaId: string;
  ideaTitle: string;
};

const EXPIRY_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: "1", label: "1 day", days: 1 },
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "never", label: "No expiry", days: null },
];

/**
 * Share exactly one idea, read-only, with a friend.
 *
 * Everything not ticked here stays private: the extracted source text, AI
 * chats, tags, folder, reminders, related ideas, and the owner's identity are
 * never sent to the recipient.
 */
export const ShareIdeaDialog = ({ open, onOpenChange, ideaId, ideaTitle }: Props) => {
  const { data: shares = [], isLoading } = useIdeaShares(open ? ideaId : null);
  const createShare = useCreateShare();
  const revokeShare = useRevokeShare();

  const [opts, setOpts] = useState<ShareOptions>({
    includeNote: true,
    includeSummary: true,
    includeRefs: false,
    expiresInDays: 7,
  });
  // Shown once, right after creation — the raw token is never recoverable.
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setFreshLink(null);
      setCopied(false);
    }
  }, [open]);

  const activeShares = shares.filter((s) => shareStatus(s) === "active");

  const create = async () => {
    if (!opts.includeNote && !opts.includeSummary) {
      toast.error("Pick at least one section to share");
      return;
    }
    try {
      const { token } = await createShare.mutateAsync({ ideaId, options: opts });
      const url = shareUrl(token);
      setFreshLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Share link copied");
      } catch {
        toast.success("Share link created", { description: "Copy it below." });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the link");
    }
  };

  const copyFresh = async () => {
    if (!freshLink) return;
    try {
      await navigator.clipboard.writeText(freshLink);
      setCopied(true);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeShare.mutateAsync({ id, ideaId });
      setFreshLink(null);
      toast.success("Link revoked", { description: "It stops working immediately." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't revoke the link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share this idea</DialogTitle>
          <DialogDescription>
            Creates a read-only link to “{ideaTitle}” alone. Your account, other
            ideas, folders, tags and AI chats stay private.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            What the recipient sees
          </legend>
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-note"
              checked={opts.includeNote}
              onCheckedChange={(v) => setOpts((o) => ({ ...o, includeNote: v === true }))}
            />
            <Label htmlFor="share-note" className="text-sm font-normal">Your note</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-summary"
              checked={opts.includeSummary}
              onCheckedChange={(v) => setOpts((o) => ({ ...o, includeSummary: v === true }))}
            />
            <Label htmlFor="share-summary" className="text-sm font-normal">AI summary</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-refs"
              checked={opts.includeRefs}
              onCheckedChange={(v) => setOpts((o) => ({ ...o, includeRefs: v === true }))}
            />
            <Label htmlFor="share-refs" className="text-sm font-normal">Reference links</Label>
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="share-expiry" className="text-sm">Link expires</Label>
          <Select
            value={opts.expiresInDays === null ? "never" : String(opts.expiresInDays)}
            onValueChange={(v) =>
              setOpts((o) => ({
                ...o,
                expiresInDays: EXPIRY_OPTIONS.find((e) => e.value === v)?.days ?? null,
              }))
            }
          >
            <SelectTrigger id="share-expiry"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={create} disabled={createShare.isPending} className="w-full rounded-full">
          {createShare.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Link2 className="h-4 w-4 mr-2" /> Create share link</>}
        </Button>

        {freshLink && (
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Copy this now — it is shown once and cannot be recovered.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-[12px] bg-background rounded px-2 py-1.5 border border-border/60">
                {freshLink}
              </code>
              <Button size="sm" variant="outline" className="shrink-0" onClick={copyFresh}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <a
              href={freshLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-primary"
            >
              <Eye className="h-3.5 w-3.5" /> Preview what they will see
            </a>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Active links
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activeShares.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active links for this idea.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeShares.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px]">
                      {s.expires_at
                        ? `Expires ${new Date(s.expires_at).toLocaleDateString()}`
                        : "No expiry"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.access_count === 0
                        ? "Not opened yet"
                        : `Opened ${s.access_count} time${s.access_count === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-destructive"
                    onClick={() => revoke(s.id)}
                    disabled={revokeShare.isPending}
                  >
                    <ShieldOff className="h-4 w-4 mr-1" /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
