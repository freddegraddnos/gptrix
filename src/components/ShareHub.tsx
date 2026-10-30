import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Link2,
  Loader2,
  Share2,
  Sparkles,
  ThumbsUp,
  Video,
  X,
} from "lucide-react";
import {
  canShareFiles,
  composeShareImage,
  dataUrlToBlob,
  downloadBlob,
  saveToCameraRoll,
  shareFile,
  SHARE_FORMATS,
  FILE_TYPES,
  type ShareFileType,
  type ShareFormat,
} from "@/lib/share";
import { clipSupported, renderShareClip } from "@/lib/shareClip";
import { createVoteSession } from "@/lib/votes.functions";
import { SocialIcon } from "@/components/SocialIcon";
import { TroubleshootNote } from "@/components/TroubleshootNote";

type Tab = "image" | "vote" | "reaction";

/** Destinations we can hand media to, each with its own crop and copy. */
type Platform = "instagram-story" | "instagram-post" | "tiktok" | "facebook";

type PlatformState = "idle" | "busy" | "ok" | "error";

const PLATFORMS: Record<
  Platform,
  {
    label: string;
    icon: "instagram" | "tiktok" | "facebook";
    sheetHint: string;
    webUrl: (link: string | null) => string;
  }
> = {
  "instagram-story": {
    label: "Instagram Story",
    icon: "instagram",
    sheetHint: "Instagram → Stories",
    webUrl: () => "https://www.instagram.com/",
  },
  "instagram-post": {
    label: "Instagram Post",
    icon: "instagram",
    sheetHint: "Instagram → Feed",
    webUrl: () => "https://www.instagram.com/",
  },
  tiktok: {
    label: "TikTok",
    icon: "tiktok",
    sheetHint: "TikTok",
    webUrl: () => "https://www.tiktok.com/upload",
  },
  facebook: {
    label: "Facebook",
    icon: "facebook",
    sheetHint: "Facebook",
    webUrl: (link) =>
      link
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`
        : "https://www.facebook.com/",
  },
};

const CAPTIONS = [
  "Should I get this tattoo?",
  "Yes or no? Be honest.",
  "New ink loading…",
  "Mum, I got a tattoo.",
  "Rate it 1–10.",
];

/**
 * One place to share a tattoo preview: a branded image, a yes/no vote link,
 * and an optional reaction cam that films the recipient's face and sends it back.
 */
export function ShareHub({
  image,
  video,
  defaultCaption,
  canCreateLink,
  onRequireAuth,
  onClose,
  initialTab = "image",
  initialReactionCam = false,
}: {
  /** Still frame (also used as the video's poster/fallback). */
  image: string;
  /** Optional recorded AR clip — enables video sharing and video votes. */
  video?: { url: string; blob: Blob; ext: string } | null;
  defaultCaption?: string;
  canCreateLink: boolean;
  onRequireAuth: () => void;
  onClose: () => void;
  /** Which tab to open on — "vote" or "reaction" jump straight to that link flow. */
  initialTab?: Tab;
  /** Pre-enable the reaction cam (used by the prank shortcut). */
  initialReactionCam?: boolean;
}) {
  const isVideo = !!video;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [caption, setCaption] = useState(defaultCaption ?? CAPTIONS[0]!);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [platformStatus, setPlatformStatus] = useState<
    Partial<Record<Platform, { state: PlatformState; text: string }>>
  >({});
  const [reactionCam, setReactionCam] = useState(initialReactionCam);
  const [showVoters, setShowVoters] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<ShareFormat>("9:16");
  const [fileType, setFileType] = useState<ShareFileType>("jpg");
  const [clipSeconds, setClipSeconds] = useState(4);
  const [clipProgress, setClipProgress] = useState(0);
  /** Destination the user is previewing before it goes to the share sheet. */
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);


  useEffect(() => {
    let alive = true;
    setPreview(null);
    if (isVideo) return;
    composeShareImage(image, {
      caption,
      subline: "See your tattoo before the needle",
      format,
      fileType,
    })
      .then((out) => alive && setPreview(out))
      .catch(() => alive && setPreview(image));
    return () => {
      alive = false;
    };
  }, [image, caption, format, fileType, isVideo]);

  const shareText = useMemo(
    () =>
      link
        ? tab === "reaction"
          ? `${caption} Open this and film your face 👉 ${link}`
          : `${caption} Vote here 👉 ${link}`
        : `${caption} — made with InkSimulator · inksimulator.com`,
    [caption, link, tab],
  );

  /** Each mode gets its own link — switching tabs starts a fresh one. */
  const switchTab = (next: Tab) => {
    setTab(next);
    setLink(null);
    setStatus(null);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setBusy(null);
    }
  };

  const fileName = (ext: string = isVideo ? (video?.ext ?? "mp4") : fileType) =>
    `inksimulator-${format.replace(":", "x")}-${Date.now()}.${ext}`;

  /** The blob we share: the recorded clip when present, otherwise the branded still. */
  const shareBlob = async () =>
    video ? video.blob : await dataUrlToBlob(preview ?? image);

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the recording."));
      reader.readAsDataURL(blob);
    });

  /** The exact crop each destination expects. */
  const targetFormat = (id: Platform): ShareFormat =>
    id === "instagram-post" ? "1:1" : "9:16";

  /** Branded media rendered for that destination's aspect ratio. */
  const blobForTarget = async (id: Platform) => {
    if (video) return video.blob;
    const out = await composeShareImage(image, {
      caption,
      subline: "See your tattoo before the needle",
      format: targetFormat(id),
      fileType,
    });
    return dataUrlToBlob(out);
  };

  /** Show exactly how the post will look before anything leaves the app. */
  const previewPlatform = (id: Platform) => {
    setPendingPlatform(id);
    setPendingPreview(null);
    if (video) return;
    void composeShareImage(image, {
      caption,
      subline: "See your tattoo before the needle",
      format: targetFormat(id),
      fileType,
    })
      .then(setPendingPreview)
      .catch(() => setPendingPreview(image));
  };



  /**
   * Instagram / TikTok can't take a link from the web. On mobile the right
   * route is the OS share sheet with the file attached — Instagram (story or
   * feed), TikTok and Facebook appear there as direct targets. Only when the
   * browser can't share files (desktop) do we save the file and open the app.
   */
  const toApp = (id: Platform) => {
    const meta = PLATFORMS[id];
    setPendingPlatform(null);
    setPlatformStatus((s) => ({
      ...s,
      [id]: { state: "busy", text: `Preparing ${meta.label}…` },
    }));
    return run(id, async () => {

      try {
        const blob = await blobForTarget(id);
        const name = fileName(
          video ? (video.ext ?? "mp4") : fileType,
        ).replace(format.replace(":", "x"), targetFormat(id).replace(":", "x"));
        const file = new File([blob], name, { type: blob.type });
        let linkCopied = false;
        if (link)
          linkCopied = await navigator.clipboard
            .writeText(shareText)
            .then(() => true)
            .catch(() => false);

        if (canShareFiles(file)) {
          const outcome = await shareFile(blob, name, {
            title: "My InkSimulator tattoo",
            text: shareText,
          });
          if (outcome === "shared") {
            setPlatformStatus((s) => ({
              ...s,
              [id]: {
                state: "ok",
                text: `Sent to the share sheet — pick ${meta.sheetHint}${
                  linkCopied ? " · caption + link copied" : ""
                }`,
              },
            }));
            return;
          }
          if (outcome === "cancelled") {
            setPlatformStatus((s) => ({
              ...s,
              [id]: { state: "idle", text: "Sharing cancelled — nothing was posted." },
            }));
            return;
          }
        }

        // Desktop / no file sharing: save locally, then open the app/site.
        await saveToCameraRoll(blob, name);
        const opened = window.open(meta.webUrl(link), "_blank", "noopener");
        setPlatformStatus((s) => ({
          ...s,
          [id]: opened
            ? {
                state: "ok",
                text: `Saved as ${targetFormat(id)} — upload it in ${meta.label}${
                  linkCopied ? " (link copied)" : ""
                }`,
              }
            : {
                state: "error",
                text: `Saved, but ${meta.label} was blocked from opening — allow pop-ups or open the app yourself.`,
              },
        }));
      } catch (e) {
        setPlatformStatus((s) => ({
          ...s,
          [id]: {
            state: "error",
            text: `${meta.label} sharing failed: ${
              e instanceof Error ? e.message : "unknown error"
            }`,
          },
        }));
        throw e;
      }
    });
  };

  const makeClip = (mode: "share" | "download") =>
    run(`clip-${mode}`, async () => {
      setClipProgress(0);
      const res = await renderShareClip(image, {
        caption,
        subline: "See your tattoo before the needle",
        format: format === "original" ? "9:16" : format,
        seconds: clipSeconds,
        onProgress: setClipProgress,
      });
      setClipProgress(0);
      const name = fileName(res.ext);
      if (mode === "download") {
        downloadBlob(res.blob, name);
        setStatus({ ok: true, text: `Clip saved (${res.ext.toUpperCase()})` });
        return;
      }
      const out = await shareFile(res.blob, name, { text: shareText });
      if (out !== "cancelled")
        setStatus({
          ok: true,
          text: out === "shared" ? "Clip shared!" : "Clip saved to device",
        });
    });

  const shareImage = () =>
    run("share", async () => {
      const blob = await shareBlob();
      const res = await shareFile(blob, fileName(), {
        text: shareText,
      });
      if (res !== "cancelled")
        setStatus({ ok: true, text: res === "shared" ? "Shared!" : "Saved to device" });
    });

  const toRoll = () =>
    run("roll", async () => {
      const blob = await shareBlob();
      const res = await saveToCameraRoll(blob, fileName());
      if (res !== "cancelled")
        setStatus({ ok: true, text: "Saved — check your camera roll" });
    });

  const download = () =>
    run("download", async () => {
      const blob = await shareBlob();
      downloadBlob(blob, fileName());
      setStatus({ ok: true, text: "Downloaded" });
    });

  const makeLink = () =>
    run("link", async () => {
      if (!canCreateLink) {
        onRequireAuth();
        return;
      }
      const media = video
        ? await blobToDataUrl(video.blob)
        : (preview ?? (await composeShareImage(image, { caption, format })));
      const res = await createVoteSession({
        data: {
          type: "yes_no",
          caption,
          isProfileOpen: tab === "vote" ? showVoters : false,
          reactionEnabled: tab === "reaction" ? true : reactionCam,
          voteEnabled: tab !== "reaction",
          imageA: { dataUrl: media },
          origin: window.location.origin,
        },
      });
      setLink(res.url);
      setStatus({
        ok: true,
        text:
          tab === "reaction"
            ? "Reaction link ready — send it to a friend"
            : "Vote link ready — share it anywhere",
      });
    });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatus({ ok: false, text: "Could not copy" });
    }
  };

  const openTarget = (url: string) => window.open(url, "_blank", "noopener");
  const enc = encodeURIComponent;

  return (
    <div className="fixed inset-0 z-[60] bg-ink/95 backdrop-blur-lg flex flex-col overflow-y-auto p-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-mono-caps text-accent text-[10px]">Share</div>
          <h2 className="font-display font-bold text-lg">Show it off</h2>
        </div>
        <button
          onClick={onClose}
          className="size-10 rounded-full glass grid place-items-center"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-slate p-1">
        {(
          [
            ["image", isVideo ? "Video" : "Image", isVideo ? Video : ImageIcon],
            ["vote", "Vote link", ThumbsUp],
            ["reaction", "Reaction cam", Video],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              tab === id ? "bg-accent text-ink" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-3.5 shrink-0" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-slate">
        {video ? (
          <video
            src={video.url}
            className="w-full max-h-[38dvh] object-contain"
            controls
            playsInline
            loop
            muted
          />
        ) : preview ? (
          <img
            src={preview}
            alt="Share preview"
            className="w-full max-h-[38dvh] object-contain"
          />
        ) : (
          <div className="h-48 grid place-items-center">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        )}
      </div>

      <div className={`mt-3 ${isVideo ? "hidden" : ""}`}>
        <span className="text-mono-caps text-[10px] text-muted-foreground">
          Format
        </span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {SHARE_FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-xl border px-2 py-2 text-left ${
                format === f.id
                  ? "border-accent bg-accent/10"
                  : "border-white/10 bg-slate"
              }`}
            >
              <span className="block text-xs font-bold">{f.label}</span>
              <span className="block text-[10px] text-muted-foreground leading-tight">
                {f.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`mt-3 ${isVideo ? "hidden" : ""}`}>
        <span className="text-mono-caps text-[10px] text-muted-foreground">
          File type
        </span>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {FILE_TYPES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFileType(f.id)}
              className={`rounded-xl border px-2 py-2 text-left ${
                fileType === f.id
                  ? "border-accent bg-accent/10"
                  : "border-white/10 bg-slate"
              }`}
            >
              <span className="block text-xs font-bold">{f.label}</span>
              <span className="block text-[10px] text-muted-foreground leading-tight">
                {f.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-mono-caps text-[10px] text-muted-foreground">
          Caption on the image
        </span>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 60))}
          className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
        />
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {CAPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCaption(c)}
              className="flex-none rounded-full border border-white/10 bg-slate px-3 h-8 text-[11px] text-muted-foreground"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {status && (
        <p
          className={`mt-3 text-[11px] ${status.ok ? "text-accent" : "text-destructive"}`}
        >
          {status.text}
        </p>
      )}

      {tab === "image" ? (
        <div className="mt-4 space-y-2 pb-8">
          <button
            onClick={shareImage}
            disabled={busy !== null}
            className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy === "share" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Share2 className="size-4" />
            )}
            Share to apps
          </button>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                "instagram-story",
                "instagram-post",
                "tiktok",
                "facebook",
              ] as Platform[]
            ).map((id) => (
              <PlatformButton
                key={id}
                id={id}
                busy={busy === id}
                disabled={busy !== null}
                status={platformStatus[id]}
                onClick={() => previewPlatform(id)}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={toRoll}
              disabled={busy !== null}
              className="h-11 rounded-xl border border-white/10 bg-slate text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <ImageIcon className="size-4" /> Camera roll
            </button>
            <button
              onClick={download}
              disabled={busy !== null}
              className="h-11 rounded-xl border border-white/10 bg-slate text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Download className="size-4" /> Download
            </button>
          </div>
          <button
            onClick={() => copy(shareText)}
            className="w-full h-11 rounded-xl border border-white/10 bg-slate text-xs font-bold flex items-center justify-center gap-2"
          >
            {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
            Copy caption + link
          </button>
          {!isVideo && clipSupported() && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate p-3">
              <div className="flex items-center gap-2">
                <Video className="size-4 text-accent" />
                <div className="text-sm font-bold">Animated clip</div>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                A short branded video — slow push-in, caption fade and the
                InkSimulator mark burned in. Perfect for Reels and TikTok.
              </p>
              <div className="mt-2 flex gap-2">
                {[3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setClipSeconds(s)}
                    className={`h-9 flex-1 rounded-lg text-[11px] font-bold border ${
                      clipSeconds === s
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-white/10 text-muted-foreground"
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => makeClip("share")}
                  disabled={busy !== null}
                  className="h-11 rounded-xl bg-accent text-ink text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy === "clip-share" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Share2 className="size-4" />
                  )}
                  Share clip
                </button>
                <button
                  onClick={() => makeClip("download")}
                  disabled={busy !== null}
                  className="h-11 rounded-xl border border-white/10 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy === "clip-download" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Download clip
                </button>
              </div>
              {busy?.startsWith("clip") && (
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-[width]"
                    style={{ width: `${Math.round(clipProgress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            Every export carries the InkSimulator mark and inksimulator.com — 9:16 for
            Stories and Reels, 1:1 for feed posts.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3 pb-8">
          {tab === "reaction" ? (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
              <div className="text-sm font-bold flex items-center gap-1.5">
                <Video className="size-4 text-accent" /> Reaction cam link
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                No voting — your friend just sees the {isVideo ? "video" : "photo"} and
                can film their face reacting to it. They get a clear consent
                prompt first and can decline. The clip comes back to you only.
              </p>
            </div>
          ) : (
            <>
              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate p-3">
                <input
                  type="checkbox"
                  checked={reactionCam}
                  onChange={(e) => setReactionCam(e.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span>
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <Video className="size-4 text-accent" /> Also ask for a reaction clip
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Off by default. Want reactions only, without a vote? Use the
                    Reaction cam tab instead.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate p-3">
                <input
                  type="checkbox"
                  checked={showVoters}
                  onChange={(e) => setShowVoters(e.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span>
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <Sparkles className="size-4 text-accent" /> Show who voted
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Voters can add their name and see the running yes/no result.
                  </span>
                </span>
              </label>
            </>
          )}

          {link ? (
            <>
              {tab === "vote" && (
                <RouterLink
                  to="/vote-results/$slug"
                  params={{ slug: link.split("/v/")[1] ?? "" }}
                  className="h-11 w-full rounded-xl border border-accent/40 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ThumbsUp className="size-4" /> See who voted
                </RouterLink>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    try {
                      if (navigator.share) {
                        await navigator.share({ text: shareText });
                      } else {
                        copy(shareText);
                      }
                    } catch {
                      /* user dismissed the share sheet */
                    }
                  }}
                  className="h-12 rounded-xl bg-accent text-ink text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Share2 className="size-4" /> Share
                </button>
                <button
                  onClick={() => openTarget(`sms:?&body=${enc(shareText)}`)}
                  className="h-12 rounded-xl border border-white/10 bg-slate text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Link2 className="size-4" /> SMS
                </button>
              </div>
              <button
                onClick={() => copy(link)}
                className="w-full h-9 text-[11px] font-bold text-muted-foreground flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
                {copied ? "Link copied" : "Copy link"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    "instagram-story",
                    "instagram-post",
                    "tiktok",
                    "facebook",
                  ] as Platform[]
                ).map((id) => (
                  <PlatformButton
                    key={id}
                    id={id}
                    busy={busy === id}
                    disabled={busy !== null}
                    status={platformStatus[id]}
                    onClick={() => previewPlatform(id)}
                  />
                ))}
              </div>
              <button
                onClick={shareImage}
                disabled={busy !== null}
                className="w-full h-11 rounded-xl border border-white/10 bg-slate text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Share2 className="size-4" />{" "}
                {isVideo ? "Share video + link" : "Share image + link"}
              </button>
            </>
          ) : (
            <button
              onClick={makeLink}
              disabled={busy !== null}
              className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy === "link" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ThumbsUp className="size-4" />
              )}
              {tab === "reaction" ? "Create reaction link" : "Create vote link"}
            </button>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            Links expire after 30 days. Reaction clips are private — only you can
            see them.
          </p>
        </div>
      )}

      {pendingPlatform && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">
                  {PLATFORMS[pendingPlatform].label} preview
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {targetFormat(pendingPlatform) === "1:1"
                    ? "Square 1:1 — this is the crop your feed post gets."
                    : "Vertical 9:16 — full-screen, nothing cropped away."}
                </p>
              </div>
              <button
                onClick={() => setPendingPlatform(null)}
                aria-label="Close preview"
                className="size-11 grid place-items-center rounded-full border border-white/10"
              >
                <X className="size-4" />
              </button>
            </div>

            <div
              className="mt-3 mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black grid place-items-center"
              style={{
                aspectRatio: targetFormat(pendingPlatform) === "1:1" ? "1/1" : "9/16",
                maxHeight: "50dvh",
              }}
            >
              {video ? (
                <video
                  src={video.url}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : pendingPreview ? (
                <img
                  src={pendingPreview}
                  alt={`${PLATFORMS[pendingPlatform].label} preview`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Loader2 className="size-5 animate-spin text-accent" />
              )}
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              Next step: pick {PLATFORMS[pendingPlatform].sheetHint} in the
              share sheet.
            </p>
            <button
              onClick={() => toApp(pendingPlatform)}
              disabled={busy !== null || (!video && !pendingPreview)}
              className="mt-3 w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Share2 className="size-4" /> Send to share sheet
            </button>
            <button
              onClick={() => setPendingPlatform(null)}
              className="mt-2 w-full min-h-[44px] rounded-xl border border-white/10 text-xs font-bold"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/** One destination button with its own inline result / error line. */
function PlatformButton({
  id,
  busy,
  disabled,
  status,
  onClick,
}: {
  id: Platform;
  busy: boolean;
  disabled: boolean;
  status?: { state: PlatformState; text: string };
  onClick: () => void;
}) {
  const meta = PLATFORMS[id];
  const tone =
    status?.state === "error"
      ? "text-destructive"
      : status?.state === "ok"
        ? "text-accent"
        : "text-muted-foreground";
  return (
    <div>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={`Share to ${meta.label}`}
        className={`w-full h-11 rounded-xl border bg-slate text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 ${
          status?.state === "error" ? "border-destructive/50" : "border-white/10"
        }`}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : status?.state === "ok" ? (
          <Check className="size-4 text-accent" />
        ) : (
          <SocialIcon platform={meta.icon} />
        )}
        {meta.label}
      </button>
      {status?.text && status.state !== "error" && (
        <p className={`mt-1 text-[10px] leading-tight ${tone}`} role="status">
          {status.text}
        </p>
      )}
      {status?.state === "error" && (
        <TroubleshootNote
          className="mt-1.5"
          kind={/pop-?up|blocked/i.test(status.text) ? "popup" : "share"}
          message={status.text}
        />
      )}

    </div>
  );
}
