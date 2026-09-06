import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Eye, EyeOff, Loader2, Send, Trash2, Webhook } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useFolders } from "@/hooks/useFolders";
import {
  useFolderWebhooks,
  useRemoveFolderWebhook,
  useSaveFolderWebhook,
  useTestFolderWebhook,
} from "@/hooks/useFolderWebhooks";
import {
  EXAMPLE_PAYLOAD,
  VERIFY_SNIPPET,
  deliveryStatusLine,
  urlProblem,
  urlProblemMessage,
  type FolderWebhook,
} from "@/lib/webhooks";

/**
 * Settings → Forward a folder
 *
 * This replaces an integration that was hardcoded to one endpoint and fired
 * for every account that used a folder of a particular name. The mechanism was
 * useful; the destination being someone else's was not. Same idea, with the
 * address handed to the person whose notes they are.
 *
 * The page leads with what leaves the account, because that is the decision
 * being made. Everything else — the secret, the payload shape, the snippet —
 * is what you need once you have decided.
 */

const FolderRow = ({
  folderId,
  folderName,
  hook,
}: {
  folderId: string;
  folderName: string;
  hook: FolderWebhook | undefined;
}) => {
  const [url, setUrl] = useState(hook?.url ?? "");
  const [includeNote, setIncludeNote] = useState(hook?.include_note ?? true);
  const [includeSummary, setIncludeSummary] = useState(hook?.include_summary ?? true);
  const [showSecret, setShowSecret] = useState(false);
  const [touched, setTouched] = useState(false);

  const save = useSaveFolderWebhook();
  const remove = useRemoveFolderWebhook();
  const test = useTestFolderWebhook();

  const problem = urlProblem(url);
  const message = touched ? urlProblemMessage(problem) : null;
  const dirty =
    url.trim() !== (hook?.url ?? "") ||
    includeNote !== (hook?.include_note ?? true) ||
    includeSummary !== (hook?.include_summary ?? true);

  return (
    <li className="rounded-2xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold flex-1 min-w-0 truncate">{folderName}</p>
        {hook ? (
          <Switch
            checked={hook.enabled}
            aria-label={`Forwarding for ${folderName}`}
            onCheckedChange={(enabled) =>
              save.mutate({
                folder_id: folderId,
                url: hook.url,
                enabled,
                include_note: hook.include_note,
                include_summary: hook.include_summary,
              })
            }
          />
        ) : null}
      </div>

      <div>
        <Input
          value={url}
          inputMode="url"
          placeholder="https://your-endpoint.example/hook"
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-label={`Webhook URL for ${folderName}`}
          aria-invalid={Boolean(message)}
        />
        {message ? <p className="text-[12px] text-destructive mt-1.5">{message}</p> : null}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
        <label className="flex items-center gap-2">
          <Switch checked={includeNote} onCheckedChange={setIncludeNote} aria-label="Include the note body" />
          Send the note body
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={includeSummary} onCheckedChange={setIncludeSummary} aria-label="Include the summary" />
          Send the summary
        </label>
      </div>
      <p className="text-[12px] text-muted-foreground">
        The title, source link and tags are always sent. Turn the other two off
        to forward that something was captured without forwarding what it says.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={Boolean(problem) || !dirty || save.isPending}
          onClick={() =>
            save.mutate({
              folder_id: folderId,
              url: url.trim(),
              enabled: hook?.enabled ?? true,
              include_note: includeNote,
              include_summary: includeSummary,
            })
          }
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : hook ? "Save changes" : "Add webhook"}
        </Button>
        {hook ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={test.isPending}
              onClick={() => test.mutate(folderId)}
            >
              {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send test
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive"
              onClick={() => remove.mutate(folderId)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </>
        ) : null}
      </div>

      {hook ? (
        <>
          <p className="text-[12px] text-muted-foreground">{deliveryStatusLine(hook)}</p>
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex-1">
                Signing secret
              </p>
              <button
                type="button"
                className="text-[12px] text-primary inline-flex items-center gap-1"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showSecret ? "Hide" : "Show"}
              </button>
            </div>
            <code className="text-[11px] break-all">
              {showSecret ? hook.secret : "•".repeat(48)}
            </code>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Your endpoint uses this to check a delivery really came from us.
              Anyone holding it can forge one, so keep it where you keep your
              other keys.
            </p>
          </div>
        </>
      ) : null}
    </li>
  );
};

const Webhooks = () => {
  const { data: folders = [], isLoading } = useFolders();
  const { data: hooks = [] } = useFolderWebhooks();

  const byFolder = useMemo(
    () => new Map(hooks.map((h) => [h.folder_id, h])),
    [hooks],
  );

  return (
    <ProtectedRoute>
      <main className="min-h-dvh bg-background text-foreground pb-16">
        <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border/60 px-4 py-3 flex items-center gap-2">
          <Link to="/" className="text-sm text-primary inline-flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        </header>

        <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold tracking-tight">Forward a folder</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Send anything captured into a folder on to a system of your own —
                an agent, an inbox, a workflow you already run.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(38_92%_50%/0.4)] bg-[hsl(38_92%_50%/0.08)] px-4 py-3 text-[13px] leading-snug">
            <p className="font-semibold">This sends your notes somewhere we don't control.</p>
            <p className="text-muted-foreground mt-0.5">
              Once a capture leaves for your endpoint, what happens to it is
              between you and whatever is receiving it. Point it at something
              you run, and use https.
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading folders…</p>
          ) : folders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no folders yet. Make one, and it will show up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {folders.map((f) => (
                <FolderRow
                  key={f.id}
                  folderId={f.id}
                  folderName={f.name}
                  hook={byFolder.get(f.id)}
                />
              ))}
            </ul>
          )}

          <section className="space-y-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              What your endpoint receives
            </h2>
            <pre className="rounded-xl bg-muted/50 p-3 text-[11px] overflow-x-auto">
              {JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}
            </pre>
            <p className="text-[12px] text-muted-foreground">
              A POST with <code>X-Fartbrains-Signature</code> and{" "}
              <code>X-Fartbrains-Timestamp</code>. Answer 2xx and we count it
              delivered. We wait ten seconds and do not retry — a capture is
              already saved in your vault either way.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Checking the signature
            </h2>
            <pre className="rounded-xl bg-muted/50 p-3 text-[11px] overflow-x-auto">
              {VERIFY_SNIPPET}
            </pre>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
};

export default Webhooks;
