import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { parseShare } from "@/lib/shareTarget";

/**
 * Landing point for the PWA Web Share Target.
 *
 * Hitting Share on an Instagram reel and picking Fart Brains opens the app
 * here with the OS's `title` / `text` / `url` fields. This route does not
 * render a UI of its own: it works out what was actually shared and hands off
 * to the capture screen, so the user lands on the folder picker rather than on
 * an empty app they then have to paste into.
 *
 * The redirect replaces this entry in history, so Back returns to the sharing
 * app rather than bouncing through here again.
 */
export default function Share() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const { url, note } = parseShare({
      title: params.get("title"),
      text: params.get("text"),
      url: params.get("url"),
    });

    const next = new URLSearchParams();
    if (url) next.set("capture", url);
    if (note) next.set("note", note);

    // With no link at all there is nothing for the URL extractor to do, so we
    // drop the user into the app rather than a capture screen that cannot run.
    navigate(next.toString() ? `/?${next}` : "/", { replace: true });
  }, [params, navigate]);

  return null;
}
