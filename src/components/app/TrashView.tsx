import { useState } from "react";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useEmptyTrash,
  useIdeas,
  usePurgeIdea,
  useRestoreIdea,
} from "@/hooks/useIdeas";

const RETENTION_DAYS = 30;

const daysLeft = (deletedAt: string | null | undefined): number => {
  if (!deletedAt) return RETENTION_DAYS;
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
};

/**
 * Trash: everything the customer deleted in the last 30 days.
 *
 * Restore is one tap. Permanent deletion is the only irreversible action here
 * and always sits behind an explicit confirmation.
 */
export const TrashView = () => {
  const { data: items = [], isLoading } = useIdeas({ kind: "trash" });
  const restore = useRestoreIdea();
  const purge = usePurgeIdea();
  const emptyTrash = useEmptyTrash();

  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  return (
    <section className="flex-1 overflow-y-auto px-4 py-4" aria-labelledby="trash-heading">
      <div className="flex items-center gap-3 mb-1">
        <h1 id="trash-heading" className="text-xl font-semibold">Trash</h1>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive"
            onClick={() => setConfirmEmpty(true)}
            disabled={emptyTrash.isPending}
          >
            Empty Trash
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Deleted items stay here for {RETENTION_DAYS} days, then are removed for good.
        Share links to a trashed item stop working immediately.
      </p>

      {isLoading ? (
        <p className="text-muted-foreground flex items-center gap-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Trash2 className="h-9 w-9 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Trash is empty</p>
          <p className="text-sm text-muted-foreground mt-1">
            Anything you delete lands here first.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((idea) => (
            <li
              key={idea.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{idea.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {daysLeft(idea.deleted_at) === 0
                    ? "Removed today"
                    : `${daysLeft(idea.deleted_at)} days left`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => restore.mutate(idea.id)}
                disabled={restore.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Restore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-destructive"
                onClick={() => setConfirmPurgeId(idea.id)}
                aria-label={`Permanently delete ${idea.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={confirmPurgeId !== null}
        onOpenChange={(o) => !o && setConfirmPurgeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item and everything derived from it — references,
              reminders and AI chats. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmPurgeId) purge.mutate(confirmPurgeId);
                setConfirmPurgeId(null);
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty the Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              All {items.length} item{items.length === 1 ? "" : "s"} in Trash, and
              everything derived from them, are removed for good. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => emptyTrash.mutate()}
            >
              Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
