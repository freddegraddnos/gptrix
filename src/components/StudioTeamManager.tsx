import { useState } from "react";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { useStudioTeam } from "@/hooks/useStudio";
import { uploadStudioImage, studioImageUrl } from "@/lib/studioMedia";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
const fieldCls =
  "w-full h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm outline-none focus:border-accent";

/** Lets a studio list every artist working there. */
export function StudioTeamManager({ studioId }: { studioId: string }) {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const { team, loading, add, update, remove } = useStudioTeam(studioId);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  useUnsavedChangesGuard(name !== "" || role !== "");

  const resolve = async (id: string, path: string) => {
    const url = await studioImageUrl(path);
    if (url) setAvatars((a) => ({ ...a, [id]: url }));
  };

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await add({ name: name.trim(), role: role.trim() || null });
    setName("");
    setRole("");
    setBusy(false);
  };

  const uploadAvatar = async (id: string, file: File) => {
    const path = await uploadStudioImage(studioId, file, "team");
    await update(id, { avatar_url: path });
    await resolve(id, path);
  };

  return (
    <section className="mt-5 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-2">
        <p className="text-sm font-bold">{tr("Add an artist presentation", "Lägg till en artistpresentation")}</p>
        <p className="text-[11px] text-muted-foreground">
          {tr(
            "This is shown on the public studio page. It does not create a user account or grant access.",
            "Detta visas på den offentliga studiosidan. Det skapar inget användarkonto och ger ingen åtkomst.",
          )}
        </p>
        <label className="block text-xs text-muted-foreground">
          {tr("Artist name", "Artistnamn")}
          <input className={`${fieldCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-xs text-muted-foreground">
          {tr("Public role", "Offentlig roll")}
          <input className={`${fieldCls} mt-1`} value={role} onChange={(e) => setRole(e.target.value)} placeholder={tr("For example: Resident artist", "Till exempel: Resident artist")} />
        </label>
        <Button
          onClick={() => void submit()}
          disabled={busy || !name.trim()}
          className="h-11 w-full"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {tr("Add to studio page", "Lägg till på studiosidan")}
        </Button>
        <Button type="button" variant="link" className="h-auto justify-start p-0 text-xs" onClick={() => { window.location.href = "/artists/dashboard?tab=members"; }}>
          {tr("Manage user access →", "Hantera användaråtkomst →")}
        </Button>
      </div>

      {loading && <Loader2 className="mx-auto size-5 animate-spin text-accent" />}
      {!loading && team.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {tr("No artist presentations yet.", "Inga artistpresentationer ännu.")}
        </p>
      )}

      {team.map((a) => {
        if (a.avatar_url && !avatars[a.id]) void resolve(a.id, a.avatar_url);
        return (
          <div key={a.id} className="rounded-2xl border border-white/5 bg-slate p-4 space-y-2">
            <div className="flex items-center gap-3">
              <label className="size-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-white/10 bg-ink/60 grid place-items-center">
                {avatars[a.id] ? (
                  <img src={avatars[a.id]} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="size-5 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAvatar(a.id, f);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="min-w-0 flex-1 text-[10px] text-muted-foreground">
                {tr("Artist name", "Artistnamn")}
                <input className="block w-full bg-transparent text-sm font-semibold text-foreground outline-none" value={a.name} onChange={(e) => void update(a.id, { name: e.target.value })} />
              </label>
              <button onClick={() => void remove(a.id)} aria-label={`Remove ${a.name}`}>
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
            </div>
            <label className="block text-xs text-muted-foreground">{tr("Public role", "Offentlig roll")}<input className={`${fieldCls} mt-1`} value={a.role ?? ""} onChange={(e) => void update(a.id, { role: e.target.value })} /></label>
            <label className="block text-xs text-muted-foreground">{tx("Instagram (")}{tr("optional", "valfritt")})<input className={`${fieldCls} mt-1`} value={a.instagram ?? ""} onChange={(e) => void update(a.id, { instagram: e.target.value })} /></label>
            <label className="block text-xs text-muted-foreground">{tr("Public bio and styles", "Offentlig presentation och stilar")}<textarea className="mt-1 min-h-16 w-full rounded-xl border border-white/10 bg-ink/60 p-3 text-sm text-foreground outline-none focus:border-accent" value={a.bio ?? ""} onChange={(e) => void update(a.id, { bio: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={a.active}
                onChange={(e) => void update(a.id, { active: e.target.checked })}
                className="size-4"
              />
              {tr("Show on the public studio page", "Visa på den offentliga studiosidan")}
            </label>
          </div>
        );
      })}
    </section>
  );
}
