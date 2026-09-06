import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { FolderWebhook } from "@/lib/webhooks";

vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const save = vi.fn();
const remove = vi.fn();
const test_ = vi.fn();
let hooks: FolderWebhook[] = [];

vi.mock("@/hooks/useFolders", () => ({
  useFolders: () => ({
    data: [
      { id: "f1", name: "Marketing" },
      { id: "f2", name: "Reading list" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useFolderWebhooks", () => ({
  useFolderWebhooks: () => ({ data: hooks }),
  useSaveFolderWebhook: () => ({ mutate: save, isPending: false }),
  useRemoveFolderWebhook: () => ({ mutate: remove, isPending: false }),
  useTestFolderWebhook: () => ({ mutate: test_, isPending: false }),
}));

import Webhooks from "../Webhooks";

const renderPage = () => render(<MemoryRouter><Webhooks /></MemoryRouter>);

/** The page lists every folder, so assertions have to say which row. */
const row = (folder: string) =>
  within(screen.getByLabelText(`Webhook URL for ${folder}`).closest("li")!);

const configured = (over: Partial<FolderWebhook> = {}): FolderWebhook => ({
  folder_id: "f1",
  url: "https://hooks.example.com/abc",
  secret: "s3cr3t-value-not-shown-by-default",
  enabled: true,
  include_note: true,
  include_summary: true,
  last_status: 200,
  last_error: null,
  last_delivered_at: "2026-09-06T04:00:00.000Z",
  delivery_count: 3,
  ...over,
});

beforeEach(() => {
  hooks = [];
  save.mockClear();
  remove.mockClear();
  test_.mockClear();
});

describe("Forward a folder", () => {
  it("names every folder, so the choice is per folder rather than global", () => {
    renderPage();
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("Reading list")).toBeInTheDocument();
  });

  it("leads with the fact that notes leave the account", () => {
    // This is the decision being made on this page. Burying it under the form
    // would make the warning something you read after choosing.
    renderPage();
    expect(screen.getByText(/sends your notes somewhere we don't control/i)).toBeInTheDocument();
  });

  it("refuses to save an address our servers could never reach", () => {
    renderPage();
    const input = screen.getByLabelText("Webhook URL for Marketing");
    fireEvent.change(input, { target: { value: "http://localhost:3000/hook" } });
    fireEvent.blur(input);
    expect(row("Marketing").getByText(/private network/i)).toBeInTheDocument();
    expect(row("Marketing").getByRole("button", { name: /Add webhook/i })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });

  it("saves a valid endpoint with the content choices", () => {
    renderPage();
    const input = screen.getByLabelText("Webhook URL for Marketing");
    fireEvent.change(input, { target: { value: "https://hooks.example.com/abc" } });
    fireEvent.click(row("Marketing").getByRole("button", { name: /Add webhook/i }));
    expect(save).toHaveBeenCalledWith({
      folder_id: "f1",
      url: "https://hooks.example.com/abc",
      enabled: true,
      include_note: true,
      include_summary: true,
    });
  });

  it("lets the owner forward that something was captured without its contents", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Webhook URL for Marketing"), {
      target: { value: "https://hooks.example.com/abc" },
    });
    fireEvent.click(row("Marketing").getByLabelText("Include the note body"));
    fireEvent.click(row("Marketing").getByLabelText("Include the summary"));
    fireEvent.click(row("Marketing").getByRole("button", { name: /Add webhook/i }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ include_note: false, include_summary: false }),
    );
  });

  it("hides the signing secret until asked", () => {
    hooks = [configured()];
    renderPage();
    expect(screen.queryByText(/s3cr3t-value/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show/i }));
    expect(screen.getByText(/s3cr3t-value/)).toBeInTheDocument();
  });

  it("says the secret is a credential, not a display value", () => {
    hooks = [configured()];
    renderPage();
    expect(screen.getByText(/Anyone holding it can forge one/i)).toBeInTheDocument();
  });

  it("reports the last delivery, including a failure", () => {
    hooks = [configured({ last_error: "Endpoint returned 500", last_status: 500 })];
    renderPage();
    expect(screen.getByText(/failed: Endpoint returned 500/)).toBeInTheDocument();
  });

  it("offers a test that does not need a real capture", () => {
    hooks = [configured()];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Send test/i }));
    expect(test_).toHaveBeenCalledWith("f1");
  });

  it("turns forwarding off without discarding the endpoint", () => {
    // Deleting the row to pause would lose the URL and rotate the secret.
    hooks = [configured()];
    renderPage();
    fireEvent.click(screen.getByLabelText("Forwarding for Marketing"));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, url: "https://hooks.example.com/abc" }),
    );
  });

  it("shows a folder with no webhook as an empty form, not as missing", () => {
    hooks = [configured()];
    renderPage();
    const reading = screen.getByLabelText("Webhook URL for Reading list") as HTMLInputElement;
    expect(reading.value).toBe("");
  });

  it("documents the payload and how to verify a delivery", () => {
    renderPage();
    expect(screen.getByText(/idea\.captured/)).toBeInTheDocument();
    expect(screen.getByText(/timingSafeEqual/)).toBeInTheDocument();
    // Named in the prose and again in the snippet.
    expect(screen.getAllByText(/X-Fartbrains-Signature/).length).toBeGreaterThan(0);
  });

  it("says plainly that we do not retry", () => {
    renderPage();
    expect(screen.getByText(/do not retry/i)).toBeInTheDocument();
  });
});
