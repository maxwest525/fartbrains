import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../normalizeUrl";

const same = (a: string, b: string) => {
  const na = normalizeUrl(a);
  expect(na).not.toBeNull();
  expect(na).toBe(normalizeUrl(b));
};

describe("basics", () => {
  it("drops protocol, www, fragment and trailing slash", () => {
    same("https://www.example.com/post/", "http://example.com/post#section");
  });

  it("keeps distinct posts on one site distinct", () => {
    expect(normalizeUrl("example.com/a")).not.toBe(normalizeUrl("example.com/b"));
  });

  it("orders query params so the same link pasted twice matches", () => {
    same("example.com/x?b=2&a=1", "example.com/x?a=1&b=2");
  });

  it("keeps meaningful query params", () => {
    expect(normalizeUrl("example.com/x?id=1")).not.toBe(normalizeUrl("example.com/x?id=2"));
  });

  it("returns null for junk rather than guessing", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("tracking params", () => {
  it("strips the ones the share sheet adds", () => {
    same("example.com/x?utm_source=ig&utm_medium=social", "example.com/x");
    same("example.com/x?fbclid=abc", "example.com/x");
    same("example.com/x?igsh=xyz", "example.com/x");
  });
});

// The share sheet is the main way material arrives, and it hands over
// whichever URL shape the source app happens to use. These are the same
// video and the same post; before this they normalized differently, so the
// duplicate warning never fired on the most common capture path.
describe("the same YouTube video, shared from different places", () => {
  it("matches a youtu.be short link to the full watch URL", () => {
    same("https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("matches the mobile host to the desktop one", () => {
    same("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("ignores the share tracking param on a short link", () => {
    same("https://youtu.be/dQw4w9WgXcQ?si=abc123", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("still tells two different videos apart", () => {
    expect(normalizeUrl("https://youtu.be/aaaaaaaaaaa")).not.toBe(
      normalizeUrl("https://youtu.be/bbbbbbbbbbb"),
    );
  });
});

describe("the same Instagram post under its different paths", () => {
  it("matches /reel/ to /p/", () => {
    same("https://www.instagram.com/reel/ABC123/", "https://instagram.com/p/ABC123/");
  });

  it("matches the plural /reels/ form", () => {
    same("https://www.instagram.com/reels/ABC123/", "https://instagram.com/p/ABC123/");
  });

  it("ignores the igsh share param", () => {
    same("https://www.instagram.com/reel/ABC123/?igsh=zzz", "https://instagram.com/p/ABC123/");
  });

  it("still tells two different posts apart", () => {
    expect(normalizeUrl("https://instagram.com/reel/AAA/")).not.toBe(
      normalizeUrl("https://instagram.com/reel/BBB/"),
    );
  });

  it("leaves a profile URL alone", () => {
    expect(normalizeUrl("https://instagram.com/someone")).toBe("instagram.com/someone");
  });
});

describe("mobile subdomains generally", () => {
  it("collapses m. to the bare host", () => {
    same("https://m.example.com/x", "https://example.com/x");
  });

  it("does not eat a host that merely starts with m", () => {
    expect(normalizeUrl("https://medium.com/x")).toBe("medium.com/x");
    expect(normalizeUrl("https://maps.example.com/x")).toBe("maps.example.com/x");
  });
});
