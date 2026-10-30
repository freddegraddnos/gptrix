import { useEffect, useState } from "react";
import { useStudioModules } from "@/hooks/useStudioModules";
import { STUDIO_MODULES, type StudioModule } from "@/lib/studioModules";
import { useStudioLang } from "@/lib/studioLang";
import { Button } from "@/components/ui/button";

const labels: Record<StudioModule, { en: string; sv: string }> = {
  requests: { en: "Client requests", sv: "Kundförfrågningar" },
  designs: { en: "Available designs and design tools", sv: "Tillgängliga motiv och designverktyg" },
  booking: { en: "Availability and booking", sv: "Lediga tider och bokning" },
  payments: { en: "Deposits and payments", sv: "Deposition och betalning" },
  fortnox: { en: "Fortnox accounting", sv: "Bokföring med Fortnox" },
  models: { en: "3D projects", sv: "3D-projekt" },
};

export function StudioModules() {
  const [lang] = useStudioLang();
  const sv = lang === "sv";
  const { enabled, loading, error, save } = useStudioModules();
  const [selected, setSelected] = useState<StudioModule[]>(enabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setSelected(enabled);
  }, [enabled]);

  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      await save(selected);
      setMessage(sv ? "Modulvalen har sparats." : "Module choices saved.");
    } catch {
      setMessage(
        sv
          ? "Modulvalen kunde inte sparas. Kontrollera din behörighet och försök igen."
          : "Could not save module choices. Check your access and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-bold">{sv ? "Moduler" : "Modules"}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {sv
          ? "Välj de verktyg studion använder. Profilen och tidigare ärenden finns kvar. Om du döljer bokning eller ekonomi behöver du fortfarande hantera pågående åtaganden; återaktivera modulen för att visa verktygen igen. Valet ansluter inte betalning eller Fortnox, som kräver egen konfiguration."
          : "Choose the tools your studio uses. Your profile and existing cases remain available. If you hide booking or accounting, you still need to handle ongoing obligations; re-enable the module to show its tools again. Selecting a module does not connect payments or Fortnox; each requires separate setup."}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {sv
            ? "Kunde inte läsa modulvalen. Alla verktyg visas tills anslutningen fungerar."
            : "Could not load module choices. All tools remain visible until the connection works."}
        </p>
      )}
      <fieldset disabled={loading || busy || error} className="mt-4 space-y-2">
        <legend className="sr-only">{sv ? "Välj moduler" : "Choose modules"}</legend>
        {STUDIO_MODULES.map((key) => (
          <label key={key} className="flex min-h-10 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={(e) =>
                setSelected((current) =>
                  e.target.checked ? [...current, key] : current.filter((item) => item !== key),
                )
              }
            />
            {labels[key][sv ? "sv" : "en"]}
          </label>
        ))}
        <Button type="button" onClick={() => void submit()} disabled={busy}>
          {sv ? "Spara modulval" : "Save modules"}
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
