import { supabase } from "@/integrations/supabase/client";

/**
 * Funnel events. No personal data: only an anonymous device id, the signed-in
 * user id (if any), the page path and small non-identifying meta.
 *
 * Where each event fires:
 * - camera_prompt_shown     CameraPrimer — "Turn on camera" screen shown
 * - camera_granted          CameraPrimer — camera allowed (already or after tap)
 * - camera_denied           CameraPrimer — camera blocked / getUserMedia refused
 * - tryon_started           CameraPrimer (Live AR opens) · photo-tryon onFile (photo loaded)
 * - tryon_completed         myMotifs.saveMyMotif (design saved) · navigator.share patch below (shared)
 * - booking_started         BookingDialog — dialog opened for a studio
 * - studio_contact_clicked  click listener below — mailto:/tel:/Instagram/external link on a studio page
 * - booking_completed       BookingDialog — request submitted successfully
 * - ar_opened               ar.tsx — /ar page opened
 * - design_selected         ar.tsx (design in link) · photo-tryon strip tap
 * - photo_uploaded          photo-tryon onFile
 * - design_saved            myMotifs.saveMyMotif
 * - share_clicked           navigator.share patch below (before the share sheet)
 * - studios_viewed          studios.tsx — page opened
 * - for_studios_cta_clicked click listener below — link to /for-studios, or a CTA on /for-studios
 * - studio_request_submitted boka.$handle / boka.multi — request sent
 * - signup_started          auth.tsx — "Create account" chosen
 * - signup_completed        auth.tsx — account created
 * - city_studio_clicked     SvCityLanding — studio link clicked on a /sv/tatuerare-<stad> page (meta: handle, city)
 * Legacy: ar_started, photo_uploaded, design_saved, shared, studio_clicked.
 */
export type FunnelEvent =
  | "ar_started"
  | "photo_uploaded"
  | "design_saved"
  | "shared"
  | "studio_clicked"
  | "camera_prompt_shown"
  | "camera_granted"
  | "camera_denied"
  | "tryon_started"
  | "tryon_completed"
  | "booking_started"
  | "studio_contact_clicked"
  | "booking_completed"
  | "ar_opened"
  | "design_selected"
  | "share_clicked"
  | "studios_viewed"
  | "for_studios_cta_clicked"
  | "studio_request_submitted"
  | "signup_started"
  | "signup_completed"
  | "city_studio_clicked";

const ANON_KEY = "inksimulator.anon-id";

function anonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Send the event to the hosting's built-in analytics script (/~flock.js) as a custom event. */
function sendToFlock(event: FunnelEvent, meta: Record<string, unknown>) {
  try {
    const tb = (window as unknown as { Tinybird?: { trackEvent?: (a: string, p: Record<string, unknown>) => void } }).Tinybird;
    tb?.trackEvent?.(event, { ...meta, path: window.location.pathname });
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget funnel event. Never throws, never blocks the UI. */
export function track(event: FunnelEvent, meta: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  sendToFlock(event, meta);
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      await supabase.from("analytics_events").insert({
        event,
        anon_id: anonId(),
        user_id: data.session?.user.id ?? null,
        path: window.location.pathname,
        meta: meta as never,
      });
    } catch {
      /* analytics must never break the app */
    }
  })();
}

const STUDIO_PATH = /^\/(boka\/|studios(\/|$)|artists\/browse|a\/|(sv\/)?for-studios|(sv\/)?studio-guide)/;
const STUDIO_PAGE = /^\/(boka\/|studios(\/|$)|artists\/browse|a\/|s\/|@)/;
let installed = false;

/** Catches every successful native share and every click toward a studio, app-wide. */
export function installFunnelTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  if (typeof navigator.share === "function") {
    const original = navigator.share.bind(navigator);
    navigator.share = async (data?: ShareData) => {
      // share_clicked — user opened the native share sheet
      track("share_clicked", { files: data?.files?.length ?? 0 });
      await original(data);
      track("shared", { files: data?.files?.length ?? 0, url: Boolean(data?.url) });
      track("tryon_completed", { via: "share" });
    };
  }

  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (STUDIO_PAGE.test(window.location.pathname)) {
        const kind = href.startsWith("mailto:")
          ? "email"
          : href.startsWith("tel:")
            ? "phone"
            : /instagram\.com|ig\.me/.test(href)
              ? "instagram"
              : /^https?:/.test(href) && !href.includes(window.location.host)
                ? "website"
                : null;
        if (kind) track("studio_contact_clicked", { kind });
      }
      try {
        const url = new URL(a.href, window.location.href);
        // for_studios_cta_clicked — link into /for-studios, or a CTA (signup, pricing, phone) on it
        const onGuide = /^\/(sv\/)?(for-studios|studio-guide)/.test(window.location.pathname);
        if (
          (url.origin === window.location.origin && url.pathname.startsWith("/for-studios") && !onGuide) ||
          (onGuide && (href.startsWith("tel:") || href.startsWith("mailto:") || /^\/(artists|adminsignup|pricing|auth)/.test(url.pathname)))
        ) {
          track("for_studios_cta_clicked", { to: url.protocol.startsWith("http") ? url.pathname : url.protocol.replace(":", "") });
        }
        if (url.origin === window.location.origin && STUDIO_PATH.test(url.pathname)) {
          track("studio_clicked", { to: url.pathname });
        }
      } catch {
        /* ignore */
      }
    },
    { capture: true },
  );
}
