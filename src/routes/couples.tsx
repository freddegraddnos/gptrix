/**
 * Couples — a shared profile for two people who want matching ink.
 * They pair up with an invite code and keep their matching designs in one
 * place, ready to try on in AR at the exact same size.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Camera,
  Check,
  Copy,
  HeartHandshake,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Save,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useCouple, type CoupleDesign } from "@/hooks/useCouple";
import { listMyMotifs, saveMyMotif } from "@/lib/myMotifs";
import { copyToClipboard, shareLink } from "@/lib/share";

export const Route = createFileRoute("/couples")({
  head: () => ({
    meta: [
      { title: "Couples — matching tattoos together | InkSimulator" },
      {
        name: "description",
        content:
          "Create a couple profile in InkSimulator, collect your matching tattoo designs together and try them on in AR at the exact same size.",
      },
      { property: "og:title", content: "Couples — matching tattoos together" },
      {
        property: "og:description",
        content:
          "Pair up with your partner or best friend and save your matching tattoo designs in one shared profile.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/couples" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/couples" }],
  }),
  component: CouplesRoute,
});

function CouplesRoute() {
  return (
    <RequireAuth
      title="Sign in to start a couple profile"
      description="A couple profile keeps your matching designs in one shared place."
    >
      <CouplesPage />
    </RequireAuth>
  );
}

function CouplesPage() {
  const c = useCouple();

  if (c.loading) {
    return (
      <AppShell>
        <div className="py-24 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header>
        <p className="text-mono-caps text-[10px] text-accent flex items-center gap-2">
          <HeartHandshake className="size-3.5" /> Couples
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight">
          {c.couple ? c.couple.name : "Matching ink, together"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {c.couple
            ? "Everything you both save here opens in AR at the exact same size."
            : "Create a couple profile, invite your partner or best friend, and collect your matching designs in one place."}
        </p>
      </header>

      {c.couple ? <CoupleHome /> : <CoupleSetup />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ setup */

