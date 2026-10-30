/**
 * Sharing helpers: compose branded previews, save media to the device
 * camera roll / downloads, and share files or links to social apps.
 */

import {
  drawShareFrame,
  targetSize,
  type ShareFormat,
} from "@/lib/shareFrame";
import { ensureMp4, withMp4Extension } from "@/lib/videoTranscode";

export {
  SHARE_FORMATS,
  type ShareFormat,
} from "@/lib/shareFrame";

/** Output file type for image exports. */
export type ShareFileType = "png" | "jpg";

export const FILE_TYPES: { id: ShareFileType; label: string; hint: string }[] = [
  { id: "jpg", label: "JPG", hint: "Smaller file, fastest to send" },
  { id: "png", label: "PNG", hint: "Lossless, sharpest lines" },
];

export const mimeFor = (t: ShareFileType) =>
  t === "jpg" ? "image/jpeg" : "image/png";

export type ComposeOptions = {
  /** Big headline burned into the image. */
  caption?: string;
  /** Small line under the headline. */
  subline?: string;
  /** Output aspect ratio. Defaults to the source frame. */
  format?: ShareFormat;
  /** png (default) or jpg. */
  fileType?: ShareFileType;
};

/**
 * Burns a caption plus the InkSimulator logo and inksimulator.com URL into a shot.
 * The frame can be reshaped to 9:16 or 1:1 for social feeds; layout keeps all
 * text and the badge inside the format's safe area so nothing gets cut off.
 */
