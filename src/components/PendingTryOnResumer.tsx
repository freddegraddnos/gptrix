import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { saveProject } from "@/hooks/useProjects";
import { peekPendingTryOn, acknowledgePendingTryOn } from "@/lib/pendingBooking";
import { getMotifRequestContext, motifRequestPath } from "@/lib/motifRequestContext";
import { tx } from "@/lib/uiLang";

/** After sign-in, finishes a try-on that was started while signed out. */
export function PendingTryOnResumer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const busy = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user || busy.current) return;
    busy.current = true;
    void (async () => {
      const p = await peekPendingTryOn();
      if (!p) {
        busy.current = false;
        return;
      }
      try {
        const project = await saveProject({
          projectId: p.projectId,
          userId: user.id,
          name: p.name,
          bodyPart: p.bodyPart,
          tattooId: p.tattooId,
          tattooName: p.tattooName ?? p.name,
          widthCm: p.widthCm,
          previewDataUrl: p.previewDataUrl,
          basePhotoDataUrl: p.basePhotoDataUrl,
        });
        // Upload failure leaves the recovery record available for retry.
        try { await acknowledgePendingTryOn(p); }
        catch { toast.warning(tx("Saved to your account. The local recovery copy could not be removed.")); }
        if (p.intent === "send") {
          toast.success(tx("Saved to your account. Review your request before sending."));
          const context = p.tattooId ? getMotifRequestContext(p.tattooId) : null;
          if (context) void navigate({ to: `${motifRequestPath(context)}&idea=${encodeURIComponent(project.id)}` as never });
          else void navigate({ to: "/artists/search", search: { project: project.id } as never });
        } else {
          toast.success(tx("Saved to your projects"));
        }
      } catch {
        toast.error(tx("Could not save your photo. The local recovery copy is still on this device."), {
          action: { label: tx("Try again"), onClick: () => setAttempt((n) => n + 1) },
          duration: 15000,
        });
      } finally {
        busy.current = false;
      }
    })();
  }, [user, navigate, attempt]);

  return null;
}
