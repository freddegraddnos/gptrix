import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createStudioDraft } from "@/lib/studioDraft.functions";
import { Button } from "@/components/ui/button";
import { useStudioLang } from "@/lib/studioLang";

/** Shown only after authentication and when there is no existing studio or team. */
export function StudioDraftStart({ onCreated }: { onCreated: () => Promise<void> }) {
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => (lang === "sv" ? sv : en);
  const create = useServerFn(createStudioDraft);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [goal, setGoal] = useState<"presence" | "designs" | "booking">("presence");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await create({ data: { name, city, goal } });
      window.dispatchEvent(new Event("inksimulator:studio-modules-changed"));
      await onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr(
              "Could not create the draft. Your entries are still here.",
              "Utkastet kunde inte skapas. Dina uppgifter finns kvar här.",
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
      <h1 className="font-display text-3xl">
        {tr("Start your studio", "Kom igång med din studio")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {tr(
          "Prepare a private studio draft. Your profile becomes public only after the existing publication review. No payments or messages are activated here.",
          "Förbered ett privat studioutkast. Profilen blir offentlig först efter publiceringsgranskningen. Inga betalningar eller meddelanden aktiveras här.",
        )}
      </p>
      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
        <label className="block text-sm">
          {tr("Studio name", "Studionamn")}
          <input
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <label className="block text-sm">
          {tr("City (optional)", "Ort (valfritt)")}
          <input
            maxLength={120}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            {tr("What would you like to start with?", "Vad vill du börja med?")}
          </legend>
          {(
            [
              [
                "presence",
                "Show my studio and receive enquiries",
                "Visa studion och få förfrågningar",
              ],
              ["designs", "Find clients for my designs", "Hitta kunder till mina motiv"],
              ["booking", "Share available times", "Dela lediga tider"],
            ] as const
          ).map(([key, en, sv]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name="studio-goal"
                value={key}
                checked={goal === key}
                onChange={() => setGoal(key)}
              />
              {tr(en, sv)}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          {tr(
            "This suggests your starting tools. You can change modules later; booking does not require payments.",
            "Valet föreslår dina första verktyg. Du kan ändra moduler senare; bokning kräver inte betalning.",
          )}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="min-h-11 w-full">
          {busy
            ? tr("Creating draft…", "Skapar utkast…")
            : tr("Create private studio draft", "Skapa privat studioutkast")}
        </Button>
      </form>
      <p className="mt-5 text-xs text-muted-foreground">
        {tr(
          "Already part of a studio? Ask its owner to activate your team membership.",
          "Tillhör du redan en studio? Be ägaren aktivera ditt teammedlemskap.",
        )}
      </p>
      <Link to="/profile" className="mt-2 inline-flex min-h-11 items-center text-sm underline">
        {tr("Back to my account", "Tillbaka till mitt konto")}
      </Link>
    </section>
  );
}
