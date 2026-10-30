import { IdentityPending } from "@/components/IdentityPending";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStudioAccount } from "@/hooks/useStudioAccount";
import { StudioAccountNotice } from "@/components/StudioAccountNotice";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, ScanLine, Users, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createArtistRequests } from "@/lib/projectRequests.functions";
import { MAX_MULTI_ARTISTS, clearSelectedHandles, readSelectedHandles } from "@/lib/multiRequest";

import { readRequestFiles, saveRequestFiles, clearRequestFiles, type IntakeReference } from "@/lib/requestDraftFiles";
import { validRequestFiles } from "@/lib/requestSubmission";
import { multiRequestId } from "@/lib/multiRequestIdentity";
import { isIdeaId } from "@/lib/ideaContext";

import { tx, useUiLang } from "@/lib/uiLang";
const DRAFT_KEY = "inkvision.booking-intake.multi.v1";

type Draft = {
  requestKey: string;
  attempted: boolean;
  studioHandles: string[];
  name: string;
  email: string;
  phone: string;
  placement: string;
  sizeCm: string;
  description: string;
  colorMode: "color" | "black-grey";
  sourceProjectId: string;
  scanId: string;
};

const EMPTY: Draft = {
  requestKey: "",
  attempted: false,
  studioHandles: [],
  name: "",
  email: "",
  phone: "",
  placement: "",
  sizeCm: "8",
  description: "",
  colorMode: "black-grey",
  sourceProjectId: "",
  scanId: "",
};

