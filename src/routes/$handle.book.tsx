import { IdentityPending } from "@/components/IdentityPending";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useStudioAccount } from "@/hooks/useStudioAccount";
import { StudioAccountNotice } from "@/components/StudioAccountNotice";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, Loader2, MapPin, ScanLine, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMotif } from "@/hooks/useMarketplace";
import { clearMotifRequestContext } from "@/lib/motifRequestContext";
import { AVAILABILITY_LABELS, REUSE_LABELS } from "@/lib/tattooOffer";
import { validRequestFiles } from "@/lib/requestSubmission";
import { readRequestFiles, saveRequestFiles, clearRequestFiles, type IntakeReference } from "@/lib/requestDraftFiles";
import { createArtistRequest } from "@/lib/projectRequests.functions";

import { tx, useUiLang } from "@/lib/uiLang";
import { useIdea } from "@/hooks/useIdea";
import { IdeaBar } from "@/components/IdeaBar";
import {
  getActiveIdea,
  isIdeaId,
  placementFromIdea,
  setActiveIdea,
  sharedItems,
  sizeAndPlacementValid,
  sizeFieldFromIdea,
  SIZE_DIMENSIONS,
  SIZE_SOURCES,
  type SizeDimension,
  type SizeSource,
} from "@/lib/ideaContext";
const DRAFT_KEY = "inkvision.booking-intake.v1";

type Studio = {
  user_id: string;
  handle: string;
  studio_name: string;
  city: string | null;
  avatar_url: string | null;
};
type Draft = {
  receivedRequestId: string;
  requestKey: string;
  sourceMotifId: string;
  name: string;
  email: string;
  phone: string;
  placement: string;
  sizeCm: string;
  description: string;
  colorMode: "color" | "black-grey";
  sourceProjectId: string;
  scanId: string;
  sizeDimension: SizeDimension | "";
  sizeSource: SizeSource | "";
  sizeUnsure: boolean;
  placementUnsure: boolean;
};
const EMPTY: Draft = {
  receivedRequestId: "",
  requestKey: "",
  sourceMotifId: "",
  name: "",
  email: "",
  phone: "",
  placement: "",
  sizeCm: "",
  description: "",
  colorMode: "black-grey",
  sourceProjectId: "",
  scanId: "",
  sizeDimension: "",
  sizeSource: "",
  sizeUnsure: false,
  placementUnsure: false,
};

