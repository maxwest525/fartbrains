import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary, setErrorSink } from "@/components/ErrorBoundary";

const Boom = () => { throw new Error("render exploded"); };

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => { setErrorSink(null); vi.restoreAllMocks(); });

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(<ErrorBoundary><div>all good</div></ErrorBoundary>);
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a recoverable message instead of a blank page", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/Something broke on this screen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("reassures the customer their notes are safe", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/notes are safe/i)).toBeInTheDocument();
  });

  it("reports the crash to an installed sink", () => {
    const sink = vi.fn();
    setErrorSink(sink);
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(sink).toHaveBeenCalled();
    expect((sink.mock.calls[0][0] as Error).message).toBe("render exploded");
  });

  it("survives a sink that throws", () => {
    setErrorSink(() => { throw new Error("reporter down"); });
    expect(() => render(<ErrorBoundary><Boom /></ErrorBoundary>)).not.toThrow();
    expect(screen.getByText(/Something broke on this screen/i)).toBeInTheDocument();
  });
});
