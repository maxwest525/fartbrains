import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The page is behind ProtectedRoute; stub it so these tests exercise the
// connection content rather than the auth gate, which has its own coverage.
vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Connect from "../Connect";

const renderPage = () =>
  render(
    <MemoryRouter>
      <Connect />
    </MemoryRouter>,
  );

describe("Connect your agent", () => {
  it("shows the endpoint a subscriber points their agent at", () => {
    renderPage();
    const endpoints = screen.getAllByText(/\/functions\/v1\/mcp$/);
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it("gives a paste-ready line that carries the endpoint", () => {
    renderPage();
    const prompt = screen
      .getAllByText(/remote MCP server/i)
      .find((el) => /get_instructions/.test(el.textContent ?? ""));
    expect(prompt?.textContent).toMatch(/functions\/v1\/mcp/);
  });

  it("says deletes go to Trash, because that is what makes connecting safe", () => {
    renderPage();
    expect(screen.getByText(/Deletes go to Trash/i)).toBeTruthy();
  });

  it("offers a copy control for the endpoint", () => {
    renderPage();
    expect(screen.getByLabelText("Copy the endpoint URL")).toBeTruthy();
  });
});
