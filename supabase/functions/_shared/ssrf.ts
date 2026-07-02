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
    n === 0xffffffff
  );
}

/** True if the IPv6 string is loopback / link-local / unique-local. */
export function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isBlockedIPv4(v4);
  }
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
