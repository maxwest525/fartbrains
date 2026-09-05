import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      /*
       * The edge functions are Deno and import their dependencies by URL, which
       * Node's ESM loader refuses. Pointing that specifier at the copy already
       * in node_modules lets the shared modules under supabase/functions be
       * imported and tested here, rather than only asserted against as text.
       */
      "https://esm.sh/@supabase/supabase-js@2.95.0": "@supabase/supabase-js",
    },
  },
});
