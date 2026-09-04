import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

const renderPage = (Page: () => React.ReactElement) =>
  render(<MemoryRouter><Page /></MemoryRouter>);

describe("legal drafts are clearly marked", () => {
  it("the privacy page says it is an unreviewed work in progress", () => {
    renderPage(Privacy);
    expect(screen.getByText(/Work in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/not been checked by a lawyer/i)).toBeInTheDocument();
  });

  it("the terms page says it is an unreviewed work in progress", () => {
    renderPage(Terms);
    expect(screen.getByText(/Work in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/not legal advice/i)).toBeInTheDocument();
  });
});

describe("the privacy draft makes no claim we cannot back", () => {
  it("never claims AI providers do not train on customer data", () => {
    const text = renderPage(Privacy).container.textContent ?? "";
    expect(text).not.toMatch(/do(es)? not train/i);
    expect(text).not.toMatch(/never train/i);
    // It should say the opposite: that this is unverified.
    expect(text).toMatch(/have not independently verified/i);
  });

  it("makes no uptime, SLA or encryption-at-rest guarantee", () => {
    const text = renderPage(Privacy).container.textContent ?? "";
    expect(text).not.toMatch(/\bSLA\b/i);
    expect(text).not.toMatch(/encrypted at rest/i);
    expect(text).toMatch(/No service is perfectly secure/i);
  });

  it("denies teams and shared workspaces rather than offering them", () => {
    const text = renderPage(Privacy).container.textContent ?? "";
    // The words may appear, but only in the negative.
    expect(text).not.toMatch(/collaborat/i);
    expect(text).toMatch(
      /no team accounts, shared workspaces or shared folders/i,
    );
    expect(text).toMatch(/every account is one private brain/i);
  });
});

describe("the terms draft states the data-ownership promises", () => {
  it("says cancelling never deletes content", () => {
    const text = renderPage(Terms).container.textContent ?? "";
    expect(text).toMatch(/Cancelling never deletes your content/i);
  });

  it("says export and deletion stay on the free plan forever", () => {
    const text = renderPage(Terms).container.textContent ?? "";
    expect(text).toMatch(/free plan, forever/i);
  });

  it("gives no uptime guarantee", () => {
    const text = renderPage(Terms).container.textContent ?? "";
    expect(text).toMatch(/no uptime guarantee/i);
  });
});
