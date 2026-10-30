import { createFileRoute, useSearch } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AR_ENGINE, type ArEngine } from "@/lib/deepar";

const DeepARViewer = lazy(() => import("@/components/DeepARViewer"));
const MediaPipeViewer = lazy(() => import("@/components/MediaPipeViewer"));
import { ARCamera, useMotifSearch, useArShareSearch } from "@/components/ARCamera";
import { BottomNav } from "@/components/BottomNav";
import { CameraPrimer } from "@/components/CameraPrimer";
import { trackShareOpen } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useMotif } from "@/hooks/useMarketplace";
import { getMyMotif, type MyMotif } from "@/lib/myMotifs";
import { seo } from "@/lib/seo";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/ar")({
  head: () => seo({ path: "/ar", title: "AR Tattoo Simulator – Try Tattoos on Your Body, No App | InkSimulator", description: "Try tattoos at home with a live AR tattoo simulator. Compare tattoo placement and size through your camera, free in your browser without downloading an app.", breadcrumb: "Live AR try-on" }),
  component: ArPage,
});

function ArPage() {
  const motifParam = useMotifSearch();
  const shared = useArShareSearch();
  const search = useSearch({ strict: false }) as { s?: string };
  const { user } = useAuth();

  const isMarketplace = motifParam && UUID_RE.test(motifParam);
  const isGenerated = motifParam === "generated";
  const isMine = !!motifParam && motifParam.startsWith("my_");
  const { motif } = useMotif(isMarketplace ? motifParam : undefined, user?.id);

  const [generatedUrl, setGeneratedUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (isGenerated && typeof window !== "undefined") {
      const v = sessionStorage.getItem("inkvision.generated.motif");
      if (v) setGeneratedUrl(v);
    }
  }, [isGenerated]);

  const [mine, setMine] = useState<MyMotif | undefined>(undefined);
  useEffect(() => {
    if (isMine && motifParam) setMine(getMyMotif(motifParam));
  }, [isMine, motifParam]);

  useEffect(() => {
    if (search.s && motifParam) trackShareOpen(motifParam);
  }, [search.s, motifParam]);

  useEffect(() => {
    void import("@/hooks/useJourney").then(({ markFlag }) => markFlag("ar"));
    // ar_opened — the /ar page was opened (before the camera prompt)
    void import("@/lib/track").then((t) => t.track("ar_opened"));
  }, []);

  // design_selected — a design arrived with the link (library, shop, own designs, AI)
  useEffect(() => {
    if (!motifParam) return;
    const source = isMarketplace ? "shop" : isGenerated ? "ai" : isMine ? "mine" : "library";
    void import("@/lib/track").then((t) => t.track("design_selected", { source, mode: "live_ar" }));
  }, [motifParam, isMarketplace, isGenerated, isMine]);

  const customUrl = motif?.image_url ?? generatedUrl ?? mine?.src;

  const [engine, setEngine] = useState<ArEngine>(AR_ENGINE);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("engine");
    if (q === "deepar") setEngine("deepar");
    if (q === "mediapipe") setEngine("mediapipe");
  }, []);
  const useClassic = useCallback(() => setEngine("classic"), []);
  const onDeepArFail = useCallback((reason: string) => {
    console.warn("DeepAR unavailable, using classic camera:", reason);
    setEngine("classic");
  }, []);

  const onMpFail = useCallback((reason: string) => {
    console.warn("MediaPipe unavailable, using classic camera:", reason);
    void import("sonner").then(({ toast }) => toast.error("Engine Failure"));
    setEngine("classic");
  }, []);

  return (
    <div className="bg-ink text-foreground">
      <h1 className="sr-only">AR placement camera — try your tattoo at 1:1 scale</h1>
      <CameraPrimer>
      {engine === "mediapipe" ? (
        <Suspense fallback={<div className="h-[100dvh]" />}>
          <MediaPipeViewer onFail={onMpFail} initialTattooId={isMarketplace || isGenerated || isMine ? undefined : motifParam} customImageUrl={customUrl} />
        </Suspense>
      ) : engine === "deepar" ? (
        <Suspense fallback={<div className="h-[100dvh]" />}>
          <DeepARViewer
            initialTattooId={isMarketplace || isGenerated || isMine ? undefined : motifParam}
            customImageUrl={customUrl}
            motifName={motif?.name ?? mine?.name ?? (isGenerated ? "AI-generated" : undefined)}
            onFail={onDeepArFail}
            onUseClassic={useClassic}
          />
        </Suspense>
      ) : (
      <ARCamera
        initialTattooId={
          isMarketplace || isGenerated || isMine ? undefined : motifParam
        }
        initialWidthCm={shared.widthCm ?? mine?.widthCm}
        initialRotation={shared.rotation}
        customImageUrl={customUrl}
        motifName={
          motif?.name ?? mine?.name ?? (isGenerated ? "AI-generated" : undefined)
        }
        motifId={motif?.id}
      />
      )}
      </CameraPrimer>

      <section className="sr-only">
        <h2 className="font-display text-xl uppercase text-foreground">Live AR tattoo try-on</h2>
        <p className="mt-2">
          InkSimulator Live AR places a tattoo design on your skin through your
          phone or computer camera, in true 1:1 scale. It runs in the browser —
          free, no app and no sign-up. Pick a design, point the camera at your
          arm, leg or back, then move, resize and rotate it until the placement
          feels right, and lock it so it follows your body. The camera image
          stays on your device. Save the result, share it with friends, or send
          it to an approved tattoo studio with your booking request.
        </p>
      </section>
      <BottomNav />
    </div>
  );
}