function CoupleSetup() {
  const { createCouple, joinCouple } = useCouple();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (tab === "create") {
        await createCouple(name, displayName);
        toast.success("Couple profile created");
      } else {
        await joinCouple(code, displayName);
        toast.success("You're paired up");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate/40 p-1">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-10 rounded-xl text-[11px] font-bold uppercase tracking-widest ${
              tab === t ? "bg-accent text-ink" : "text-muted-foreground"
            }`}
          >
            {t === "create" ? "Create" : "Join with code"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {tab === "create" ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Couple name — e.g. Alex & Sam"
            maxLength={60}
            className="w-full h-12 rounded-xl border border-white/10 bg-slate/40 px-3 text-sm outline-none focus:border-accent/60"
          />
        ) : (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Invite code"
            maxLength={12}
            className="w-full h-12 rounded-xl border border-white/10 bg-slate/40 px-3 text-sm tracking-[0.3em] uppercase outline-none focus:border-accent/60"
          />
        )}
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name in the profile (optional)"
          maxLength={40}
          className="w-full h-12 rounded-xl border border-white/10 bg-slate/40 px-3 text-sm outline-none focus:border-accent/60"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || (tab === "join" && code.trim().length < 4)}
          className="w-full h-12 rounded-full bg-accent text-ink text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          {tab === "create" ? "Create couple profile" : "Join couple"}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- home */

function CoupleHome() {
  const {
    user,
    couple,
    members,
    designs,
    renameCouple,
    setDisplayName,
    leaveCouple,
    removeDesign,
  } = useCouple();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(couple?.name ?? "");
  const [draftMe, setDraftMe] = useState(
    members.find((m) => m.user_id === user?.id)?.display_name ?? "",
  );
  const [adding, setAdding] = useState(false);

  if (!couple) return null;
  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://www.inksimulator.com"}/couples/join/${couple.invite_code}`;
  const waiting = members.length < 2;

  return (
    <>
      <section className="mt-6 rounded-3xl border border-white/10 bg-slate/40 p-5">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="size-11 rounded-full bg-accent/15 border border-accent/30 grid place-items-center text-[13px] font-bold text-accent"
              >
                {(m.display_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            ))}
            {waiting && (
              <div className="size-11 rounded-full border border-dashed border-white/20 grid place-items-center text-muted-foreground">
                <Users className="size-4" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate">
              {members.map((m) => m.display_name ?? "Member").join(" & ")}
              {waiting && " — waiting for your other half"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Together since{" "}
              {new Date(couple.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="ml-auto size-9 rounded-full border border-white/10 grid place-items-center shrink-0"
            aria-label="Edit couple profile"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>

        {editing && (
          <div className="mt-4 space-y-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Couple name"
              className="w-full h-11 rounded-xl border border-white/10 bg-ink/60 px-3 text-[13px] outline-none focus:border-accent/60"
            />
            <input
              value={draftMe}
              onChange={(e) => setDraftMe(e.target.value)}
              placeholder="Your name"
              className="w-full h-11 rounded-xl border border-white/10 bg-ink/60 px-3 text-[13px] outline-none focus:border-accent/60"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await renameCouple(draftName);
                  await setDisplayName(draftMe);
                  setEditing(false);
                  toast.success("Profile updated");
                }}
                className="flex-1 h-11 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest"
              >
                Save
              </button>
              <button
                type="button"
                onClick={async () => {
                  await leaveCouple();
                  toast.success("You left the couple profile");
                }}
                className="h-11 px-4 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"
              >
                <LogOut className="size-3.5" /> Leave
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 p-3">
          <p className="text-[10px] text-mono-caps text-accent">Invite code</p>
          <p className="mt-1 font-display text-2xl tracking-[0.35em]">{couple.invite_code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void shareLink(inviteUrl, "Let's collect our matching tattoos in InkSimulator")}
              className="px-4 py-2.5 rounded-lg bg-accent text-ink text-[11px] font-bold flex items-center gap-1.5"
            >
              <Share2 className="size-3" /> Invite
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(inviteUrl);
                setCopied(ok);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-slate text-[11px] font-bold flex items-center gap-1.5"
            >
              {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Matching designs</h2>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-9 px-3 rounded-full bg-accent text-ink text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </div>

        {designs.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
            No matching designs yet. Add one from your own designs or upload a stencil — you both
            see it instantly.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {designs.map((d) => (
              <DesignCard
                key={d.id}
                design={d}
                mine={d.created_by === user?.id}
                onDelete={() => void removeDesign(d.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {adding && <AddDesignSheet onClose={() => setAdding(false)} />}
    </>
  );
}

/* ------------------------------------------------------------- design card */

function DesignCard({
  design,
  mine,
  onDelete,
}: {
  design: CoupleDesign;
  mine: boolean;
  onDelete: () => void;
}) {
  const navigate = useNavigate();

  const tryOn = () => {
    const motif = saveMyMotif({
      name: design.name,
      src: design.image_data,
      widthCm: design.width_cm ?? 8,
      source: "share",
    });
    void navigate({
      to: "/ar",
      search: {
        motif: motif.id,
        s: "1",
        ...(design.width_cm ? { w: design.width_cm.toFixed(1) } : {}),
        ...(design.rotation ? { r: String(Math.round(design.rotation)) } : {}),
      },
    });
  };

  return (
    <li className="rounded-2xl border border-white/10 bg-slate/40 p-3">
      <div className="aspect-square rounded-xl bg-artwork grid place-items-center overflow-hidden">
        <img src={design.image_data} alt={design.name} className="max-h-full object-contain p-2" />
      </div>
      <p className="mt-2 text-[12px] font-bold truncate">{design.name}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {design.width_cm ? `${design.width_cm.toFixed(1)} cm` : "Free size"}
      </p>
      {design.note && (
        <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{design.note}</p>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={tryOn}
          className="flex-1 h-9 rounded-lg bg-accent text-ink text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1"
        >
          <Camera className="size-3" /> Try
        </button>
        <button
          type="button"
          onClick={() => {
            saveMyMotif({
              name: design.name,
              src: design.image_data,
              widthCm: design.width_cm ?? 8,
              source: "share",
            });
            toast.success("Saved to your designs");
          }}
          className="size-9 rounded-lg border border-white/10 grid place-items-center"
          aria-label="Save to my designs"
        >
          <Save className="size-3.5" />
        </button>
        {mine && (
          <button
            type="button"
            onClick={onDelete}
            className="size-9 rounded-lg border border-white/10 grid place-items-center text-muted-foreground"
            aria-label="Remove design"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

/* --------------------------------------------------------------- add sheet */

function AddDesignSheet({ onClose }: { onClose: () => void }) {
  const { addDesign } = useCouple();
  const [mine] = useState(() => listMyMotifs());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const add = async (name: string, image: string, widthCm: number | null) => {
    setBusy(true);
    try {
      await addDesign({ name, image, widthCm });
      toast.success("Added to your couple profile");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the design");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => void add(file.name.replace(/\.[^.]+$/, ""), String(reader.result), 8);
    reader.onerror = () => toast.error("Could not read that image");
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-xl overflow-y-auto p-6 pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">Add a matching design</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-full border border-white/10 text-[11px] font-bold"
          >
            Close
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="mt-4 w-full h-12 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Plus className="size-4" /> Upload a picture
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />

        <p className="mt-6 text-mono-caps text-[10px] text-accent">From your designs</p>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            You have no saved designs yet — sketch, generate or upload one first.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {mine.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void add(m.name, m.src, m.widthCm)}
                  className="w-full rounded-xl border border-white/10 bg-slate/40 p-2 disabled:opacity-60"
                >
                  <div className="aspect-square grid place-items-center overflow-hidden">
                    <img src={m.src} alt={m.name} className="max-h-full object-contain" />
                  </div>
                  <span className="mt-1 block text-[10px] truncate">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {busy && (
          <p className="mt-4 text-[12px] text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </p>
        )}
      </div>
    </div>
  );
}
