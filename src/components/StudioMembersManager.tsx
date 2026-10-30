import { useState } from "react";
import { Copy, Loader2, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { useStudioMembers, type StudioMember } from "@/hooks/useStudio";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
const SITE = typeof window !== "undefined" ? window.location.origin : "https://www.inksimulator.com";

/** Invite colleagues to the studio account and control their role. */
export function StudioMembersManager({ studioId }: { studioId: string }) {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const { members, loading, invite, setRole, revoke } = useStudioMembers(studioId);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRoleValue] = useState<"admin" | "artist">("artist");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.error(tx("Enter a valid e-mail address."));
      return;
    }
    setBusy(true);
    try {
      const row = await invite({ email, role, display_name: name });
      setEmail("");
      setName("");
      if (row) {
        const link = `${SITE}/studio/invite/${row.invite_token}`;
        await navigator.clipboard?.writeText(link).catch(() => undefined);
        toast.success(tx("Invite created — link copied to your clipboard."));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create the invite.";
      toast.error(/duplicate/i.test(msg) ? "That e-mail is already invited." : msg);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (m: StudioMember) => {
    await navigator.clipboard?.writeText(`${SITE}/studio/invite/${m.invite_token}`);
    toast.success(tx("Invite link copied."));
  };

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-3">
        <h3 className="text-mono-caps text-[10px] text-muted-foreground">{tr("Invite a user", "Bjud in en användare")}</h3>
        <p className="text-[11px] text-muted-foreground">{tr("An invitation grants account access. It does not automatically create or link a public artist presentation.", "En inbjudan ger kontoåtkomst. Den skapar eller kopplar inte automatiskt en offentlig artistpresentation.")}</p>
        <label className="block text-xs text-muted-foreground">{tr("Display name (optional)", "Visningsnamn (valfritt)")}<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-ink px-3 text-sm text-foreground outline-none focus:border-accent" /></label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block text-xs text-muted-foreground">{tr("Email", "E-post")}<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-ink px-3 text-sm text-foreground outline-none focus:border-accent" /></label>
          <label className="block text-xs text-muted-foreground">{tr("Access role", "Åtkomstroll")}
          <select
            value={role}
            onChange={(e) => setRoleValue(e.target.value as "admin" | "artist")}
            className="mt-1 h-11 rounded-xl border border-white/10 bg-ink px-3 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="artist">{tx("Artist")}</option>
            <option value="admin">{tx("Admin")}</option>
          </select>
          </label>
        </div>
        <Button
          onClick={submit}
          disabled={busy}
          className="h-12 w-full"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {tr("Create invite link", "Skapa inbjudningslänk")}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          {tr("Admins can manage studio settings. The artist role has more limited access. Public visibility is managed separately under Artists on the studio page.", "Administratörer kan hantera studioinställningar. Artistrollen har mer begränsad åtkomst. Offentlig synlighet hanteras separat under Artister på studiosidan.")}
        </p>
        <Button type="button" variant="link" className="h-auto justify-start p-0 text-xs" onClick={() => { window.location.href = "/artists/dashboard?tab=team"; }}>{tr("Manage public artist presentations →", "Hantera offentliga artistpresentationer →")}</Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate p-4">
        <h3 className="text-mono-caps mb-3 text-[10px] text-muted-foreground">{tr("Team and access", "Team och åtkomst")}</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">{tr("Loading…", "Laddar…")}</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">{tr("No invited users yet.", "Inga inbjudna användare ännu.")}</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{m.display_name ?? m.email}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                     {m.email} · {m.status === "active" ? tr("Active", "Aktiv") : tr("Invited", "Inbjuden")}
                  </div>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => setRole(m.id, e.target.value as "admin" | "artist")}
                  aria-label={tx("Role for {email}", { email: m.email })}
                  className="h-9 rounded-lg bg-slate border border-white/10 px-2 text-[11px] outline-none focus:border-accent"
                >
                  <option value="artist">{tx("Artist")}</option>
                  <option value="admin">{tx("Admin")}</option>
                </select>
                {m.status !== "active" && (
                  <button
                    onClick={() => copyLink(m)}
                    aria-label={tx("Copy invite link")}
                    className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-accent"
                  >
                    <Copy className="size-4" />
                  </button>
                )}
                {m.status === "active" && (
                  <ShieldCheck className="size-4 text-accent" aria-hidden />
                )}
                <button
                  onClick={() => revoke(m.id)}
                  aria-label={`Remove ${m.email}`}
                  className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
