import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Check, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { tx, useUiLang } from "@/lib/uiLang";
export type NearestStudio = {
  id: string;
  name: string;
  handle: string | null;
  city: string | null;
  address: string;
  distanceKm: number;
};

/**
 * Shown when no partner studio is within the search radius.
 * Never phrase this as "0 artists" — it reads as an empty product.
 */
export function StudioWaitlist({
  nearest,
  cities = [],
  onOpenStudio,
}: {
  nearest?: NearestStudio | null;
  cities?: string[];
  onOpenStudio?: (s: NearestStudio) => void;
}) {
  useUiLang();
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = city.trim();
    const m = email.trim();
    if (!c || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) {
      setErr(tx("Enter your city and a valid email."));
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("studio_waitlist").insert({ city: c.slice(0, 120), email: m.slice(0, 254) });
    setBusy(false);
    if (error) {
      setErr(tx("Could not save right now — please try again."));
      return;
    }
    setDone(true);
  };

  return (
    <section className="mt-4 rounded-2xl border border-white/12 bg-slate/60 p-5">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-accent" />
        <h2 className="font-display font-bold text-base">{tx("No partner studio near you yet")}</h2>
      </div>

      {nearest && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
          <div className="text-mono-caps text-[10px] text-accent">{tx("Nearest live studio")}</div>
          <div className="mt-1 text-sm font-bold">{nearest.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {nearest.city ?? nearest.address} · {Math.round(nearest.distanceKm)}{" "}{tx("km away")}
          </div>
          <button
            type="button"
            onClick={() => onOpenStudio?.(nearest)}
            className="mt-2 inline-flex h-10 items-center text-xs font-bold uppercase tracking-widest text-accent"
          >
            {tx("View studio →")}
          </button>
        </div>
      )}

      {cities.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          {tx("Live in:")}{" "}{cities.join(", ")}
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
        {tx("We're onboarding studios city by city. Leave your city and email and we'll let you know when one goes live near you.")}
      </p>

      {done ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-xs text-accent">
          <Check className="size-4" />{" "}{tx("Saved — we'll email")}{" "}{email.trim()}{" "}{tx("when a studio opens in")}{" "}{city.trim()}.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={tx("Your city")}
            aria-label={tx("Your city")}
            className="h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2 h-11 rounded-xl bg-ink border border-white/10 px-3 focus-within:border-accent">
            <Mail className="size-4 text-muted-foreground shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tx("you@email.com")}
              aria-label={tx("Your email")}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button type="submit" disabled={busy} className="h-11 rounded-xl bg-accent text-ink text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />}{" "}{tx("Notify me")}
          </button>
        </form>
      )}

      <Link to="/artists" className="mt-4 inline-flex h-11 items-center text-xs font-bold uppercase tracking-widest text-accent">
        {tx("Are you an artist? →")}
      </Link>
    </section>
  );
}
