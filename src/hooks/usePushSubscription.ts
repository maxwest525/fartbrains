import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Browser push notification enrollment.
 *
 * Registers a service worker, exchanges the user's permission for a
 * PushSubscription, and persists it to `push_subscriptions` so the
 * server-side reminder dispatcher can target the device.
 *
 * The VAPID public key is fetched once from the `push-public-key` edge
 * function so we never have to hardcode the key in the bundle.
 */

type State = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

const SW_PATH = "/push-sw.js";

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const arrayBufferToBase64 = (buf: ArrayBuffer | null): string => {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const isSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  typeof Notification !== "undefined";

export function usePushSubscription() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  // Detect current state on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setState(sub ? "subscribed" : "unsubscribed");
      } catch {
        if (!cancelled) setState("unsubscribed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported()) {
      toast.error("Push notifications aren't supported in this browser.");
      return;
    }
    setBusy(true);
    try {
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed");
        toast.error("Notification permission was not granted.");
        return;
      }

      const reg =
        (await navigator.serviceWorker.getRegistration(SW_PATH)) ??
        (await navigator.serviceWorker.register(SW_PATH));
      await navigator.serviceWorker.ready;

      const { data: keyData, error: keyErr } = await supabase.functions.invoke(
        "push-public-key",
      );
      if (keyErr || !keyData?.publicKey) {
        throw new Error(keyErr?.message ?? "Push isn't configured on the server yet.");
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
      const json = sub.toJSON();
      const endpoint = sub.endpoint;
      const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");

      // Upsert by endpoint (one row per device).
      const { error: upsertErr } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userData.user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 250),
        },
        { onConflict: "endpoint" },
      );
      if (upsertErr) throw upsertErr;

      setState("subscribed");
      toast.success("Push notifications enabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't enable push");
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("unsubscribed");
      toast.success("Push notifications disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't disable push");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, subscribe, unsubscribe };
}
