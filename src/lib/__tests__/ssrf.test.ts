import { describe, it, expect } from "vitest";
import { isBlockedIPv4, isBlockedIPv6, expandIPv6 } from "../../../supabase/functions/_shared/ssrf";

/**
 * These decide whether an edge function will fetch a URL a caller chose.
 * `capture_url` hands the MCP surface straight to them, so the caller can be
 * an agent following an instruction from a page it just read — which makes
 * this the one place where a bypass reaches the inside of the network.
 */

describe("isBlockedIPv4", () => {
  const blocked = [
    "127.0.0.1", "127.255.255.254",
    "10.0.0.1", "10.255.255.255",
    "172.16.0.1", "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",  // cloud metadata
    "0.0.0.0",
    "100.64.0.1",       // carrier-grade NAT
    "192.0.0.1",        // IETF protocol assignments
    "198.18.0.1",       // benchmarking
    "224.0.0.1",        // multicast
    "255.255.255.255",
  ];
  for (const ip of blocked) {
    it(`blocks ${ip}`, () => expect(isBlockedIPv4(ip)).toBe(true));
  }

  const allowed = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "192.169.0.1", "100.128.0.1", "198.20.0.1"];
  for (const ip of allowed) {
    it(`allows ${ip}`, () => expect(isBlockedIPv4(ip)).toBe(false));
  }
});

describe("expandIPv6", () => {
  it("expands the compressed form to eight groups", () => {
    expect(expandIPv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIPv6("2001:db8::1")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
  });

  it("folds a trailing dotted quad into the last two groups", () => {
    expect(expandIPv6("::ffff:127.0.0.1")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
  });

  it("strips brackets and a zone id", () => {
    expect(expandIPv6("[fe80::1%eth0]")).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("returns null rather than guessing at malformed input", () => {
    for (const bad of ["", "1::2::3", "gggg::1", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", "hello"]) {
      expect(expandIPv6(bad)).toBeNull();
    }
  });
});

describe("isBlockedIPv6", () => {
  /**
   * The bypass this was written for. The WHATWG URL parser rewrites
   * `[::ffff:127.0.0.1]` into `[::ffff:7f00:1]`, so a check that looked for
   * the dotted spelling never matched what actually arrived.
   */
  it("blocks IPv4-mapped loopback in the form the URL parser produces", () => {
    expect(isBlockedIPv6("::ffff:7f00:1")).toBe(true);
    expect(isBlockedIPv6("[::ffff:7f00:1]")).toBe(true);
    expect(isBlockedIPv6("::ffff:127.0.0.1")).toBe(true);
  });

  it("blocks the cloud metadata endpoint wearing an IPv6 spelling", () => {
    // 169.254.169.254 → a9fe:a9fe
    expect(isBlockedIPv6("::ffff:a9fe:a9fe")).toBe(true);
    expect(isBlockedIPv6("[0:0:0:0:0:ffff:a9fe:a9fe]")).toBe(true);
  });

  it("blocks IPv4-mapped private ranges", () => {
    expect(isBlockedIPv6("::ffff:a00:1")).toBe(true);       // 10.0.0.1
    expect(isBlockedIPv6("::ffff:c0a8:1")).toBe(true);      // 192.168.0.1
  });

  it("blocks the deprecated IPv4-compatible form", () => {
    expect(isBlockedIPv6("::7f00:1")).toBe(true);           // ::127.0.0.1
  });

  it("blocks NAT64, which forwards to whatever IPv4 it carries", () => {
    expect(isBlockedIPv6("64:ff9b::a9fe:a9fe")).toBe(true);
    expect(isBlockedIPv6("64:ff9b::808:808")).toBe(false);  // 8.8.8.8 is public
  });

  it("blocks loopback, unspecified, link-local and unique-local", () => {
    expect(isBlockedIPv6("::1")).toBe(true);
    expect(isBlockedIPv6("::")).toBe(true);
    expect(isBlockedIPv6("fe80::1")).toBe(true);
    expect(isBlockedIPv6("febf::1")).toBe(true);   // top of fe80::/10
    expect(isBlockedIPv6("fc00::1")).toBe(true);
    expect(isBlockedIPv6("fd12:3456::1")).toBe(true);
  });

  it("refuses input it cannot parse rather than letting it through", () => {
    expect(isBlockedIPv6("not-an-address")).toBe(true);
    expect(isBlockedIPv6("1::2::3")).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    expect(isBlockedIPv6("2001:4860:4860::8888")).toBe(false);  // Google DNS
    expect(isBlockedIPv6("2606:4700:4700::1111")).toBe(false);  // Cloudflare
    expect(isBlockedIPv6("fe00::1")).toBe(false);               // below fc00::/7
  });
});