export async function composeShareImage(
  sourceDataUrl: string,
  opts: ComposeOptions = {},
): Promise<string> {
  const img = await loadImage(sourceDataUrl);
  const format = opts.format ?? "original";
  const { w, h } = targetSize(format, img);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;

  drawShareFrame(ctx, img, w, h, {
    caption: opts.caption ?? "Should I get this tattoo?",
    subline: opts.subline,
    format,
  });

  const type = opts.fileType ?? "png";
  return canvas.toDataURL(mimeFor(type), type === "jpg" ? 0.92 : undefined);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

type NavWithShare = Navigator & { canShare?: (data: ShareData) => boolean };

export function canShareFiles(file: File): boolean {
  const nav = navigator as NavWithShare;
  return !!nav.share && !!nav.canShare?.({ files: [file] });
}

/** Trigger a real download — lands in Photos/Gallery on Android, Files on iOS. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Videos recorded on older Android browsers are WebM, which Snapchat and some
 * other apps refuse to load — convert to MP4 before creating the share file.
 */
async function asMp4(
  blob: Blob,
  filename: string,
): Promise<{ blob: Blob; filename: string }> {
  if (!blob.type.startsWith("video/")) return { blob, filename };
  const mp4 = await ensureMp4(blob);
  return mp4 === blob
    ? { blob, filename }
    : { blob: mp4, filename: withMp4Extension(filename) };
}

/**
 * Opens the OS share sheet with the media file attached (WhatsApp, Instagram,
 * TikTok, Messenger, Facebook, Messages, "Spara bild" → kamerarullen).
 * Falls back to a download when the browser can't share files.
 */
export async function shareFile(
  blob: Blob,
  filename: string,
  opts: { title?: string; text?: string } = {},
): Promise<ShareOutcome> {
  void opts;
  ({ blob, filename } = await asMp4(blob, filename));
  const type = blob.type && /^(image\/(png|jpeg)|video\/(mp4|quicktime|webm))$/.test(blob.type)
    ? blob.type
    : "image/png";
  const safeName = filename.replace(/\.[a-z0-9]+$/i, "") +
    (type === "image/jpeg" ? ".jpg" : type === "image/png" ? ".png" : type === "video/mp4" ? ".mp4" : type === "video/quicktime" ? ".mov" : ".webm");
  const file = new File([blob], safeName, { type });
  if (canShareFiles(file)) {
    try {
      // Files only: Snapchat, Instagram and others fail to load the image
      // ("Fel när bilden skulle laddas") when text/title ride along with a file.
      await (navigator as NavWithShare).share({ files: [file] });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // fall through to download
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

/** Backwards-compatible image share from a data URL. */
export async function shareImage(dataUrl: string, filename = "inksimulator.png") {
  const blob = await dataUrlToBlob(dataUrl);
  return shareFile(blob, filename);
}

/** Save media to the device camera roll (via share sheet) or downloads. */
export async function saveToCameraRoll(
  blob: Blob,
  filename: string,
): Promise<ShareOutcome> {
  ({ blob, filename } = await asMp4(blob, filename));
  const file = new File([blob], filename, { type: blob.type });
  // On iOS the share sheet is the only route into Photos; on Android a
  // download lands directly in the gallery.
  const isIOS =
    typeof navigator !== "undefined" &&
    /iP(hone|ad|od)/.test(navigator.userAgent);
  if (isIOS && canShareFiles(file)) {
    return shareFile(blob, filename, { text: "Spara i kamerarullen" });
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export type SocialTarget = {
  id: string;
  label: string;
  href: string | null;
  /** true when the app can't receive files/links directly from the web */
  needsSavedFile?: boolean;
};

/** Deep links for sharing a link (motif, profile, preview page). */
export function socialLinkTargets(url: string, text: string): SocialTarget[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    {
      id: "messenger",
      label: "Messenger",
      href: `https://www.facebook.com/dialog/send?link=${u}&app_id=291494419107518&redirect_uri=${u}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`,
    },
    { id: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: "sms", label: "SMS", href: `sms:?&body=${t}%20${u}` },
    { id: "email", label: "E-post", href: `mailto:?subject=${t}&body=${u}` },
    { id: "instagram", label: "Instagram", href: null, needsSavedFile: true },
    { id: "tiktok", label: "TikTok", href: null, needsSavedFile: true },
  ];
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Share a plain link through the OS sheet, falling back to clipboard copy. */
export async function shareLink(
  url: string,
  text: string,
): Promise<"shared" | "copied" | "cancelled"> {
  const nav = navigator as NavWithShare;
  if (nav.share) {
    try {
      await nav.share({ title: "InkSimulator", text, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  return (await copyToClipboard(`${text} ${url}`)) ? "copied" : "cancelled";
}

/**
 * Build a deep link that opens the same AR view for the recipient:
 * same motif, same physical width (cm) and same rotation.
 */
export function arMotifShareUrl(
  motifId: string,
  opts?: { widthCm?: number | string; rotation?: number },
): string {
  if (typeof window === "undefined") return "";
  const url = new URL("/ar", window.location.origin);
  url.searchParams.set("motif", motifId);
  // marks the link as shared so the recipient's open can be tracked
  url.searchParams.set("s", "1");
  const w = opts?.widthCm != null ? Number(opts.widthCm) : NaN;
  if (Number.isFinite(w) && w > 0) url.searchParams.set("w", w.toFixed(1));
  const r = opts?.rotation;
  if (typeof r === "number" && Number.isFinite(r) && Math.abs(r) > 0.5) {
    url.searchParams.set("r", Math.round(r).toString());
  }
  return url.toString();
}

// --- One-tap social posting -------------------------------------------------

export type PostTarget = "instagram-story" | "instagram" | "snapchat" | "tiktok";

const APP_URLS: Record<PostTarget, string> = {
  "instagram-story": "instagram://story-camera",
  instagram: "instagram://library",
  snapchat: "snapchat://",
  tiktok: "snssdk1233://",
};

export const POST_TARGETS: { id: PostTarget; label: string }[] = [
  { id: "instagram-story", label: "IG Story" },
  { id: "instagram", label: "Instagram" },
  { id: "snapchat", label: "Snapchat" },
  { id: "tiktok", label: "TikTok" },
];

/**
 * Instagram, Snapchat and TikTok do not accept a post from a web page, so the
 * reliable flow is: hand the file to the share sheet / camera roll, then open
 * the app so the user only has to pick the shot.
 */
export async function postToApp(
  target: PostTarget,
  blob: Blob,
  filename = "inksimulator.png",
): Promise<"shared" | "downloaded" | "cancelled"> {
  const result = await saveToCameraRoll(blob, filename);
  if (result === "cancelled") return result;
  try {
    window.location.href = APP_URLS[target];
  } catch {
    /* app not installed — the file is already saved */
  }
  return result;
}
