import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary, setErrorSink } from "@/components/ErrorBoundary";
import { installCrashReporting } from "@/lib/installCrashReporting";
import { readCrashes, clearCrashes } from "@/lib/crashReport";

const NOTE = "Retainer pitch: open with the churn number, close on the audit";

/** A component that fails the way a real one would: while rendering content. */
function Exploding() {
  throw new Error(`Cannot read properties of undefined (reading "${NOTE}")`);
}

beforeEach(() => {
  clearCrashes();
  setErrorSink(null);
  // React logs the caught error itself; silence it so the run stays readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("crash reporting, end to end", () => {
  it("records a render crash and shows the customer their notes are safe", () => {
    installCrashReporting();
    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Something broke on this screen/)).toBeTruthy();
    expect(screen.getByText(/Your notes are safe/)).toBeTruthy();

    const crashes = readCrashes();
    expect(crashes).toHaveLength(1);
    expect(crashes[0].name).toBe("Error");
    expect(crashes[0].message).toContain("Cannot read properties of undefined");
  });

  it("stores nothing that quotes the content being rendered", () => {
    installCrashReporting();
    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );
    expect(JSON.stringify(readCrashes())).not.toContain("churn");
  });

  it("keeps the boundary working when the reporter itself throws", () => {
    setErrorSink(() => {
      throw new Error("reporter is broken");
    });
    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something broke on this screen/)).toBeTruthy();
  });
});
