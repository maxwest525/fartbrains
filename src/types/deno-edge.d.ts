/**
 * The shared modules under supabase/functions run on Deno and import by URL.
 * Vitest maps that URL specifier to the npm copy (see vitest.config.ts), but the
 * TypeScript project still needs declarations for it, and for Deno's globals,
 * because the browser tests import those modules directly.
 */
declare module "https://esm.sh/@supabase/supabase-js@2.95.0" {
  export * from "@supabase/supabase-js";
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  resolveDns(hostname: string, recordType: "A" | "AAAA"): Promise<string[]>;
};
