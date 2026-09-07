import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { MobileTabBar } from "@/components/app/MobileTabBar";

// The tab bar measures itself to publish --mobile-tabbar-h; jsdom has no
// ResizeObserver, so give it a no-op one.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", NoopResizeObserver);

/**
 * To-dos and jots were rendered only by <DesktopScratchpad />, which returns
 * null below 768px. The data was always account-backed, so a note captured on
 * a laptop existed but had no way to be read or written on a phone — the whole
 * point of syncing it. These pin the phone entry point open.
 */
const props = {
  filter: { kind: "all" } as const,
  view: "ideas" as const,
  onFilterChange: vi.fn(),
  onOpenFolders: vi.fn(),
  onOpenCalendar: vi.fn(),
  onOpenGraph: vi.fn(),
  onOpenNotes: vi.fn(),
  onOpenSettings: vi.fn(),
};

describe("mobile notes entry point", () => {
  it("offers a Notes tab in the phone tab bar", () => {
    render(<MobileTabBar {...props} />);
    expect(screen.getByLabelText("Notes")).toBeTruthy();
  });

  it("opens the notes sheet when the tab is tapped", () => {
    const onOpenNotes = vi.fn();
    render(<MobileTabBar {...props} onOpenNotes={onOpenNotes} />);
    fireEvent.click(screen.getByLabelText("Notes"));
    expect(onOpenNotes).toHaveBeenCalledTimes(1);
  });

  it("keeps every other tab reachable alongside it", () => {
    render(<MobileTabBar {...props} />);
    for (const label of ["Capture", "Graph", "Folders", "Calendar", "Notes", "Settings"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });
});
