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

/**
 * The sections below are not stylistic. Each is required by a named law, or
 * corrects a claim that a template would get wrong, and each is easy to delete
 * by accident while editing prose. These pin them.
 */
describe("the privacy policy carries what the GDPR requires", () => {
  const text = () => renderPage(Privacy).container.textContent ?? "";

  it("identifies a controller, or says plainly that it has none yet", () => {
    // Article 13(1)(a). An unfilled entity is a gap to be shown, not hidden.
    expect(text()).toMatch(/data controller/i);
  });

  it("states a legal basis for each purpose", () => {
    // Article 13(1)(c).
    const t = text();
    expect(t).toMatch(/Legal basis/i);
    expect(t).toMatch(/Performance of our contract/i);
    expect(t).toMatch(/legitimate interest/i);
    expect(t).toMatch(/consent/i);
  });

  it("names the recipients rather than only their categories", () => {
    // Article 13(1)(e). "AI providers" is permissible; naming them is better,
    // and a reader deciding whether to trust the product needs the names.
    const t = text();
    for (const provider of ["Supabase", "Lovable", "ElevenLabs", "Firecrawl", "Apify", "Stripe"]) {
      expect(t, provider).toContain(provider);
    }
  });

  it("discloses transfers outside the UK and EEA", () => {
    // Article 13(1)(f).
    expect(text()).toMatch(/transferred outside/i);
  });

  it("gives retention periods rather than saying 'as long as necessary'", () => {
    // Article 13(2)(a).
    const t = text();
    expect(t).toMatch(/How long we keep it/i);
    expect(t).toMatch(/30 days/i);
  });

  it("lists every data-subject right, including the ones that need asking", () => {
    // Articles 15-21.
    const t = text();
    for (const right of [/Access and portability/i, /Rectification/i, /Erasure/i, /Restriction and objection/i, /Withdraw consent/i]) {
      expect(t).toMatch(right);
    }
  });

  it("tells the reader they can complain to a supervisory authority", () => {
    // Article 13(2)(d) — the one every template omits.
    const t = text();
    expect(t).toMatch(/complain/i);
    expect(t).toMatch(/Information Commissioner|data protection authority/i);
  });
});

describe("the privacy policy carries what California requires", () => {
  const text = () => renderPage(Privacy).container.textContent ?? "";

  it("states that personal information is not sold or shared", () => {
    const t = text();
    expect(t).toMatch(/not sold personal information/i);
    expect(t).toMatch(/cross-context behavio(u)?ral advertising/i);
  });

  it("names the rights and the non-discrimination promise", () => {
    expect(text()).toMatch(/not to be discriminated against/i);
  });
});

describe("the privacy policy describes this product, not a generic one", () => {
  const text = () => renderPage(Privacy).container.textContent ?? "";

  it("discloses that the transcript cache is shared between accounts", () => {
    // Material and easy to miss: transcript_cache has no user_id, so a public
    // video one customer transcribes is served to the next who saves it.
    const t = text();
    expect(t).toMatch(/shared transcript cache/i);
    expect(t).toMatch(/may be shown to\s+another Fartbrains user/i);
  });

  it("promises that voice notes are never cached that way", () => {
    expect(text()).toMatch(/Voice notes and anything you record or upload are\s+never cached/i);
  });

  it("does not claim to collect analytics that nothing collects", () => {
    // setAnalyticsSink is never called, so `track()` is a no-op. Claiming to
    // gather usage data would be describing collection that does not happen.
    const t = text();
    expect(t).toMatch(/No analytics provider is connected/i);
  });

  it("discloses what the app stores on the reader's own device", () => {
    const t = text();
    expect(t).toMatch(/stored on your own device/i);
    expect(t).toMatch(/passcode/i);
  });
});

describe("the terms carry what a consumer contract needs", () => {
  const text = () => renderPage(Terms).container.textContent ?? "";

  it("discloses automatic renewal with its price and cancellation route", () => {
    // California's Automatic Renewal Law and the FTC negative-option rule.
    const t = text();
    expect(t).toMatch(/renews automatically/i);
    expect(t).toMatch(/Cancel any time from Billing/i);
  });

  it("does not deny the UK and EEA 14-day right to cancel", () => {
    // A blanket "no refunds" is unenforceable against those consumers.
    const t = text();
    expect(t).toMatch(/14 days/);
    expect(t).toMatch(/non-excludable statutory rights/i);
  });

  it("carves out liability that cannot lawfully be excluded", () => {
    // A cap that tries to exclude these is read down, or struck out whole.
    const t = text();
    expect(t).toMatch(/death or\s+personal injury/i);
    expect(t).toMatch(/fraud/i);
  });

  it("states a governing law, or says plainly that it has none yet", () => {
    expect(text()).toMatch(/Governing law/i);
  });

  it("warns that AI output is unreliable and not professional advice", () => {
    const t = text();
    expect(t).toMatch(/They get things wrong/i);
    expect(t).toMatch(/professional advice/i);
  });

  it("says the product is in beta rather than implying it is finished", () => {
    expect(text()).toMatch(/in beta/i);
  });

  it("keeps the promise that losing a subscription never costs data access", () => {
    // The same guarantee entitlements.ts enforces in code.
    expect(text()).toMatch(/Cancelling never deletes your content/i);
  });
});

describe("unreviewed drafts stay out of search results", () => {
  it("rewrites the page's robots directive rather than adding a second one", () => {
    // index.html ships `index,follow`. Appending a competing tag leaves two
    // directives and relies on every crawler resolving the conflict the way
    // Google does — so the existing tag is rewritten instead.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "index,follow";
    document.head.appendChild(meta);

    const view = renderPage(Privacy);
    const tags = document.head.querySelectorAll('meta[name="robots"]');
    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute("content")).toBe("noindex,nofollow");

    view.unmount();
    expect(meta.content).toBe("index,follow");
    meta.remove();
  });

  it("cleans up after itself when the page added the tag", () => {
    const view = renderPage(Terms);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex,nofollow",
    );
    view.unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
