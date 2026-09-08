/**
 * Pick which of the customer's own folders a capture belongs in.
 *
 * `classifyDefaultFolder` in useIdeas already routes by *shape* — is this a
 * checklist, a todo, a short jot — into four canonical buckets. That is useful
 * and stays. What it cannot do is route by *subject*: someone with "Business
 * Ideas" and "Research Ideas" watched every captured reel land in a generic
 * "Ideas" folder, because their folders were never consulted.
 *
 * This is the subject pass. It is deliberately not an AI call: routing runs on
 * every single capture, an extra model round-trip on the save path is the
 * slowest thing you could add to the fastest thing in the product, and the
 * signal is already sitting in the vault — what a folder has collected is a
 * better description of it than its name.
 */

/** A folder plus the tags of what is already filed in it. */
export type FolderSignal = {
  id: string;
  name: string;
  /** Tags from items already in this folder, repeats included — they weight. */
  tags: string[];
};

export type FolderSuggestion = {
  id: string;
  name: string;
  score: number;
  /** Which signals matched, so the UI can say why rather than just moving it. */
  matched: string[];
};

/** A tag shared with the folder's existing items. The strongest signal there is. */
const TAG_WEIGHT = 3;

/** A folder-name word that is also one of the item's tags. "research" against
 *  "Research Ideas" is a real statement about the subject. */
const NAME_TAG_WEIGHT = 3;

/** A folder-name word that only appears in the title. Much weaker — titles are
 *  long and collide with folder names by accident. */
const NAME_TITLE_WEIGHT = 1;

/**
 * Below this we do not route. Landing in the shape-based default is a fine
 * outcome; being confidently filed in the wrong place is not, because nobody
 * goes looking for a thing in a folder they would not have chosen.
 */
const MIN_SCORE = 3;

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "was",
  "were", "are", "you", "your", "about", "into", "what", "when", "how", "why",
  "can", "will", "any", "all", "not", "but", "idea", "ideas", "folder", "new",
  "misc", "stuff", "things", "general",
]);

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

const norm = (s: string) => s.trim().toLowerCase();

/**
 * @param item   the capture being filed — its tags carry most of the signal
 * @param folders the customer's folders, with the tags already inside each
 */
export const suggestFolderBySubject = (
  item: { title?: string | null; tags?: string[] | null },
  folders: FolderSignal[],
): FolderSuggestion | null => {
  const itemTags = new Set((item.tags ?? []).map(norm).filter(Boolean));
  const titleWords = new Set(words(item.title ?? ""));
  if (itemTags.size === 0 && titleWords.size === 0) return null;

  let best: FolderSuggestion | null = null;

  for (const folder of folders) {
    const matched: string[] = [];
    let score = 0;

    // How often each of this folder's tags appears — a folder with nine "seo"
    // items is more about SEO than one with a single stray "seo".
    const counts = new Map<string, number>();
    for (const t of folder.tags) {
      const k = norm(t);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    for (const tag of itemTags) {
      const n = counts.get(tag);
      if (n) {
        // Diminishing, and capped at 2x: the second matching item confirms,
        // the fortieth adds nothing. Without the cap a folder that has
        // collected hundreds of one tag outscores a specific folder that
        // matches on two distinct tags plus its name — the big bucket eats
        // everything, which is the failure mode this whole pass exists to fix.
        score += TAG_WEIGHT * Math.min(1 + Math.log2(n), 2);
        matched.push(tag);
      }
    }

    for (const w of words(folder.name)) {
      if (itemTags.has(w)) {
        score += NAME_TAG_WEIGHT;
        matched.push(w);
      } else if (titleWords.has(w)) {
        score += NAME_TITLE_WEIGHT;
        matched.push(w);
      }
    }

    if (score > (best?.score ?? 0)) {
      best = { id: folder.id, name: folder.name, score, matched: [...new Set(matched)] };
    }
  }

  return best && best.score >= MIN_SCORE ? best : null;
};
