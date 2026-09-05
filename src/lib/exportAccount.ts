/**
 * Full account export.
 *
 * Customers own their data and must be able to walk away with all of it. The
 * export runs as the signed-in user, so row level security guarantees it can
 * only ever contain that account's rows.
 *
 * Two formats: machine-readable JSON for re-import, and human-readable Markdown
 * for reading anywhere. Neither may contain secrets — share tokens are stored
 * only as hashes and are excluded entirely, as are push subscription keys.
 */

import { supabase } from "@/integrations/supabase/client";

export const EXPORT_VERSION = 1;

/** Tables included in a full export, with the columns that are safe to emit. */
export const EXPORT_TABLES = [
  "ideas",
  "folders",
  "idea_chats",
  "idea_references",
  "idea_reminders",
  "todos",
  "calendar_events",
  "event_gifts",
  "user_instructions",
  // Unsaved composer and jot text. It is the customer's writing even though
  // they have not pressed save, so an export that omitted it would be missing
  // whatever they were in the middle of.
  "user_drafts",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

/**
 * Rows fetched per request. PostgREST caps every response at the project's
 * `db-max-rows` (1000 by default) and says nothing when it truncates, so an
 * unpaged `select("*")` silently drops everything past the cap. We page until
 * a short page comes back.
 */
export const EXPORT_PAGE_SIZE = 1000;

/**
 * Stable sort key per table. Paging without an ORDER BY is undefined — the
 * same row can appear on two pages while another appears on none — and
 * `user_instructions` is keyed by `user_id` rather than `id`.
 */
export const ORDER_KEY: Record<ExportTable, string> = {
  ideas: "id",
  folders: "id",
  idea_chats: "id",
  idea_references: "id",
  idea_reminders: "id",
  todos: "id",
  calendar_events: "id",
  event_gifts: "id",
  user_instructions: "user_id",
  user_drafts: "user_id",
};

export type AccountExport = {
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
};

/** Columns that must never leave the server, whatever table they appear on. */
const REDACTED_COLUMNS = new Set([
  "token_hash",
  "auth_key",
  "p256dh",
  "endpoint",
  "service_role_key",
]);

export function stripSecrets<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!REDACTED_COLUMNS.has(k)) out[k] = v;
  }
  return out as T;
}

/** Every row of one table, paged. Throws rather than returning a partial export. */
export async function fetchAllRows(table: ExportTable): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data: rows, error } = await supabase
      .from(table)
      .select("*")
      .order(ORDER_KEY[table], { ascending: true })
      .range(from, from + EXPORT_PAGE_SIZE - 1);
    if (error) throw new Error(`Couldn't export ${table}: ${error.message}`);
    const page = rows ?? [];
    for (const r of page) out.push(stripSecrets(r as Record<string, unknown>));
    // A page shorter than the request is the last one. A full page might still
    // be the last, in which case the next request returns zero rows and stops.
    if (page.length < EXPORT_PAGE_SIZE) break;
  }
  return out;
}

/** Pulls every owner-scoped row the customer is entitled to. */
export async function buildAccountExport(): Promise<AccountExport> {
  const data: Record<string, unknown[]> = {};

  for (const table of EXPORT_TABLES) {
    data[table] = await fetchAllRows(table);
  }

  return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data };
}

const escapeHeading = (s: unknown): string =>
  String(s ?? "Untitled").replace(/\r?\n/g, " ").trim() || "Untitled";

/** One idea rendered as Markdown — used by both per-item and full export. */
export function ideaToMarkdown(idea: Record<string, unknown>): string {
  const parts: string[] = [`# ${escapeHeading(idea.title)}`, ""];

  const meta: string[] = [];
  if (idea.created_at) meta.push(`Captured: ${String(idea.created_at)}`);
  if (idea.source_url) meta.push(`Source: ${String(idea.source_url)}`);
  const tags = Array.isArray(idea.tags) ? (idea.tags as string[]) : [];
  if (tags.length) meta.push(`Tags: ${tags.join(", ")}`);
  if (idea.deleted_at) meta.push("In Trash");
  if (meta.length) parts.push(meta.map((m) => `_${m}_`).join("  \n"), "");

  if (idea.ai_summary) parts.push("## Summary", "", String(idea.ai_summary), "");
  if (idea.raw_note) parts.push("## Note", "", String(idea.raw_note), "");
  if (idea.extracted_text) parts.push("## Extracted text", "", String(idea.extracted_text), "");

  return parts.join("\n").trimEnd() + "\n";
}

/** The whole account as one Markdown document, grouped by folder. */
export function exportToMarkdown(exp: AccountExport): string {
  const folders = (exp.data.folders ?? []) as Record<string, unknown>[];
  const ideas = (exp.data.ideas ?? []) as Record<string, unknown>[];
  const folderName = new Map(folders.map((f) => [String(f.id), escapeHeading(f.name)]));

  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const idea of ideas) {
    const key = idea.folder_id ? folderName.get(String(idea.folder_id)) ?? "Unfiled" : "Unfiled";
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(idea);
  }

  const out: string[] = [
    "# Fartbrains export",
    "",
    `Exported ${exp.exportedAt}. ${ideas.length} item${ideas.length === 1 ? "" : "s"}.`,
    "",
  ];
  for (const [folder, items] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(`---`, "", `## ${folder}`, "");
    for (const idea of items) {
      out.push(ideaToMarkdown(idea).replace(/^# /, "### "), "");
    }
  }
  return out.join("\n");
}

/** Triggers a browser download without leaving the page. */
export function downloadFile(filename: string, contents: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const exportFilename = (ext: string, now = new Date()): string =>
  `fartbrains-export-${now.toISOString().slice(0, 10)}.${ext}`;