export const Route = createFileRoute("/$handle/book")({
  validateSearch: (s: Record<string, unknown>): { idea?: string; motif?: string } => ({
    ...(isIdeaId(s.idea) ? { idea: s.idea } : {}),
    ...(isIdeaId(s.motif) ? { motif: s.motif } : {}),
  }),
  loader: async ({ params }) => {
    let studio: Studio | null = null;
    try {
      const { data, error } = await supabase.rpc("public_artist_page", { _handle: params.handle });
      if (!error) studio = (data ?? null) as Studio | null;
    } catch {
      /* fall through */
    }
    if (!studio) {
      // Studio renamed its address: forward old links.
      const { data: moved } = await supabase.rpc("resolve_studio_handle", {
        _handle: params.handle,
      });
      if (moved)
        throw redirect({ to: "/$handle/book", params: { handle: moved }, statusCode: 301 });
    }
    return { studio };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.studio?.studio_name ?? params.handle;
    const title = `Book ${name} — InkSimulator`;
    const description = `Send your tattoo idea, references, placement and size directly to ${name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: StudioBookingPage,
});

function StudioBookingPage() {
  useUiLang();
  const { handle } = Route.useParams();
  const { studio } = Route.useLoaderData();
  const { user } = useAuth();
  const studioAcct = useStudioAccount();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [form, setForm] = useState<Draft>(EMPTY);
  const [ideaId, setIdeaId] = useState<string | null>(null);
  useEffect(() => {
    const id = search.idea ?? (search.motif ? null : getActiveIdea());
    if (search.idea) setActiveIdea(search.idea);
    setIdeaId(id);
  }, [search.idea, search.motif]);
  const { idea } = useIdea(ideaId, user?.id);
  const [appliedIdea, setAppliedIdea] = useState<string | null>(null);
  // Copy the saved idea into the form once; its measurement is kept exactly.
  useEffect(() => {
    if (!idea || appliedIdea === idea.id) return;
    setAppliedIdea(idea.id);
    setForm((c) => ({
      ...c,
      sourceProjectId: idea.id,
      sizeCm: sizeFieldFromIdea(idea.widthCm) || c.sizeCm,
      sizeDimension: idea.sizeDimension ?? c.sizeDimension,
      sizeSource: idea.widthCm != null ? (idea.sizeSource ?? c.sizeSource) : c.sizeSource,
      sizeUnsure: idea.sizeUnsure,
      placement: placementFromIdea(idea) || c.placement,
      placementUnsure: idea.placementUnsure,
    }));
  }, [idea, appliedIdea]);
  const unlinkIdea = () => {
    setActiveIdea(null);
    setIdeaId(null);
    setAppliedIdea(null);
    setForm((c) => ({ ...c, sourceProjectId: "" }));
  };
  const [references, setReferences] = useState<IntakeReference[]>([]);
  const files = useMemo(() => references.map((item) => item.file), [references]);
  const [draftReady, setDraftReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const submitting = useRef(false);
  const sourceMotifId = search.motif ?? form.sourceMotifId;
  const { motif, loading: motifLoading } = useMotif(sourceMotifId || undefined, user?.id);
  const correctMotif = !!motif && motif.artist_id === studio?.user_id;
  const appliedMotif = useRef<string | null>(null);
  useEffect(() => {
    if (!draftReady || !correctMotif || !motif || appliedMotif.current === motif.id) return;
    appliedMotif.current = motif.id;
    setForm((current) => ({ ...current,
      description: current.description || tx("I'd like to ask about this design."),
      sizeUnsure: current.sizeCm ? current.sizeUnsure : true,
      placementUnsure: current.placement ? current.placementUnsure : true,
    }));
  }, [draftReady, correctMotif, motif]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    let active = true;
    setDraftReady(false);
    let restored: Draft = { ...EMPTY, requestKey: crypto.randomUUID() };
    try {
      const saved = sessionStorage.getItem(`${DRAFT_KEY}:${handle}`);
      if (saved) restored = { ...restored, ...(JSON.parse(saved) as Partial<Draft>) };
      if (!isIdeaId(restored.requestKey)) restored.requestKey = crypto.randomUUID();
      const handoff = sessionStorage.getItem("inkvision.booking-handoff");
      if (handoff && (search.idea || !search.motif)) restored = { ...restored, ...(JSON.parse(handoff) as Partial<Draft>), requestKey: restored.requestKey };
      // Starting a different motif must never reuse a previously submitted request key.
      if (search.motif && (restored.sourceMotifId || restored.receivedRequestId) && restored.sourceMotifId !== search.motif)
        restored = { ...EMPTY, requestKey: crypto.randomUUID() };
      restored.sourceMotifId = search.motif ?? restored.sourceMotifId ?? "";
    } catch { setStorageError(true); }
    setForm(restored);
    setReceivedId(isIdeaId(restored.receivedRequestId) ? restored.receivedRequestId : null);
    void readRequestFiles(restored.requestKey).then((items) => {
      if (active) setReferences(items ?? []);
    }).catch(() => { if (active) setStorageError(true); }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [handle, search.motif, search.idea, studio?.user_id]);
  useEffect(() => {
    if (!draftReady) return;
    try { sessionStorage.setItem(`${DRAFT_KEY}:${handle}`, JSON.stringify(form)); }
    catch { setStorageError(true); }
  }, [draftReady, form, handle]);
  useEffect(() => {
    if (draftReady) void saveRequestFiles(form.requestKey, references).catch(() => setStorageError(true));
  }, [draftReady, form.requestKey, references]);
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      name: current.name || String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
      email: current.email || user.email || "",
      phone: current.phone || String(user.phone ?? ""),
    }));
  }, [user]);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  const patch = (values: Partial<Draft>) => setForm((current) => ({ ...current, ...values }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || !draftReady) return;
    setError(null);
    if (!validRequestFiles(files)) { setError(tx("Each reference must be an image or PDF under 15 MB.")); return; }
    if (sourceMotifId && !correctMotif && !receivedId) { setError(tx("This design is not available from the selected studio.")); return; }
    if (!sizeAndPlacementValid(form)) {
      setError(tx("Enter size and placement, or tick \"I'm not sure\".")); return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      // Do not leave this page for auth if its files could not be retained.
      sessionStorage.setItem(`${DRAFT_KEY}:${handle}`, JSON.stringify(form));
      if (references.length) await saveRequestFiles(form.requestKey, references);
      if (!user) {
        const query = new URLSearchParams();
        if (ideaId) query.set("idea", ideaId);
        if (sourceMotifId) query.set("motif", sourceMotifId);
        await navigate({ to: "/auth", search: { redirect: `/${handle}/book${query.size ? `?${query}` : ""}` } });
        return;
      }
      const created = await createArtistRequest({ data: {
        studioHandle: handle, requestKey: form.requestKey, sourceMotifId: sourceMotifId || null,
        name: form.name, email: form.email, phone: form.phone, placement: form.placement.trim(),
        sizeCm: form.sizeCm ? Number(form.sizeCm) : null, sizeDimension: form.sizeDimension || null,
        sizeSource: form.sizeCm ? form.sizeSource || "manual" : null, sizeUnsure: form.sizeUnsure,
        placementUnsure: form.placementUnsure, description: form.description, colorMode: form.colorMode,
        sourceProjectId: form.sourceProjectId || null, scanId: form.scanId || null,
      } });
      setReceivedId(created.id);
      const receivedDraft = { ...form, receivedRequestId: created.id };
      setForm(receivedDraft);
      sessionStorage.setItem(`${DRAFT_KEY}:${handle}`, JSON.stringify(receivedDraft));
      // Retry the same attachment IDs and request UUID; never create a second request.
      const uploaded = [...references];
      for (let index = 0; index < uploaded.length; index++) {
        const reference = uploaded[index];
        if (reference.uploaded) continue;
        const file = reference.file;
        const { data: existing, error: readError } = await supabase.from("artist_project_attachments")
          .select("id").eq("id", reference.id).eq("project_id", created.id).maybeSingle();
        if (readError) throw readError;
        if (!existing) {
          const path = `project/${created.id}/${reference.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
          const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
          if (uploadError && String(uploadError.statusCode) !== "409") throw uploadError;
          const { error: rowError } = await supabase.from("artist_project_attachments").insert({
            id: reference.id, project_id: created.id, uploaded_by: user.id, kind: "reference", file_name: file.name,
            storage_path: path, mime_type: file.type, size_bytes: file.size,
          });
          if (rowError) {
            if (rowError.code !== "23505") throw rowError;
            const { data: duplicate, error: duplicateError } = await supabase.from("artist_project_attachments")
              .select("id").eq("id", reference.id).eq("project_id", created.id).eq("uploaded_by", user.id).maybeSingle();
            if (duplicateError || !duplicate) throw duplicateError ?? rowError;
          }
        }
        uploaded[index] = { ...reference, uploaded: true };
        setReferences([...uploaded]);
        await saveRequestFiles(form.requestKey, uploaded);
      }
      void import("@/lib/track").then((t) => t.track("studio_request_submitted", { studios: 1 }));
      // The request and its references are received. Local cleanup failure must
      // not disable the form or present the completed submission as a failure.
      try {
        await clearRequestFiles(form.requestKey);
        sessionStorage.removeItem(`${DRAFT_KEY}:${handle}`);
        sessionStorage.removeItem("inkvision.booking-handoff");
      } catch { /* Keep the same received request key for a safe retry. */ }
      clearMotifRequestContext();
      await navigate({ to: "/requests/$id", params: { id: created.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tx("Could not send your request."));
    } finally { setBusy(false); submitting.current = false; }
  };

  if (!studio)
    return (
      <AppShell>
        <div className="py-20 text-center">
          <h1 className="text-2xl font-bold">{tx("Studio not found")}</h1>
          <Link to="/artists/search" className="mt-4 inline-block text-accent">
            {tx("Find a studio")}
          </Link>
        </div>
      </AppShell>
    );
  return (
    <AppShell showNav={false}>
      <header className="mb-6 border-b border-border pb-5">
        <Link to="/$handle" params={{ handle }} className="btn-link mb-4 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />{" "}{tx("Back to")}{" "}{studio.studio_name}
        </Link>
        <div className="flex items-center gap-3">
          {studio.avatar_url ? (
            <img src={studio.avatar_url} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div className="grid size-14 place-items-center rounded-full bg-secondary text-xl font-bold text-accent">
              {studio.studio_name[0]}
            </div>
          )}
          <div>
            <p className="text-mono-caps text-[10px] text-accent">{tx("Tattoo request")}</p>
            <h1 className="heading-tool">{studio.studio_name}</h1>
            {studio.city && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {studio.city}
              </p>
            )}
          </div>
        </div>
      </header>
      {studioAcct.loading ? <IdentityPending /> : studioAcct.isStudio ? <StudioAccountNotice studioName={studioAcct.studioName} /> :
      <form onSubmit={submit} className="space-y-5">
        {sourceMotifId && !receivedId && <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-bold">{tx("Selected design")}</h2>
          {motifLoading ? <p>{tx("Loading…")}</p> : correctMotif && motif ? <>
            {motif.image_url && <img src={motif.image_url} alt={motif.name} className="mt-2 h-32 w-32 rounded-md bg-artwork object-contain" />}
            <p className="mt-2">{motif.name} · {studio.studio_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tx("An enquiry does not reserve the design or confirm a booking.")}</p>
            {motif.usage_terms && <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{tx("Usage terms from the studio")}: {motif.usage_terms}</p>}
            {motif.tattoo_availability && <dl className="mt-3 space-y-1 text-sm">
              <div><dt className="inline text-muted-foreground">{tx("Availability")}: </dt><dd className="inline">{tx(AVAILABILITY_LABELS[motif.tattoo_availability])}</dd></div>
              {motif.tattoo_reuse && <div><dt className="inline text-muted-foreground">{tx("Repeatability")}: </dt><dd className="inline">{tx(REUSE_LABELS[motif.tattoo_reuse])}</dd></div>}
              {motif.suggested_size_cm && <div><dt className="inline text-muted-foreground">{tx("Suggested size")}: </dt><dd className="inline">{motif.suggested_size_cm} cm</dd></div>}
              {motif.tattoo_price_note && <div><dt className="inline text-muted-foreground">{tx("Tattoo price indication")}: </dt><dd className="inline">{motif.tattoo_price_note}</dd></div>}
            </dl>}

          </> : <p role="alert">{tx("This design is not available from the selected studio.")}</p>}
        </section>}
        {storageError && <p role="status" className="text-sm text-destructive">{tx("This browser could not retain the draft. Keep this page open and try again before signing in.")}</p>}
        {receivedId && <div role="status" className="rounded-lg border border-accent p-4">
          <p>{tx("Your request was received. Some references may still need uploading. Retrying will update the same request.")}</p>
          <Link to="/requests/$id" params={{ id: receivedId }} className="underline">{tx("Open received request")}</Link>
        </div>}
        <fieldset disabled={busy || !!receivedId} className="space-y-5 border-0 p-0 min-w-0">
        {idea && <IdeaBar idea={idea} onClear={unlinkIdea} />}
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label={tx("Name")}>
            <input
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="field-input"
            />
          </Field>
          <Field label={tx("Email")}>
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
              className="field-input"
            />
          </Field>
          <Field label={tx("Phone (optional)")}>
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              className="field-input"
            />
          </Field>
          <Field label={tx("Desired placement")}>
            <input
              required={!form.placementUnsure}
              placeholder={tx("Forearm, shoulder…")}
              value={form.placement}
              onChange={(e) => patch({ placement: e.target.value })}
              className="field-input"
            />
            <Unsure checked={form.placementUnsure} onChange={(v) => patch({ placementUnsure: v })} />
          </Field>
          <Field label={tx("Size (cm)")}>
            <input
              required={!form.sizeUnsure}
              type="number"
              min="0.5"
              max="100"
              step="0.1"
              value={form.sizeCm}
              onChange={(e) => patch({ sizeCm: e.target.value, sizeSource: e.target.value !== sizeFieldFromIdea(idea?.widthCm) ? "manual" : (idea?.sizeSource ?? "manual") })}
              className="field-input"
            />
            <Unsure checked={form.sizeUnsure} onChange={(v) => patch({ sizeUnsure: v })} />
          </Field>
          <Field label={tx("Size refers to")}>
            <select
              value={form.sizeDimension}
              onChange={(e) => patch({ sizeDimension: e.target.value as Draft["sizeDimension"] })}
              className="field-input"
            >
              <option value="">{tx("Not specified")}</option>
              {SIZE_DIMENSIONS.map((d) => <option key={d.value} value={d.value}>{tx(d.label)}</option>)}
            </select>
            {form.sizeCm && (
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {tx("Source")}: {tx(SIZE_SOURCES.find((x) => x.value === (form.sizeSource || "manual"))?.label ?? "Entered manually")}
              </span>
            )}
          </Field>
          <Field label={tx("Ink")}>
            <select
              value={form.colorMode}
              onChange={(e) => patch({ colorMode: e.target.value as Draft["colorMode"] })}
              className="field-input"
            >
              <option value="black-grey">{tx("Black & grey")}</option>
              <option value="color">{tx("Color")}</option>
            </select>
          </Field>
        </section>
        <Field label={tx("Tell the artist about your idea")}>
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder={tx("Style, details, timing and anything the artist should know…")}
            className="field-input h-auto py-3"
          />
        </Field>
        {(form.sourceProjectId || form.scanId) && (
          <div className="flex flex-wrap gap-2">
            {form.sourceProjectId && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">
                <Check className="size-3" />{" "}{tx("AR design attached")}
              </span>
            )}
            {form.scanId && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">
                <ScanLine className="size-3" />{" "}{tx("3D scan attached")}
              </span>
            )}
          </div>
        )}
        <section>
          <p className="text-mono-caps text-[10px] text-muted-foreground">
            {tx("Reference images (optional)")}
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {previews.map(({ file, url }, index) => (
              <div key={`${file.name}-${index}`} className="relative size-20 shrink-0">
                {file.type === "application/pdf" ? <span className="flex size-full items-center break-all rounded-md bg-secondary p-2 text-xs">{file.name}</span> : <img src={url} alt={tx("Reference preview")} className="size-full rounded-md object-cover" />}
                <button
                  type="button"
                  aria-label={tx("Remove image")}
                  onClick={() => setReferences((current) => current.filter((_, i) => i !== index))}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/80"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            <label className="grid size-20 shrink-0 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-secondary">
              <ImagePlus className="size-5 text-accent" />
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={(e) =>
                  setReferences((current) => [
                    ...current,
                    ...Array.from(e.target.files ?? []).slice(0, 8 - current.length).map((file) => ({ id: crypto.randomUUID(), file })),
                  ])
                }
              />
            </label>
          </div>
        </section>
        </fieldset>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {!receivedId && <section aria-labelledby="share-review" className="rounded-lg border border-border bg-card p-4">
          <h2 id="share-review" className="text-mono-caps text-[11px] text-accent">{tx("Shared with the studio")}: {studio.studio_name}</h2>
          <dl className="mt-2 grid gap-1.5 text-sm">
            {sharedItems({
              motif: (correctMotif ? motif?.name : null) ?? idea?.tattooName ?? idea?.name ?? null,
              sizeCm: form.sizeCm,
              sizeDimension: form.sizeDimension || null,
              sizeSource: form.sizeCm ? form.sizeSource || "manual" : null,
              sizeUnsure: form.sizeUnsure,
              placement: form.placement,
              placementUnsure: form.placementUnsure,
              referenceCount: idea?.referenceUrls.length ?? 0,
              uploadCount: files.length,
              hasIdeaPhoto: !!idea?.previewUrl,
              description: form.description,
            }, tx).map((it) => (
              <div key={it.key} className="grid grid-cols-[7.5rem_1fr] gap-2">
                <dt className="text-muted-foreground">{it.label}</dt>
                <dd className="break-words">{it.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">{tx("Nothing is sent until you press the button below.")}</p>
        </section>}
        <button type="submit" disabled={busy || !draftReady || (!!sourceMotifId && !correctMotif && !receivedId)} className="btn-primary w-full">
          {busy ? <Loader2 className="animate-spin" /> : null}
          {receivedId ? tx("Retry remaining uploads") : user ? tx("Send tattoo request") : tx("Sign in to review request")}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          {tx("Your request is private and visible only to you and the studio.")}
        </p>
      </form>}
    </AppShell>
  );
}

function Unsure({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="mt-1.5 flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5" />
      {tx("I'm not sure")}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
