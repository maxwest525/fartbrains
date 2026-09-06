import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * On desktop the app renders inside a 430px phone frame with overflow hidden.
 * Tailwind's `md:` asks the viewport, not that frame — so on any desktop
 * screen the browse column took its desktop width of 28rem (448px), which is
 * wider than the frame containing it, and the detail column beside it was
 * clipped to zero. The app looked like it had lost half of itself, and the
 * only way to see anything was to hit maximize.
 *
 * The fix is to ask the frame instead. These pin the mechanism, because the
 * failure is invisible to every other kind of test: jsdom has no layout, and
 * the components render perfectly well while being clipped out of sight.
 */
const CSS = readFileSync(resolve(__dirname, "../../index.css"), "utf8");
const INDEX = readFileSync(resolve(__dirname, "../Index.tsx"), "utf8");

describe("the desktop phone frame", () => {
  it("is a query container, so the shell can size against it", () => {
    expect(CSS).toMatch(/container-type:\s*inline-size/);
    expect(CSS).toMatch(/container-name:\s*appframe/);
  });

  it("sizes the browse column from the frame, not the viewport", () => {
    expect(CSS).toMatch(/@container appframe \(min-width: 768px\)/);
    const block = CSS.slice(CSS.indexOf("@container appframe (min-width: 768px)"));
    expect(block).toContain("width: 28rem");
  });
});

describe("the app shell", () => {
  it("does not size its columns on viewport breakpoints", () => {
    // A `md:` width on a column inside the frame is the bug returning: it
    // fires at a 768px viewport while the frame is still 430px.
    const browseCol = INDEX.slice(
      INDEX.indexOf("shell-browse-col") - 400,
      INDEX.indexOf("shell-browse-col") + 400,
    );
    expect(browseCol).not.toMatch(/md:w-/);
    expect(browseCol).not.toMatch(/md:flex-none/);
    expect(browseCol).not.toMatch(/md:shrink-0/);
  });

  it("uses the container-driven classes on both the column and its inner box", () => {
    expect(INDEX).toContain("shell-browse-col");
    expect(INDEX).toContain("shell-browse-inner");
    expect(INDEX).not.toContain("md:flex-1 md:min-h-0 md:overflow-hidden");
  });
});
