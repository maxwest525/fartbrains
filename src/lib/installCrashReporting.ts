/**
 * Point the app's error hooks at the on-device crash log.
 *
 * Installed once at startup. Everything it stores has been through
 * `buildCrashReport`, so nothing here can carry note content; see
 * `crashReport.ts` for why that is built by construction rather than by
 * redacting after the fact.
 */

import { setErrorSink } from "@/components/ErrorBoundary";
import { buildCrashReport, recordCrash } from "@/lib/crashReport";

let installed = false;

export function installCrashReporting(): void {
  if (installed) return;
  installed = true;

  setErrorSink((error, info) => {
    recordCrash(
      buildCrashReport(error, {
        componentStack: info.componentStack,
        pathname: window.location.pathname,
      }),
    );
  });

  // A render crash is the minority of what breaks. Async failures — a failed
  // save, a rejected upload — never reach the boundary at all.
  window.addEventListener("error", (e) => {
    recordCrash(buildCrashReport(e.error ?? e.message, { pathname: window.location.pathname }));
  });

  window.addEventListener("unhandledrejection", (e) => {
    recordCrash(buildCrashReport(e.reason, { pathname: window.location.pathname }));
  });
}
