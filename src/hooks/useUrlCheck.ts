import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UrlCheckStatus = "idle" | "checking" | "ok" | "error";

export type UrlCheckResult = {
  status: UrlCheckStatus;
  /** HTTP status when known. */
  httpStatus: number | null;
  /** True if the server reported the request followed a redirect. */
  redirected: boolean;
  /** Final URL after redirects (server-reported). */
  finalUrl: string | null;
  /** Friendly message for display. */
  message: string | null;
};

const initial: UrlCheckResult = {
  status: "idle",
  httpStatus: null,
  redirected: false,
  finalUrl: null,
  message: null,
};

const looksLikeUrl = (s: string) => {
  const v = s.trim();
  if (v.length < 4) return false;
  // Accept "example.com", "https://x.y", "http://x.y/path"
  return /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(v);
};

/**
 * Debounced live reachability check for a URL. Calls the `check-url` edge
 * function 600ms after the input settles. Returns idle status for empty or
 * obviously-not-a-URL input so we don't spam the function.
 */
export function useUrlCheck(url: string, enabled: boolean): UrlCheckResult {
  const [result, setResult] = useState<UrlCheckResult>(initial);

  useEffect(() => {
    if (!enabled) {
      setResult(initial);
      return;
    }
    const trimmed = url.trim();
    if (!trimmed) {
      setResult(initial);
      return;
    }
    if (!looksLikeUrl(trimmed)) {
      setResult({
        status: "error",
        httpStatus: null,
        redirected: false,
        finalUrl: null,
        message: "Doesn't look like a URL",
      });
      return;
    }

    let cancelled = false;
    setResult((r) => ({ ...r, status: "checking", message: "Checking…" }));

    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-url", {
          body: { url: trimmed },
        });
        if (cancelled) return;
        if (error) {
          setResult({
            status: "error",
            httpStatus: null,
            redirected: false,
            finalUrl: null,
            message: "Couldn't verify (network)",
          });
          return;
        }
        const ok: boolean = !!data?.ok;
        setResult({
          status: ok ? "ok" : "error",
          httpStatus: typeof data?.status === "number" ? data.status : null,
          redirected: !!data?.redirected,
          finalUrl: data?.finalUrl ?? null,
          message:
            data?.message ??
            (ok ? `Reachable${data?.status ? ` (HTTP ${data.status})` : ""}` : "Unreachable"),
        });
      } catch {
        if (cancelled) return;
        setResult({
          status: "error",
          httpStatus: null,
          redirected: false,
          finalUrl: null,
          message: "Couldn't verify",
        });
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [url, enabled]);

  return result;
}
