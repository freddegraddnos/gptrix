/**
 * Connected accounts: X, Facebook, Instagram, and Snapchat.
 *
 * OAuth status per platform (researched ahead of the build):
 * - Facebook: OAuth is supported by Lovable Cloud Auth (a Meta app is
 *   required, plus app review for public permissions). Can be enabled at no extra cost.
 * - Instagram: now Instagram Login via Meta. Direct publishing of images
 *   from a third-party app requires the Content Publishing API + a business account and
 *   partnership/app review — so we only link the profile and share via
 *   Web Share/"save to camera roll".
 * - X (Twitter): OAuth 2.0 requires its own developer account and a paid API
 *   tier for publishing. We use a web intent (opens X with prefilled text).
 * - Snapchat: Login Kit + Creative Kit require an approved Snap developer app
 *   and review before direct sharing works. Web Share is the fallback.
 *
 * Until OAuth is approved per platform, the account is linked by having the
 * user enter their username — this link powers profile icons and share
 * suggestions, and can be upgraded to real OAuth without changing the data.
 */

export type SocialPlatform =
  | "x"
  | "facebook"
  | "instagram"
  | "snapchat"
  | "tiktok";

export type PlatformInfo = {
  id: SocialPlatform;
  label: string;
  /** Short status note shown in settings. */
  note: string;
  /** Can we open a ready-made share dialog with link + text? */
  canShareLink: boolean;
  /** Requires the file to be saved to the camera roll first. */
  needsSavedFile: boolean;
  color: string;
  profileUrl: (username: string) => string;
  shareUrl?: (url: string, text: string) => string;
};

export const PLATFORMS: PlatformInfo[] = [
  {
    id: "x",
    label: "X",
    note: "Sharing via X's web intent. Automatic publishing requires a paid X API tier.",
    canShareLink: true,
    needsSavedFile: false,
    color: "#ffffff",
    profileUrl: (u) => `https://x.com/${u}`,
    shareUrl: (url, text) =>
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    note: "Sharing via Facebook's sharer. Login with Meta OAuth can be enabled once the Meta app is reviewed.",
    canShareLink: true,
    needsSavedFile: false,
    color: "#1877F2",
    profileUrl: (u) => `https://facebook.com/${u}`,
    shareUrl: (url, text) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    note: "Instagram doesn't allow direct publishing from third-party apps without a content partnership — we save the file and open the app.",
    canShareLink: false,
    needsSavedFile: true,
    color: "#E1306C",
    profileUrl: (u) => `https://instagram.com/${u}`,
  },
  {
    id: "snapchat",
    label: "Snapchat",
    note: "Creative Kit requires an approved Snap app. Until then: save the video/image and share via the Snapchat app.",
    canShareLink: false,
    needsSavedFile: true,
    color: "#FFFC00",
    profileUrl: (u) => `https://snapchat.com/add/${u}`,
  },
  {
    id: "tiktok",
    label: "TikTok",
    note: "TikTok has no web publishing API for third-party apps — we save the clip and open TikTok so you can post it.",
    canShareLink: false,
    needsSavedFile: true,
    color: "#25F4EE",
    profileUrl: (u) => `https://tiktok.com/@${u}`,
  },
];

export function platformInfo(id: string): PlatformInfo | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/** Strips @, whitespace, and any pasted profile URL. */
export function normalizeUsername(raw: string): string {
  let v = raw.trim();
  if (/^https?:\/\//i.test(v)) {
    const parts = v.split("?")[0].replace(/\/+$/, "").split("/");
    v = parts[parts.length - 1] ?? "";
  }
  return v.replace(/^@/, "").replace(/\s+/g, "");
}
