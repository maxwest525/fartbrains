/**
 * Extract readable text + title from an arbitrary web page.
 *
 * Note: We deliberately avoid JSDOM/Readability here — those packages call
 * native APIs that the Supabase edge runtime denies (NotCapable: --allow-run).
 * Instead we do a lightweight regex-based scrape: meta tags for title, then
 * strip scripts/styles/tags from <body> to get text content.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_RE = (prop: string) =>
  new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
const ALT_META_RE = (prop: string) =>
  new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i"
  );

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

const pickMeta = (html: string, prop: string): string | null => {
  const m = html.match(META_RE(prop)) ?? html.match(ALT_META_RE(prop));
  return m ? decodeEntities(m[1]) : null;
};

const pickTitle = (html: string): string | null => {
  const og = pickMeta(html, "og:title") ?? pickMeta(html, "twitter:title");
  if (og) return og;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : null;
};

const pickSiteName = (html: string): string | null =>
  pickMeta(html, "og:site_name") ?? pickMeta(html, "application-name");

/**
 * Strip a HTML doc down to readable text:
 *  - drop <script>, <style>, <noscript>, <svg>, <nav>, <footer>, <header>, <aside>
 *  - keep paragraph breaks
 *  - collapse whitespace
 */
const extractText = (html: string): string => {
  // Prefer body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : html;

  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  // Convert block-level closers into newlines so paragraphs are preserved.
  body = body.replace(
    /<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi,
    "\n"
  );
  body = body.replace(/<br\s*\/?>/gi, "\n");

  // Strip all remaining tags.
  body = body.replace(/<[^>]+>/g, " ");
  body = decodeEntities(body);

  // Collapse whitespace; keep blank lines between paragraphs.
  body = body
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

  return body.trim();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return jsonErr("URL required", 400);
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return jsonErr("Invalid URL", 400);
    }
    if (!["http:", "https:"].includes(target.protocol)) {
      return jsonErr("Only http(s) URLs supported", 400);
    }

    const resp = await fetch(target.toString(), {
      headers: {
        // Use a real desktop UA — many sites serve different markup to bots.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!resp.ok) {
      return jsonErr(`Failed to fetch URL (${resp.status})`, 422);
    }

    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return jsonErr("URL did not return HTML content", 422);
    }

    const html = await resp.text();
    const title = pickTitle(html);
    const siteName = pickSiteName(html);
    const text = extractText(html);

    if (!text || text.length < 50) {
      return jsonErr(
        "Couldn't extract readable text. The site may be JS-heavy or behind a paywall. Try paste-as-transcript.",
        422
      );
    }

    // Cap absurdly long pages so the summarizer prompt stays sane.
    const MAX = 40_000;
    const trimmed = text.length > MAX ? text.slice(0, MAX) : text;

    return new Response(
      JSON.stringify({ title, text: trimmed, siteName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-url error:", e);
    return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
