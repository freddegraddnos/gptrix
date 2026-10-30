/**
 * Plain-language recovery help for the two things that silently break sharing
 * and the camera on phones: a blocked pop-up and a denied permission.
 */

export type TroubleKind = "popup" | "camera" | "share" | "clipboard";

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(ua()) ||
  (/Macintosh/.test(ua()) &&
    typeof document !== "undefined" &&
    "ontouchend" in document);

export const isAndroid = () => /Android/.test(ua());

/** Human name of the browser, used in the step-by-step copy. */
export const browserName = () => {
  const s = ua();
  if (/CriOS|Chrome\//.test(s)) return "Chrome";
  if (/FxiOS|Firefox\//.test(s)) return "Firefox";
  if (/EdgiOS|Edg\//.test(s)) return "Edge";
  if (/Safari\//.test(s)) return "Safari";
  return "your browser";
};

/**
 * There is no web API that opens OS settings. iOS accepts the `app-settings:`
 * scheme from a user gesture; everywhere else we fall back to the browser's
 * own site-settings page. Returns false when neither could be opened, so the
 * caller can keep showing the manual steps.
 */
export const openAppSettings = (): boolean => {
  if (typeof window === "undefined") return false;
  const tryOpen = (url: string) => {
    try {
      const w = window.open(url, "_blank");
      return !!w;
    } catch {
      return false;
    }
  };
  if (isIOS()) {
    try {
      window.location.href = "app-settings:";
      return true;
    } catch {
      return false;
    }
  }
  if (/Chrome\//.test(ua()) && !isAndroid()) {
    return tryOpen("chrome://settings/content/camera");
  }
  return false;
};

export type TroubleGuide = { title: string; steps: string[] };

export const troubleshootFor = (kind: TroubleKind): TroubleGuide => {
  const b = browserName();
  if (kind === "popup") {
    return {
      title: "The app window was blocked",
      steps: isIOS()
        ? [
            `In ${b}, tap the "aA" icon in the address bar → Website Settings.`,
            "Turn off Block Pop-ups for inksimulator.com.",
            "Come back here and tap the button again.",
          ]
        : [
            `Tap the lock or ⓘ icon next to the address in ${b}.`,
            "Set Pop-ups and redirects to Allowed.",
            "Reload the page and try the share again.",
          ],
    };
  }
  if (kind === "camera") {
    return {
      title: "Camera access is switched off",
      steps: isIOS()
        ? [
            "Open Settings → Safari → Camera and choose Ask or Allow.",
            "If you added InkSimulator to the Home Screen: Settings → InkSimulator → Camera.",
            "Return here and reload the page.",
          ]
        : [
            `Tap the lock icon next to the address in ${b} → Permissions.`,
            "Allow Camera (and Microphone if you want sound).",
            "Reload the page.",
          ],
    };
  }
  if (kind === "clipboard") {
    return {
      title: "Could not copy automatically",
      steps: [
        "Select the text below and copy it by hand.",
        `${b} only allows copying right after a tap — try the button once more.`,
      ],
    };
  }
  return {
    title: "This device can't open the share sheet",
    steps: [
      "Save the file instead — the button below puts it in your camera roll.",
      "Open Instagram or TikTok and pick it from your gallery.",
      "On a computer, download it and upload from the app on your phone.",
    ],
  };
};
