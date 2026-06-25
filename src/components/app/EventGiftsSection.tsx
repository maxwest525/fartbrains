import { useState } from "react";
import { Gift, Plus, ExternalLink, Trash2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useEventGifts,
  useCreateEventGift,
  useUpdateEventGift,
  useDeleteEventGift,
} from "@/hooks/useEventGifts";

type Props = { eventId: string };

/**
 * Gift list for a calendar event. Add ideas with optional link + price,
 * toggle purchased status, and remove.
 */
export const EventGiftsSection = ({ eventId }: Props) => {
  const { data: gifts = [], isLoading } = useEventGifts(eventId);
  const create = useCreateEventGift(eventId);
  const update = useUpdateEventGift(eventId);
  const del = useDeleteEventGift(eventId);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");

  const add = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(),
      url: url.trim() || null,
      price: price ? Number(price) : null,
    });
    setTitle("");
    setUrl("");
    setPrice("");
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-white/5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Gift className="h-3.5 w-3.5" /> Gift ideas
      </Label>

      {/* Existing gifts */}
      {!isLoading && gifts.length > 0 && (
        <ul className="space-y-1.5">
          {gifts.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2.5 py-2"
            >
              <button
                type="button"
                onClick={() => update.mutate({ id: g.id, patch: { purchased: !g.purchased } })}
                className={cn(
                  "h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition",
                  g.purchased
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40 hover:border-foreground",
                )}
                aria-label={g.purchased ? "Mark as not purchased" : "Mark as purchased"}
              >
                {g.purchased && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm truncate", g.purchased && "line-through text-muted-foreground")}>
                  {g.title}
                  {g.price != null && (
                    <span className="text-muted-foreground font-normal"> · ${Number(g.price).toFixed(2)}</span>
                  )}
                </div>
              </div>
              {g.url && (
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Open link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => del.mutate(g.id)}
                className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive"
                aria-label="Remove gift"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add form */}
      <div className="space-y-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Gift idea"
          className="h-10 rounded-lg bg-secondary/60 border-transparent text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="flex gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
            className="h-10 rounded-lg bg-secondary/60 border-transparent text-sm flex-1"
          />
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="$"
            inputMode="decimal"
            className="h-10 rounded-lg bg-secondary/60 border-transparent text-sm w-20"
          />
          <Button
            type="button"
            onClick={add}
            disabled={!title.trim() || create.isPending}
            size="sm"
            className="h-10 rounded-lg shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
