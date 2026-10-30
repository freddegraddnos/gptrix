import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, FolderOpen, Loader2, Save } from "lucide-react";
import { StudioButton, StudioCard, StudioEmpty, StudioStatus, StudioSubsection } from "@/components/StudioPrimitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/design-preview/studio-components")({
  head: () => ({ meta: [
    { title: "Studio component sample — InkSimulator" },
    { name: "description", content: "Dark and bright studio workspace component review." },
    { property: "og:title", content: "Studio component sample — InkSimulator" },
    { property: "og:description", content: "InkSimulator studio workspace controls in both themes." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: StudioComponentSample,
});

function StudioComponentSample() {
  const [theme, setTheme] = useState("dark");
  const [saved, setSaved] = useState(false);
  return <main className={`studio-workbench min-h-dvh p-4 md:p-8 ${theme === "bright" ? "studio-bright" : ""}`}>
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div><p className="text-sm text-muted-foreground">InkSimulator · Komponentprov</p><h1 className="studio-heading mt-2 font-display text-3xl md:text-4xl">Studions arbetsyta</h1></div>
        <div className="flex gap-2" role="group" aria-label="Tema">
          <StudioButton variant="outline" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Mörk</StudioButton>
          <StudioButton variant="outline" aria-pressed={theme === "bright"} onClick={() => setTheme("bright")}>Ljus</StudioButton>
        </div>
      </header>
      <StudioCard className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl">Privata skisser</h2><StudioStatus><Check className="size-4" />Sparad</StudioStatus></div>
        <p className="text-sm text-muted-foreground">Skisser i detta bibliotek är privata och kan bifogas i kundmeddelanden.</p>
        <Tabs defaultValue="details"><TabsList className="flex flex-wrap h-auto justify-start"><TabsTrigger value="details">Uppgifter</TabsTrigger><TabsTrigger value="files">Filer</TabsTrigger></TabsList>
          <TabsContent value="details"><StudioSubsection className="space-y-4">
            <h3 className="font-display text-xl">Ny privat skiss</h3>
            <label className="field-label" htmlFor="sample-title">Skisstitel</label><input id="sample-title" className="studio-field" placeholder="Titel (valfritt)" />
            <p className="text-sm text-muted-foreground">PNG eller JPG, högst 10 MB.</p>
            <div className="flex flex-wrap gap-3"><StudioButton onClick={() => setSaved(true)}><Save />Spara skiss</StudioButton><StudioButton variant="outline" onClick={() => setSaved(false)}>Avbryt</StudioButton></div>
            {saved && <p role="status" className="text-sm">Sparad i komponentprovet</p>}
          </StudioSubsection></TabsContent>
          <TabsContent value="files"><StudioEmpty><FolderOpen className="size-6" /><p>Inga skisser ännu.</p></StudioEmpty></TabsContent>
        </Tabs>
      </StudioCard>
      <div className="flex flex-wrap gap-3"><StudioButton disabled><Loader2 className="animate-spin" />Sparar…</StudioButton><StudioButton variant="outline" disabled>Inaktiverad</StudioButton><StudioButton variant="outline" className="studio-control-compact">Kompakt</StudioButton></div>
      <StudioEmpty><FolderOpen className="size-6" /><p>Inga skisser ännu.</p><p className="text-sm text-muted-foreground">Ladda upp din första skiss.</p></StudioEmpty>
    </div>
  </main>;
}