import { createFileRoute } from "@tanstack/react-router";
import logoAsset from "@/assets/inksimulator-logo-official.png.asset.json";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "InkSimulator — Logo" },
      { name: "description", content: "The official InkSimulator logo and app icon." },
      { property: "og:title", content: "InkSimulator — Logo" },
      { property: "og:description", content: "The official InkSimulator logo and app icon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrandPage,
});

function BrandPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-5xl">InkSimulator</h1>
        <img src={logoAsset.url} alt="InkSimulator logo" className="logo-3d mt-8 h-auto w-full max-w-3xl rounded-xl" />
        <div className="mt-8 flex items-center gap-6">
          <img src="/icon-192.png" alt="InkSimulator app icon" className="size-24" />
          <a href={logoAsset.url} download="inksimulator-logo.png" className="text-accent underline">Download logo</a>
        </div>
      </div>
    </main>
  );
}
