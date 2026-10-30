import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { attachmentUrl } from "@/hooks/useMessages";
import { saveMyMotif } from "@/lib/myMotifs";

/** Renders a private chat attachment via a short-lived signed URL. */
export function ChatAttachment({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    void attachmentUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div className="h-40 w-40 rounded-xl bg-white/5 animate-pulse" aria-hidden />
    );
  }

  const tryInAr = () => {
    sessionStorage.setItem("inkvision.generated.motif", url);
    void navigate({ to: "/ar", search: { motif: "generated" } });
  };

  /** Copies the design into "My designs" so it survives the signed URL. */
  const saveToLibrary = async () => {
    setSaving(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(blob);
      });
      saveMyMotif({
        name: "Design from a studio",
        src: dataUrl,
        source: "share",
      });
      setSaved(true);
      toast.success("Saved to My designs — try it in AR whenever you want.");
    } catch {
      toast.error("Could not save the design. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt="Design sent in chat"
          loading="lazy"
          className="max-h-64 w-auto rounded-xl border border-white/10 bg-white"
        />
      </a>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={tryInAr}
          className="rounded-xl border border-accent/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-accent"
        >
          Try in AR
        </button>
        <button
          onClick={() => void saveToLibrary()}
          disabled={saving || saved}
          className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-foreground disabled:opacity-60"
        >
          {saved ? <Check className="size-3" /> : <BookmarkPlus className="size-3" />}
          {saved ? "Saved" : saving ? "Saving…" : "Save to library"}
        </button>
      </div>
    </div>
  );
}
