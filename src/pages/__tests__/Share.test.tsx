import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Share from "../Share";

/** Renders wherever /share sent us, so tests assert on the real redirect. */
function Landed() {
  const { pathname, search } = useLocation();
  return <div data-testid="landed">{pathname + search}</div>;
}

const shareTo = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/share${query}`]}>
      <Routes>
        <Route path="/share" element={<Share />} />
        <Route path="/" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );

const landedAt = async () => {
  await waitFor(() => {
    expect(screen.getByTestId("landed")).toBeTruthy();
  });
  return screen.getByTestId("landed").textContent ?? "";
};

describe("/share", () => {
  it("sends a shared link to the capture screen", async () => {
    shareTo("?url=https%3A%2F%2Fwww.instagram.com%2Freel%2Fabc123%2F");
    const at = await landedAt();
    expect(at).toContain("capture=https%3A%2F%2Fwww.instagram.com%2Freel%2Fabc123%2F");
  });

  it("carries the user's own words through as the note", async () => {
    shareTo("?text=" + encodeURIComponent("worth building https://example.com/x"));
    const at = await landedAt();
    expect(at).toContain("capture=https%3A%2F%2Fexample.com%2Fx");
    expect(at).toContain("note=worth+building");
  });

  it("lands in the app rather than an unusable capture screen when no link was shared", async () => {
    shareTo("?title=" + encodeURIComponent("just a thought"));
    const at = await landedAt();
    expect(at).not.toContain("capture=");
  });
});
