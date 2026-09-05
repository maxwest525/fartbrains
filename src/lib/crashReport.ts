/**
 * Crash reports that cannot carry someone's notes.
 *
 * Every screen in this app renders private content, so an error message is a
 * plausible place for that content to end up: React quotes what it was given
 * ("Objects are not valid as a React child (found: …)"), a failed fetch names
 * the URL it tried, and a thrown string is whatever the thrower put in it.
 * A crash reporter that forwards `error.message` verbatim is therefore a
 * second, unaudited copy of the vault.
 *
 * So a report is built by *construction* rather than by redaction: the only
 * fields that survive are ones whose values come from the source code —
 * error name, stack frames, component names, a route pattern — plus a message
 * that has been stripped of every shape that could hold user data.
 *
 * Nothing here sends anything. Reports are kept on the device so a customer
 * can read and hand over their own crash; wiring a provider is a separate
 * decision that this scrubbing is the precondition for.
 */

export const CRASH_LOG_KEY = "fb.crashes.v1";
export const MAX_STORED_CRASHES = 20;
export const MAX_MESSAGE_LEN = 300;
export const MAX_FRAMES = 12;

export type CrashReport = {
  at: string;
  name: string;
  message: string;
  frames: string[];
  components: string[];
  route: string;
};

/**
 * Shapes that can carry user content. Order matters: the broad quoted-string
 * rule runs last so the more specific labels survive in the output and a
 * reader can tell what kind of thing was removed.
 */
const SCRUBBERS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>"],
  [/\b[a-z][\w+.-]*:\/\/\S+/gi, "<url>"],
  [/\bdata:[^\s"')]+/gi, "<data-uri>"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>"],
  // Long unbroken runs: tokens, hashes, base64 payloads.
  [/\b[A-Za-z0-9_-]{24,}\b/g, "<token>"],
  [/\b\d{4,}\b/g, "<num>"],
  // Anything the runtime quoted back at us is, by definition, not ours.
  [/"[^"]*"/g, '"<redacted>"'],
  [/‘[^’]*’|“[^”]*”/g, "<redacted>"],
];

/** Strip every shape that could hold user content out of a free-text message. */
export function scrubMessage(raw: unknown): string {
  let text = typeof raw === "string" ? raw : String(raw ?? "");
  for (const [re, replacement] of SCRUBBERS) text = text.replace(re, replacement);
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LEN);
}

/**
 * Keep only the code locations from a stack. A frame's function name and file
 * come from the bundle, but any other text on the line came from the message
 * (V8 prefixes the stack with it), so unparseable lines are dropped rather
 * than guessed at.
 */
export function scrubStack(stack: string | undefined): string[] {
  if (!stack) return [];
  const frames: string[] = [];
  for (const line of stack.split("\n")) {
    const m = line.match(/^\s*at\s+(.+)$/);
    if (!m) continue; // the leading "Name: message" line, and anything odd
    const fn = m[1].match(/^([^(\s]+)\s*\(/);
    const loc = m[1].match(/([\w.-]+\.[a-z]+):(\d+):(\d+)\)?$/i);
    const where = loc ? `${loc[1]}:${loc[2]}:${loc[3]}` : "<anonymous>";
    frames.push(fn ? `${fn[1]} (${where})` : where);
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}

/**
 * React's component stack is a list of component names — source identifiers,
 * not data. Parsed strictly so that a component rendering user text into its
 * displayName cannot smuggle it through.
 */
export function scrubComponentStack(stack: string | undefined): string[] {
  if (!stack) return [];
  const out: string[] = [];
  for (const line of stack.split("\n")) {
    const m = line.trim().match(/^(?:at\s+|in\s+)?([A-Za-z][A-Za-z0-9_$.]{0,63})\b/);
    if (m) out.push(m[1]);
    if (out.length >= MAX_FRAMES) break;
  }
  return out;
}

/**
 * A route *pattern*, not the URL. Path segments that identify a row — ids,
 * share tokens — are replaced, and the query string and hash are dropped
 * whole: search terms live there.
 */
export function scrubRoute(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean).map((seg) => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg)) return ":id";
    if (/^\d+$/.test(seg)) return ":n";
    if (seg.length > 20) return ":token";
    return seg;
  });
  return "/" + segments.join("/");
}

export function buildCrashReport(
  error: unknown,
  opts: { componentStack?: string; pathname?: string; now?: Date } = {},
): CrashReport {
  const err = error instanceof Error ? error : null;
  return {
    at: (opts.now ?? new Date()).toISOString(),
    // A thrown non-Error has no name; calling it "Error" would be a guess.
    name: err?.name || (error === null || error === undefined ? "Unknown" : typeof error),
    message: scrubMessage(err ? err.message : error),
    frames: scrubStack(err?.stack),
    components: scrubComponentStack(opts.componentStack),
    route: scrubRoute(opts.pathname ?? "/"),
  };
}

/** Read the stored crashes, tolerating anything that is not the shape we wrote. */
export function readCrashes(): CrashReport[] {
  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed.filter((r) => r && typeof r.at === "string") as CrashReport[]) : [];
  } catch {
    return [];
  }
}

/**
 * How close together two identical crashes must be to count as one.
 *
 * A single failure reaches us more than once by design: the boundary catches
 * it, React re-throws it so the window `error` handler sees it too, and a
 * failing render is often retried. Storing each arrival would let one bug
 * fill all twenty slots and push out the earlier, different crashes that
 * explain how the customer got there.
 */
export const DEDUPE_WINDOW_MS = 5_000;

const sameCrash = (a: CrashReport, b: CrashReport): boolean =>
  a.name === b.name &&
  a.message === b.message &&
  a.route === b.route &&
  a.frames[0] === b.frames[0];

/** Newest first, capped. Storage failures are swallowed: this is diagnostics. */
export function recordCrash(report: CrashReport): void {
  try {
    const existing = readCrashes();
    const prev = existing[0];
    if (
      prev &&
      sameCrash(prev, report) &&
      Math.abs(Date.parse(report.at) - Date.parse(prev.at)) < DEDUPE_WINDOW_MS
    ) {
      return;
    }
    const next = [report, ...existing].slice(0, MAX_STORED_CRASHES);
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(next));
  } catch {
    /* private mode, quota — never make a crash worse */
  }
}

export function clearCrashes(): void {
  try {
    localStorage.removeItem(CRASH_LOG_KEY);
  } catch {
    /* ignore */
  }
}

/** What a customer copies into a support message. Already scrubbed. */
export function formatCrashes(reports: CrashReport[]): string {
  if (reports.length === 0) return "No errors recorded.";
  return reports
    .map((r) =>
      [
        `${r.at}  ${r.name} at ${r.route}`,
        `  ${r.message || "(no message)"}`,
        ...r.frames.map((f) => `    ${f}`),
        r.components.length ? `  components: ${r.components.join(" < ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
