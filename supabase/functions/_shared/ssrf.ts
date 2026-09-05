// SSRF-safe URL validation + fetch. Rejects private/loopback/link-local
// addresses so edge functions can't be used to probe internal infrastructure
// or cloud metadata endpoints (e.g. 169.254.169.254).

const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
]);

function ipToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

/** True if the IPv4 string is loopback / private / link-local / metadata. */
export function isBlockedIPv4(ip: string): boolean {
  const n = ipToLong(ip);
  if (n === null) return false;
  const inRange = (start: string, prefix: number) => {
    const s = ipToLong(start)!;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (n & mask) === (s & mask);
  };
  return (
    inRange("10.0.0.0", 8) ||
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) ||
    inRange("0.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||
    inRange("192.0.0.0", 24) ||   // IETF protocol assignments
    inRange("198.18.0.0", 15) ||  // benchmarking
    inRange("224.0.0.0", 4) ||    // multicast
    inRange("240.0.0.0", 4)       // reserved, includes 255.255.255.255
  );
}

/**
 * Expand an IPv6 address to its eight 16-bit groups.
 *
 * Needed because the checks below cannot be done on the text: the WHATWG URL
 * parser rewrites whatever was typed into its own canonical form, so
 * `[::ffff:127.0.0.1]` arrives as `[::ffff:7f00:1]` and a prefix match against
 * the dotted spelling never fires. Returns null for anything unparseable,
 * which callers treat as "not provably public".
 */
export function expandIPv6(raw: string): number[] | null {
  let text = raw.toLowerCase().replace(/^\[|\]$/g, "");
  if (text.includes("%")) text = text.slice(0, text.indexOf("%")); // zone id
  if (!text || /[^0-9a-f:.]/.test(text)) return null;

  // A trailing dotted quad occupies the last two groups.
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = dotted[1].split(".").map(Number);
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    text =
      text.slice(0, -dotted[1].length) +
      ((octets[0] << 8) | octets[1]).toString(16) +
      ":" +
      ((octets[2] << 8) | octets[3]).toString(16);
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const g of part.split(":")) {
      if (g === "" || g.length > 4) return null;
      const v = Number.parseInt(g, 16);
      if (!Number.isInteger(v) || v < 0 || v > 0xffff) return null;
      out.push(v);
    }
    return out;
  };

  const head = parse(halves[0]);
  if (head === null) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const tail = parse(halves[1]);
  if (tail === null) return null;
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...Array(fill).fill(0), ...tail];
}

/**
 * True if the IPv6 string is loopback, unspecified, link-local, unique-local,
 * or carries an IPv4 address that is itself blocked.
 *
 * The mapped and compatible forms matter as much as the native ones:
 * `[::ffff:169.254.169.254]` is the cloud metadata endpoint wearing a
 * different spelling, and the parser hands it over as `[::ffff:a9fe:a9fe]`.
 */
export function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (g === null) return true; // unparseable: refuse rather than guess

  const embeddedV4 = () =>
    [(g[6] >> 8) & 0xff, g[6] & 0xff, (g[7] >> 8) & 0xff, g[7] & 0xff].join(".");

  // ::/128 unspecified and ::1/128 loopback.
  if (g.slice(0, 7).every((x) => x === 0) && (g[7] === 0 || g[7] === 1)) return true;
  // ::ffff:0:0/96 — IPv4-mapped.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedIPv4(embeddedV4());
  // ::/96 — deprecated IPv4-compatible.
  if (g.slice(0, 6).every((x) => x === 0)) return isBlockedIPv4(embeddedV4());
  // 64:ff9b::/96 — NAT64, which forwards to whatever IPv4 it embeds.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(embeddedV4());
  }
  // fe80::/10 link-local, fc00::/7 unique-local.
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  return false;
}

async function resolveAll(host: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const a = await Deno.resolveDns(host, "A");
    out.push(...a);
  } catch { /* ignore */ }
  try {
    const aaaa = await Deno.resolveDns(host, "AAAA");
    out.push(...aaaa);
  } catch { /* ignore */ }
  return out;
}

/**
 * Validate a URL is safe to fetch server-side:
 *  - http(s) only
 *  - hostname is not a known-private label
 *  - literal IPs are checked directly
 *  - hostnames are DNS-resolved and every returned address must be public
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("Only http(s) URLs are supported");
  }
  const host = u.hostname.toLowerCase();
  if (!host || PRIVATE_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("URL host is not allowed");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isBlockedIPv4(host)) throw new Error("URL host is not allowed");
    return u;
  }
  if (host.includes(":") || (u.hostname.startsWith("[") && u.hostname.endsWith("]"))) {
    if (isBlockedIPv6(host)) throw new Error("URL host is not allowed");
    return u;
  }
  const addrs = await resolveAll(host);
  if (addrs.length === 0) throw new Error("URL host could not be resolved");
  for (const a of addrs) {
    if (a.includes(":") ? isBlockedIPv6(a) : isBlockedIPv4(a)) {
      throw new Error("URL host resolves to a private address");
    }
  }
  return u;
}

/**
 * fetch() wrapper that:
 *  - validates the initial URL against SSRF rules
 *  - manually follows redirects, re-validating every hop
 *  - caps total hops
 */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  opts: { maxRedirects?: number } = {},
): Promise<Response> {
  const max = opts.maxRedirects ?? 5;
  let current = (await assertPublicUrl(raw)).toString();
  for (let i = 0; i <= max; i++) {
    const resp = await fetch(current, { ...init, redirect: "manual" });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      await resp.body?.cancel();
      if (!loc) return resp;
      const next = new URL(loc, current).toString();
      await assertPublicUrl(next);
      current = next;
      continue;
    }
    return resp;
  }
  throw new Error("Too many redirects");
}
