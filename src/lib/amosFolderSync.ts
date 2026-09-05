import { supabase } from "@/integrations/supabase/client";
import { syncIdeaToAmos } from "./syncIdeaToAmos";
import { isAmosOwner } from "./amosOwner";

/**
 * Folder-driven AMOS sync. When an idea lands in the "Mark" folder (either
 * on creation or by being moved into it), we mirror it to the AMOS Idea
 * Inbox exactly once. The `synced_to_amos` column on `ideas` is the
 * dedupe marker so re-adding the same idea to "Mark" doesn't double-post.
 * Fire-and-forget: never awaited, never throws, never surfaces errors.
 *
 * Owner-scoped: every entry point below returns without doing anything unless
 * the signed-in account is the one this integration belongs to. See
 * `amosOwner.ts` — the mirror posts note content to a private endpoint, and
 * nobody else's notes may go there.
 */

const MARK_FOLDER_NAME = "Mark";
let cachedMarkFolderId: string | null = null;

export async function ensureMarkFolderId(): Promise<string | null> {
  if (cachedMarkFolderId) return cachedMarkFolderId;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    // Checked before the insert, so a customer never finds a folder named
    // after someone else's project sitting in their vault.
    if (!isAmosOwner(userData.user.email)) return null;
    const { data: match } = await supabase
      .from("folders")
      .select("id")
      .ilike("name", MARK_FOLDER_NAME)
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();
    if (match?.id) {
      cachedMarkFolderId = match.id;
      return match.id;
    }
    const { data: created } = await supabase
      .from("folders")
      .insert({ name: MARK_FOLDER_NAME, user_id: userData.user.id })
      .select("id")
      .single();
    cachedMarkFolderId = created?.id ?? null;
    return cachedMarkFolderId;
  } catch {
    return null;
  }
}

async function getOrCreateMarkFolderId(): Promise<string | null> {
  return ensureMarkFolderId();
}

/**
 * Call whenever an idea's folder is set/changed. If the target folder is
 * "Mark" and the idea hasn't been synced yet, mirror it to AMOS and flip
 * the `synced_to_amos` flag. Ideas leaving "Mark" trigger nothing.
 */
export function maybeSyncIdeaToAmosByFolder(
  ideaId: string,
  folderId: string | null | undefined,
): void {
  if (!ideaId || !folderId) return;
  void (async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!isAmosOwner(userData.user?.email)) return;
      const markId = await getOrCreateMarkFolderId();
      if (!markId || folderId !== markId) return;

      const { data: idea } = await supabase
        .from("ideas")
        .select("id,title,raw_note,ai_summary,extracted_text,source_url,synced_to_amos")
        .eq("id", ideaId)
        .maybeSingle();
      if (!idea) return;
      const row = idea as {
        id: string;
        title: string | null;
        raw_note: string | null;
        ai_summary: string | null;
        extracted_text: string | null;
        source_url: string | null;
        synced_to_amos: boolean | null;
      };
      if (row.synced_to_amos) return;

      syncIdeaToAmos(row);
      await supabase
        .from("ideas")
        .update({ synced_to_amos: true } as never)
        .eq("id", ideaId);
    } catch {
      /* swallow */
    }
  })();
}
