import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ARCameraV2, useMotifSearch, useArShareSearch } from "@/components/ARCameraV2";
import { BottomNav } from "@/components/BottomNav";
import { CameraPrimer } from "@/components/CameraPrimer";
import { trackShareOpen } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useMotif } from "@/hooks/useMarketplace";
import { getMyMotif, type MyMotif } from "@/lib/myMotifs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/arv2")({
  head: () => ({
    meta: [
      { title: "Live AR v2 (experimental) | InkSimulator" },
      { name: "description", content: "Experimental copy of the InkSimulator live AR tattoo camera." },
      { property: "og:title", content: "Live AR v2 (experimental) | InkSimulator" },
      { property: "og:description", content: "Experimental copy of the InkSimulator live AR tattoo camera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ArV2Page,
});

function ArV2Page() {
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

  const customUrl = motif?.image_url ?? generatedUrl ?? mine?.src;

  return (
    <div className="bg-ink text-foreground">
      <h1 className="sr-only">AR placement camera v2 (experimental)</h1>
      <CameraPrimer>
        <ARCameraV2
          initialTattooId={isMarketplace || isGenerated || isMine ? undefined : motifParam}
          initialWidthCm={shared.widthCm ?? mine?.widthCm}
          initialRotation={shared.rotation}
          customImageUrl={customUrl}
          motifName={motif?.name ?? mine?.name ?? (isGenerated ? "AI-generated" : undefined)}
          motifId={motif?.id}
        />
      </CameraPrimer>
      <BottomNav />
    </div>
  );
}
