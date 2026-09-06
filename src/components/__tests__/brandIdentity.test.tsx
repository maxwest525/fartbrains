import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The app and the landing page were two brands. The landing arrived as a
 * scoped island — a .fb-root block with its own near-black, amber and green —
 * while the app underneath kept a violet-and-cyan scheme, a photograph of the
 * northern lights, a neon logo, and the name "IdeaVault". Someone pressing
 * "Start free" crossed between them at the moment they were deciding whether
 * to trust the product.
 *
 * These pin the seams that were hardcoded past the design tokens, because
 * that is the failure mode: the tokens were fine, and the things that ignored
 * them were what made retinting the app do nothing.
 */
const root = (p: string) => resolve(__dirname, "../..", p);
const CSS = readFileSync(root("index.css"), "utf8");
const BUTTON = readFileSync(root("components/ui/button.tsx"), "utf8");
const LANDING = readFileSync(root("pages/Landing.tsx"), "utf8");

describe("one palette", () => {
  it("gives the app the landing's amber as its primary", () => {
    // #f2a53c, the landing's --amber, in the token format the app reads.
    expect(CSS).toContain("--primary: 35 87% 59%");
    expect(LANDING).toContain("--amber: #f2a53c");
  });

  it("gives the app the landing's green as its accent", () => {
    expect(CSS).toContain("--accent: 148 72% 65%");
    expect(LANDING).toContain("--green: #63e6a0");
  });

  it("no longer carries the violet and cyan scheme", () => {
    const dark = CSS.slice(CSS.indexOf(".dark {"), CSS.indexOf(".dark {") + 1800);
    expect(dark).not.toContain("265 90% 70%"); // violet
    expect(dark).not.toContain("190 95% 60%"); // cyan
  });
});

describe("the primary button", () => {
  it("is painted from the token, not a hardcoded gradient", () => {
    // It was a three-stop gradient in Google's palette, on every primary
    // button in the product, which is why retinting changed everything else
    // and left the buttons alone.
    const def = BUTTON.slice(BUTTON.indexOf("default:"), BUTTON.indexOf("destructive:"));
    expect(def).not.toMatch(/#4285F4|#9B72CB|#D96570/i);
    expect(def).toContain("bg-primary");
    expect(def).not.toContain("linear-gradient");
  });

  it("is flat, so the one thing asking to be pressed reads as one colour", () => {
    const def = BUTTON.slice(BUTTON.indexOf("default:"), BUTTON.indexOf("destructive:"));
    expect(def).not.toMatch(/bg-gradient-to|via-/);
  });
});

describe("the ground", () => {
  it("is the brand's own, not a photograph", () => {
    // 160kB of northern lights on every first load, fighting every panel
    // drawn over it for contrast.
    expect(CSS).not.toContain('url("/aurora-bg.jpg")');
    const before = CSS.slice(CSS.indexOf("body::before"), CSS.indexOf("body::after"));
    expect(before).toContain("hsl(var(--background))");
    expect(before).toContain("hsl(var(--primary)");
  });
});

describe("one name", () => {
  it("never calls the product IdeaVault", () => {
    for (const f of [
      "components/app/DesktopWindowControls.tsx",
      "components/auth/AuthScreen.tsx",
    ]) {
      expect(readFileSync(root(f), "utf8"), f).not.toContain("IdeaVault");
    }
  });
});
