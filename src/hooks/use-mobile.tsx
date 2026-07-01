import * as React from "react";

/**
 * The app is designed as a phone-width widget on every viewport.
 * We intentionally always report "mobile" so the same single-column layout,
 * bottom tab bar, and mobile flows are used on desktop too. The desktop
 * viewport just centers the phone-width frame (see `#root` rules in
 * `src/index.css`).
 */
export function useIsMobile() {
  return true;
}