export const Route = createFileRoute("/boka/multi")({
  head: () => {
    const title = "Send your tattoo request to several artists — InkSimulator";
    const description =
      "Fill in your tattoo idea once and send it as a private request to up to five artists for comparison.";
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
  component: MultiRequestPage,
});

function MultiRequestPage() {
  useUiLang();
  const { user } = useAuth();
  const studioAcct = useStudioAccount();
  const navigate = useNavigate();
  const [handles, setHandles] = useState<string[]>([]);
  const [studioNames, setStudioNames] = useState<string[]>([]);
  const [form, setForm] = useState<Draft>(EMPTY);
  const [references, setReferences] = useState<IntakeReference[]>([]);
  const files = useMemo(() => references.map((item) => item.file), [references]);
  const [draftReady, setDraftReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    let active = true;
    let restored: Draft = { ...EMPTY, requestKey: crypto.randomUUID() };
    const selected = readSelectedHandles();
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) restored = { ...restored, ...(JSON.parse(saved) as Partial<Draft>) };
      if (!isIdeaId(restored.requestKey)) restored.requestKey = crypto.randomUUID();
      // A partially received group must keep its original recipients and brief.
      restored.studioHandles = restored.attempted && Array.isArray(restored.studioHandles)
        ? restored.studioHandles : selected;
      const handoff = sessionStorage.getItem("inkvision.booking-handoff");
      if (handoff && !restored.attempted) restored = { ...restored, ...(JSON.parse(handoff) as Partial<Draft>), requestKey: restored.requestKey, studioHandles: restored.studioHandles };
    } catch { setStorageError(true); }
    setForm(restored);
    setHandles(restored.studioHandles);
    void readRequestFiles(restored.requestKey).then((items) => {
      if (active) setReferences(items ?? []);
    }).catch(() => { if (active) setStorageError(true); }).finally(() => {
      if (active) setDraftReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)); }
    catch { setStorageError(true); }
  }, [draftReady, form]);
  useEffect(() => {
    if (draftReady) void saveRequestFiles(form.requestKey, references).catch(() => setStorageError(true));
  }, [draftReady, form.requestKey, references]);

  useEffect(() => {
    if (!handles.length) return;
    let cancelled = false;
    void (async () => {
      const names: string[] = [];
      for (const handle of handles) {
        const { data } = await supabase.rpc("public_artist_page", { _handle: handle });
        const studio = data as unknown as { studio_name?: string } | null;
        names.push(studio?.studio_name ?? handle);
      }
      if (!cancelled) setStudioNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [handles]);

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
    if (!handles.length) { setError(tx("Pick at least one artist first.")); return; }
    if (!validRequestFiles(files)) { setError(tx("Each reference must be an image or PDF under 15 MB.")); return; }
    if (!files.some((file) => file.type.startsWith("image/")) && !form.sourceProjectId) {
      setError(tx("Add at least one customer or reference image.")); return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      await saveRequestFiles(form.requestKey, references);
      if (!user) {
        await navigate({ to: "/auth", search: { redirect: "/boka/multi" } });
        return;
      }
      // Some recipients may receive their case before another recipient fails.
      // Freeze this group before the call; retries never change sent snapshots.
      const attempted = { ...form, attempted: true, studioHandles: handles };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(attempted));
      setForm(attempted);
      const { projects } = await createArtistRequests({
        data: {
          studioHandles: handles.slice(0, MAX_MULTI_ARTISTS),
          requestKey: form.requestKey,
          name: form.name,
          email: form.email,
          phone: form.phone,
          placement: form.placement,
          sizeCm: Number(form.sizeCm),
          description: form.description,
          colorMode: form.colorMode,
          sourceProjectId: form.sourceProjectId || null,
          scanId: form.scanId || null,
        },
      });
      // studio_request_submitted — request sent to several studios at once
      void import("@/lib/track").then((t) =>
        t.track("studio_request_submitted", { studios: projects.length }),
      );

      for (const project of projects) {
        for (const reference of references) {
          const file = reference.file;
          const attachmentId = await multiRequestId(project.id, `reference:${reference.id}`);
          const { data: existing, error: readError } = await supabase.from("artist_project_attachments")
            .select("id").eq("id", attachmentId).eq("project_id", project.id).maybeSingle();
          if (readError) throw readError;
          if (existing) continue;
          const path = `project/${project.id}/${attachmentId}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
          const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
          if (uploadError && String(uploadError.statusCode) !== "409") throw uploadError;
          const { error: rowError } = await supabase.from("artist_project_attachments").insert({
            id: attachmentId, project_id: project.id, uploaded_by: user.id, kind: "reference", file_name: file.name,
            storage_path: path, mime_type: file.type, size_bytes: file.size,
          });
          if (rowError) {
            if (rowError.code !== "23505") throw rowError;
            const { data: duplicate, error: duplicateError } = await supabase.from("artist_project_attachments")
              .select("id").eq("id", attachmentId).eq("project_id", project.id).eq("uploaded_by", user.id).maybeSingle();
            if (duplicateError || !duplicate) throw duplicateError ?? rowError;
          }
        }
      }

      try {
        await clearRequestFiles(form.requestKey);
        sessionStorage.removeItem(DRAFT_KEY);
        sessionStorage.removeItem("inkvision.booking-handoff");
      } catch { /* Server receipt is complete; local cleanup must not report failed delivery. */ }
      clearSelectedHandles();
      if (projects.length === 1) navigate({ to: "/requests/$id", params: { id: projects[0]!.id } });
      else navigate({ to: "/requests" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your request.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };

  if (!handles.length)
    return (
      <AppShell>
        <div className="py-20 text-center">
          <h1 className="text-2xl font-bold">{tx("No artists selected")}</h1>
          <Link to="/studios" className="mt-4 inline-block text-accent">
            {tx("Find your tattoo artist")}
          </Link>
        </div>
      </AppShell>
    );

  return (
    <AppShell showNav={false}>
      <header className="mb-6 border-b border-border pb-5">
        <p className="text-mono-caps text-[10px] text-accent">{tx("Tattoo request")}</p>
        <h1 className="text-2xl font-display font-bold">
          {tx("Send to")}{" "}{handles.length} artist{handles.length > 1 ? "s" : ""}
        </h1>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" />
          {(studioNames.length ? studioNames : handles).join(" · ")}
        </p>
      </header>
      {studioAcct.loading ? <IdentityPending /> : studioAcct.isStudio ? <StudioAccountNotice studioName={studioAcct.studioName} /> :
      <form onSubmit={submit} className="space-y-5">
        {storageError && <p role="alert" className="text-sm text-destructive">{tx("This browser could not retain the draft. Keep this page open and try again before signing in.")}</p>}
        {form.attempted && <p role="status" className="text-sm text-muted-foreground">{tx("Some artists may already have received this request. Retry continues the same requests and references; the original brief and recipients stay unchanged.")}</p>}
        <fieldset disabled={busy || form.attempted} className="space-y-5 min-w-0 border-0 p-0">
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label={tx("Name")}>
            <input
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="field"
            />
          </Field>
          <Field label={tx("Email")}>
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
              className="field"
            />
          </Field>
          <Field label={tx("Phone")}>
            <input
              required
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              className="field"
            />
          </Field>
          <Field label={tx("Desired placement")}>
            <input
              required
              placeholder={tx("Forearm, shoulder…")}
              value={form.placement}
              onChange={(e) => patch({ placement: e.target.value })}
              className="field"
            />
          </Field>
          <Field label={tx("Size (cm)")}>
            <input
              required
              type="number"
              min="1"
              max="100"
              value={form.sizeCm}
              onChange={(e) => patch({ sizeCm: e.target.value })}
              className="field"
            />
          </Field>
          <Field label={tx("Ink")}>
            <select
              value={form.colorMode}
              onChange={(e) => patch({ colorMode: e.target.value as Draft["colorMode"] })}
              className="field"
            >
              <option value="black-grey">{tx("Black & grey")}</option>
              <option value="color">{tx("Color")}</option>
            </select>
          </Field>
        </section>
        <Field label={tx("Tell the artists about your idea")}>
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder={tx("Style, details, timing and anything the artist should know…")}
            className="field h-auto py-3"
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
            {tx("Customer or reference image *")}
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {previews.map(({ file, url }, index) => (
              <div key={`${file.name}-${index}`} className="relative size-20 shrink-0">
                <img
                  src={url}
                  alt={tx("Reference preview")}
                  className="size-full rounded-md object-cover"
                />
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
                    ...Array.from(e.target.files ?? []).slice(0, 8 - current.length).map(file => ({ id: crypto.randomUUID(), file })),
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
        <p className="text-center text-[11px] text-muted-foreground">
          {tx("Each artist gets their own private request. They are told you are comparing a few artists, but never which ones.")}
        </p>
        <Button type="submit" size="lg" disabled={busy || !draftReady} className="h-13 w-full text-sm font-bold">
          {busy ? <Loader2 className="animate-spin" /> : null}
          {form.attempted ? tx("Retry pending requests") : user
            ? (handles.length > 1 ? tx("Send to {n} artists", { n: handles.length }) : tx("Send to 1 artist"))
            : tx("Sign in and send request")}
        </Button>
      </form>}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-mono-caps text-[10px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
