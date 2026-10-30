import {
  getVapidPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/notifications.functions";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** Asks for permission, subscribes, and stores the subscription server-side. */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: "Push notifications are not supported on this device or browser." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "Notifications are blocked. Enable them for InkSimulator in your browser or iOS settings."
          : "Notification permission was dismissed.",
    };
  }
  const { key } = await getVapidPublicKey();
  if (!key) return { ok: false, error: "Push is not configured yet. Try again later." };

  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: "Could not read the push subscription from this browser." };
    }
    const saved = await savePushSubscription({
      data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 300),
      },
    });
    if (!saved.ok) return { ok: false, error: "Could not save this device. Try again." };
    return { ok: true };
  } catch (err) {
    console.error("[push] enable failed", err);
    return { ok: false, error: "Something blocked the subscription. Try again from the home screen app." };
  }
}

export async function disablePush(): Promise<{ ok: boolean }> {
  const sub = await currentPushSubscription();
  if (!sub) return { ok: true };
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  await removePushSubscription({ data: { endpoint } });
  return { ok: true };
}
