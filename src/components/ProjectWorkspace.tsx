import { SIZE_DIMENSIONS, SIZE_SOURCES } from "@/lib/ideaContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Calendar, FileText, ImagePlus, Loader2, Lock, MessageCircle, Paperclip, Save, Send, StickyNote, UserRound } from "lucide-react";
import { bookingStatus, designStatus, paymentStatus, studioAction, waitingOn } from "@/lib/caseAction";
import { buildCaseFacts } from "@/hooks/useArtistRequests";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StudioButton } from "@/components/StudioPrimitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { loadProjectWorkspace, uploadProjectAttachment, type ArtistRequest, type ProjectAttachment, type ProjectDeposit, type ProjectMessage, type ProjectNote } from "@/hooks/useArtistRequests";
import { supabase } from "@/integrations/supabase/client";
import { confirmArtistProjectAppointment, notifyArtistProjectMessage, updateArtistProjectStatus } from "@/lib/projectRequests.functions";
import { renameProjectConversation } from "@/lib/studioClients.functions";
import { SketchesTab } from "@/components/SketchesTab";
import { DepositSection } from "@/components/DepositSection";
import { ProjectSessionPicker } from "@/components/ProjectSessionPicker";
import { AgeVerificationCard } from "@/components/AgeVerificationCard";

import { tx, useUiLang } from "@/lib/uiLang";
import { freshReferenceUrls } from "@/lib/referenceImages.functions";
type ArtistOption = { id: string; name: string };
type ProjectSession = { id: string; status: string; preferred_date: string; preferred_time: string | null; session_number: number };

export function ProjectWorkspace({ projectId, artistMode }: { projectId: string; artistMode: boolean }) {
  useUiLang();
  const WorkspaceButton = artistMode ? StudioButton : Button;
  const { user } = useAuth();
  const [project, setProject] = useState<ArtistRequest | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [sketches, setSketches] = useState<Awaited<ReturnType<typeof loadProjectWorkspace>>["sketches"]>([]);
  const [sketchAnnotations, setSketchAnnotations] = useState<Awaited<ReturnType<typeof loadProjectWorkspace>>["sketchAnnotations"]>([]);
  const [deposit, setDeposit] = useState<ProjectDeposit | null>(null);
  const [finalPayment, setFinalPayment] = useState<ProjectDeposit | null>(null);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [booking, setBooking] = useState<{ id: string; status: string; preferred_date: string; preferred_time: string | null } | null>(null);
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Reference links are re-signed on every open so they never expire for either party.
  const [freshRefs, setFreshRefs] = useState<string[] | null>(null);
  const refCount = project?.reference_urls?.length ?? 0;
  useEffect(() => {
    if (!refCount) return;
    let live = true;
    void freshReferenceUrls({ data: { projectId } }).then((r) => { if (live) setFreshRefs(r.urls); }).catch(() => undefined);
    return () => { live = false; };
  }, [projectId, refCount]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const messageEnd = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("conversation");

  // A booking link from e-mail opens the Sessions tab straight away.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted) setTab(wanted);
  }, []);


  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const workspace = await loadProjectWorkspace(projectId, artistMode);
      setProject(workspace.project);
      setMessages(workspace.messages);
      setAttachments(workspace.attachments);
      setNotes(workspace.notes);
      setBooking(workspace.booking);
      setSketches(workspace.sketches);
      setSketchAnnotations(workspace.sketchAnnotations);
      setDeposit(workspace.deposit);
      setFinalPayment(workspace.finalPayment);
      const { data: sessionRows, error: sessionError } = await supabase
        .from("bookings")
        .select("id,status,preferred_date,preferred_time,session_number")
        .eq("artist_project_id", projectId)
        .order("session_number");
      if (sessionError) throw sessionError;
      setSessions((sessionRows ?? []) as ProjectSession[]);
      if (workspace.project && artistMode && workspace.project.artist_id) {
        // Opening the case marks it read for the studio; it does not change "needs action".
        void supabase.from("artist_client_projects").update({ studio_read_at: new Date().toISOString() }).eq("id", projectId).then(() => undefined);
      }
      if (workspace.project) {
        setQuoteAmount(workspace.project.quote_amount_ore ? String(workspace.project.quote_amount_ore / 100) : "");
        setQuoteMessage(workspace.project.quote_message ?? "");
        setConversationTitle(workspace.project.conversation_title ?? "");
      }
      if (artistMode) {
        const { data, error } = await supabase.from("studio_artists").select("id,name").eq("active", true).order("sort_order");
        if (error) throw error;
        setArtists((data ?? []) as ArtistOption[]);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, artistMode]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const channel = supabase.channel(`artist-project-${projectId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "artist_project_messages", filter: `project_id=eq.${projectId}` }, () => void refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [projectId, refresh]);
  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const sendMessage = async () => {
    if (!user || !message.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("artist_project_messages").insert({ project_id: projectId, sender_id: user.id, body: message.trim() }).select("id").single();
      if (error) throw error;
      setMessage("");
      await refresh();
      void notifyArtistProjectMessage({ data: { projectId, messageId: data.id } }).catch(() => undefined);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not send message"); }
    finally { setSaving(false); }
  };

  const attach = async (file: File | undefined) => {
    if (!file || !user) return;
    setSaving(true);
    try { await uploadProjectAttachment(projectId, user.id, file); await refresh(); }
    catch { toast.error(tx("Could not upload the file")); }
    finally { setSaving(false); }
  };

  const addNote = async () => {
    if (!user || !note.trim()) return;
    const { error } = await supabase.from("artist_project_notes").insert({ project_id: projectId, author_id: user.id, body: note.trim() });
    if (error) return toast.error(error.message);
    setNote("");
    await refresh();
  };

  const updateProject = async (values: Partial<ArtistRequest>, success?: string) => {
    setSaving(true);
    const { error } = await supabase.from("artist_client_projects").update(values).eq("id", projectId);
    setSaving(false);
    if (error) toast.error(error.message);
    else { if (success) toast.success(success); await refresh(); }
  };

  const saveQuote = () => updateProject({ quote_amount_ore: quoteAmount ? Math.round(Number(quoteAmount) * 100) : null, quote_message: quoteMessage, quote_status: "sent" }, "Quote sent");

  const updateStatus = async (status: "open" | "sketch_in_progress" | "changes_requested" | "booked" | "completed" | "archived") => {
    setSaving(true);
    try { await updateArtistProjectStatus({ data: { projectId, status } }); toast.success(tx("Status updated")); await refresh(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not update status"); }
    finally { setSaving(false); }
  };

  const createAppointment = async () => {
    if (!project?.client_user_id || !appointmentDate) return;
    setSaving(true);
    try {
      const data = await confirmArtistProjectAppointment({ data: { projectId: project.id, date: appointmentDate, time: appointmentTime || null, durationMinutes: 60 } });
      toast.success(tx("Appointment confirmed"));
      setBooking({ id: data.id, status: "confirmed", preferred_date: appointmentDate, preferred_time: appointmentTime || null });
      await refresh();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not confirm appointment"); }
    setSaving(false);
  };

  const saveConversationTitle = async () => {
    if (!project) return;
    setSaving(true);
    try {
      await renameProjectConversation({ data: { projectId: project.id, title: conversationTitle.trim() } });
      toast.success(conversationTitle.trim() ? "Conversation renamed" : "Name reset");
      await refresh();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not rename conversation"); }
    setSaving(false);
  };

  if (loading) return <div className="grid min-h-[60dvh] place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  if (loadError) return <div className="py-20 text-center"><p role="alert" className="text-sm text-muted-foreground">{tx("The request could not be loaded.")}</p><WorkspaceButton type="button" variant="outline" className="mt-4" onClick={() => void refresh()}>{tx("Try again")}</WorkspaceButton></div>;
  if (!project) return <div className="py-20 text-center text-sm text-muted-foreground">{tx("This project is unavailable.")}</div>;

  const quote = project.quote_amount_ore ? `${(project.quote_amount_ore / 100).toLocaleString()} kr` : null;
  return <>
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-mono-caps text-[10px] text-accent">{artistMode ? tx("Customer request") : tx("Tattoo project")}</p><h1 className="mt-1 text-2xl font-display font-bold">{project.conversation_title || project.title}</h1><p className="mt-1 text-sm text-muted-foreground">{project.placement ?? (project.placement_unsure ? tx("Placement unsure") : tx("Placement pending"))}{project.placement && project.placement_unsure ? ` (${tx("unsure")})` : ""}{project.size_cm ? ` · ${project.size_cm} cm` : project.size_unsure ? ` · ${tx("Size unsure")}` : ""}{project.size_cm && project.size_dimension ? ` (${tx(SIZE_DIMENSIONS.find((d) => d.value === project.size_dimension)?.label ?? "").toLowerCase()})` : ""}{project.size_cm && project.size_source ? ` · ${tx(SIZE_SOURCES.find((d) => d.value === project.size_source)?.label ?? "")}` : ""}{project.size_cm && project.size_unsure ? ` (${tx("unsure")})` : ""}{project.color_mode ? ` · ${project.color_mode === "black-grey" ? "Black & grey" : "Color"}` : ""}</p>{(project.reference_urls?.length ?? 0) > 0 && <div className="mt-2 flex gap-2 overflow-x-auto" aria-label={tx("References")}>{(freshRefs ?? project.reference_urls!).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={tx("Reference")} className="size-14 rounded-md object-cover" /></a>)}</div>}</div><span className="rounded-md bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase text-accent">{project.status}</span></div>
      <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3"><Info icon={UserRound} label={tx("Customer")} value={project.client_name ?? tx("Not supplied")} /><Info icon={MessageCircle} label={tx("Contact")} value={project.client_email ?? tx("In InkSimulator")} /><Info icon={Calendar} label={tx("Latest activity")} value={new Date(project.latest_activity_at).toLocaleDateString()} /></div>
      {project.description && <p className="mt-4 text-sm leading-6 text-foreground/80">{project.description}</p>}
    </header>

    {artistMode && (() => {
      const lastClient = [...messages].reverse().find((m) => m.sender_id === project.client_user_id)?.created_at ?? null;
      const lastStudio = [...messages].reverse().find((m) => m.sender_id !== project.client_user_id)?.created_at ?? null;
      const latest = sketches[sketches.length - 1] ?? null;
      const f = buildCaseFacts(project, {
        lastClientMessageAt: lastClient,
        lastStudioMessageAt: lastStudio,
        latestSketch: latest ? { versionNumber: latest.version_number, approvedAt: latest.approved_at } : null,
        booking: booking ? { status: booking.status, date: booking.preferred_date } : null,
        deposit: deposit ? { status: deposit.status } : null,
      });
      const action = studioAction(f);
      const waiting = waitingOn(f);
      return <section aria-labelledby="case-summary" className="mt-5 rounded-lg border border-border p-4">
        <h2 id="case-summary" className="sr-only">{tx("Case summary")}</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {([["Design", designStatus(f), "sketches"], ["Booking", bookingStatus(f), "sessions"], ["Payment", paymentStatus(f), "deposit"]] as const).map(([label, value, t]) => <div key={label}><dt className="text-[11px] font-bold uppercase text-muted-foreground">{tx(label)}</dt><dd><button type="button" onClick={() => setTab(t)} className="min-h-11 text-left text-sm font-bold underline-offset-2 hover:underline">{tx(value.replace(/Version \d+/, "Version {n}")).replace("{n}", String(latest?.version_number ?? ""))}</button></dd></div>)}
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
          {latest?.signed_url && latest.mime_type.startsWith("image/") && <button type="button" onClick={() => setTab("sketches")} aria-label={tx("Open latest sketch")} className="size-16 shrink-0 overflow-hidden rounded-md border border-border"><img src={latest.signed_url} alt="" className="size-full object-cover" /></button>}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">{tx("Next step")}</p>
            <p className="text-sm">{action ? tx(action.reason) : waiting ? tx(waiting) : tx("Nothing is waiting for the studio right now.")}</p>
          </div>
          {action && <WorkspaceButton type="button" onClick={() => setTab(action.tab)}>{tx(action.next)}<ArrowRight className="size-4" /></WorkspaceButton>}
        </div>
      </section>;
    })()}

    <AgeVerificationCard projectId={projectId} artistMode={artistMode} hasBooking={Boolean(booking) || sessions.some((s) => s.status !== "cancelled")} />

    <Tabs value={tab} onValueChange={setTab} className="mt-5">
      <TabsList className="flex h-auto w-full justify-start overflow-x-auto"><TabsTrigger className="shrink-0" value="conversation">{tx("Conversation")}</TabsTrigger><TabsTrigger className="shrink-0" value="sketches">{tx("Sketches")}</TabsTrigger><TabsTrigger className="shrink-0" value="files">{tx("Files")}</TabsTrigger>{artistMode && <TabsTrigger className="shrink-0" value="notes"><Lock className="mr-1 size-3" />{tx("Internal notes")}</TabsTrigger>}<TabsTrigger className="shrink-0" value="quote">{tx("Quote")}</TabsTrigger><TabsTrigger className="shrink-0" value="deposit">{tx("Payments")}</TabsTrigger><TabsTrigger className="shrink-0" value="sessions">{tx("Sessions")}</TabsTrigger></TabsList>
      <TabsContent value="conversation" className="mt-5">
        {artistMode && <div className="mb-4 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Conversation name")}</span><input value={conversationTitle} onChange={(e) => setConversationTitle(e.target.value)} maxLength={120} placeholder={project.title} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-accent" /></label><WorkspaceButton type="button" variant="outline" disabled={saving} onClick={() => void saveConversationTitle()}>{tx("Save name")}</WorkspaceButton></div>}
        <div className="max-h-[46dvh] min-h-56 space-y-3 overflow-y-auto border-y border-border py-4">{messages.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">{tx("Start the conversation about this tattoo.")}</p> : messages.map((item) => { const mine = item.sender_id === user?.id; return <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-md px-3 py-2 text-sm ${mine ? "bg-accent text-accent-foreground" : "bg-secondary"}`}><p className="whitespace-pre-wrap">{item.body}</p><time className="mt-1 block text-[9px] opacity-60">{new Date(item.created_at).toLocaleString()}</time></div></div>; })}<div ref={messageEnd} /></div>
        <div className="mt-3 flex gap-2"><label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border border-border bg-secondary" aria-label={tx("Attach reference")}><Paperclip className="size-4" /><input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => void attach(e.target.files?.[0])} /></label><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendMessage(); }} placeholder={tx("Write a message…")} className="h-11 min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-accent" /><WorkspaceButton type="button" size="icon" disabled={saving || !message.trim()} onClick={() => void sendMessage()} aria-label={tx("Send message")}><Send className="size-4" /></WorkspaceButton></div>
      </TabsContent>
      <TabsContent value="sketches" className="mt-5">{user && <SketchesTab studioMode={artistMode} project={project} sketches={sketches} annotations={sketchAnnotations} currentUserId={user.id} onRefresh={refresh} />}</TabsContent>
      <TabsContent value="files" className="mt-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(() => { const withMotif = ("preview_url" in project ? (project as { preview_url?: string | null }).preview_url : null) ?? project.base_photo_url; return withMotif && <a href={withMotif} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-accent/30 bg-secondary"><img src={withMotif} alt={tx("AR tattoo preview")} className="aspect-square w-full object-cover" /><p className="truncate p-2 text-[10px] text-accent">{tx("AR preview")}</p></a>; })()}{attachments.map((file) => <a key={file.id} href={file.signed_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-border bg-secondary">{file.mime_type?.startsWith("image/") && file.signed_url ? <img src={file.signed_url} alt={file.file_name} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center"><FileText className="size-8 text-accent" /></div>}<p className="truncate p-2 text-[10px]">{file.file_name}</p></a>)}<label className="grid aspect-square cursor-pointer place-items-center rounded-md border border-dashed border-border bg-secondary text-center text-xs text-muted-foreground"><span><ImagePlus className="mx-auto mb-2 size-5 text-accent" />{tx("Add file")}</span><input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => void attach(e.target.files?.[0])} /></label></div></TabsContent>
      {artistMode && <TabsContent value="notes" className="mt-5 rounded-lg border-2 border-dashed border-border bg-secondary/40 p-4"><p className="mb-3 flex items-center gap-2 text-sm font-bold"><Lock className="size-4" />{tx("Internal — never shown to the customer")}</p><p className="mb-3 text-xs text-muted-foreground">{tx("Private. Only studio team members can see these notes.")}</p><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder={tx("Add an internal note…")} className="w-full rounded-md border border-border bg-secondary p-3 text-sm outline-none focus:border-accent" /><WorkspaceButton type="button" className="mt-2" disabled={!note.trim()} onClick={() => void addNote()}><StickyNote className="size-4" />{tx("Add note")}</WorkspaceButton><div className="mt-5 divide-y divide-border border-y border-border">{notes.map((item) => <article key={item.id} className="py-4"><p className="whitespace-pre-wrap text-sm">{item.body}</p><time className="mt-2 block text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time></article>)}</div></TabsContent>}
      <TabsContent value="quote" className="mt-5">{artistMode ? <div className="space-y-4"><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Price (SEK)")}</span><input type="number" min="0" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} className="h-11 w-full rounded-md border border-border bg-secondary px-3" /></label><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Quote message")}</span><textarea rows={4} value={quoteMessage} onChange={(e) => setQuoteMessage(e.target.value)} className="w-full rounded-md border border-border bg-secondary p-3" /></label><WorkspaceButton type="button" disabled={saving} onClick={() => void saveQuote()}><Save className="size-4" />{tx("Send quote")}</WorkspaceButton></div> : <div className="border-y border-border py-8 text-center">{quote ? <><p className="text-3xl font-display font-bold">{quote}</p><p className="mt-2 text-sm text-muted-foreground">{project.quote_message ?? tx("Your quote from the studio")}</p></> : <p className="text-sm text-muted-foreground">{tx("The studio has not sent a quote yet.")}</p>}</div>}
      </TabsContent>
      <TabsContent value="deposit" className="mt-5 space-y-8"><DepositSection projectId={projectId} deposit={deposit} artistMode={artistMode} onRefresh={refresh} /><DepositSection kind="final" projectId={projectId} deposit={finalPayment} artistMode={artistMode} onRefresh={refresh} /></TabsContent>
      <TabsContent value="sessions" className="mt-5"><ProjectSessionPicker project={project} artistMode={artistMode} sessions={sessions} onRefresh={refresh} /></TabsContent>
    </Tabs>

    {artistMode && <section className="mt-8 border-t border-border pt-5"><h2 className="font-display text-lg font-bold">{tx("Project controls")}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Status")}</span><select value={project.status} onChange={(e) => void updateStatus(e.target.value as "open" | "sketch_in_progress" | "changes_requested" | "booked" | "completed" | "archived")} className="h-11 w-full rounded-md border border-border bg-secondary px-3"><option value="open">{tx("Open")}</option><option value="sketch_in_progress">{tx("Sketch in progress")}</option><option value="changes_requested">{tx("Changes requested")}</option>{project.status === "approved" && <option value="approved" disabled>{tx("Design approved")}</option>}<option value="booked">{tx("Booked")}</option><option value="completed">{tx("Completed")}</option><option value="archived">{tx("Archived")}</option></select></label><label><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Assigned artist")}</span><select value={project.assigned_artist_id ?? ""} onChange={(e) => void updateProject({ assigned_artist_id: e.target.value || null }, "Artist assigned")} className="h-11 w-full rounded-md border border-border bg-secondary px-3"><option value="">{tx("Unassigned")}</option>{artists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      {booking ? <div className="mt-5 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm"><p className="font-bold">{booking.status === "awaiting_deposit" ? tx("Time held — waiting for deposit") : tx("Confirmed appointment")}</p><p className="text-muted-foreground">{booking.preferred_date}{booking.preferred_time ? ` at ${booking.preferred_time}` : ""}</p></div> : <div className="mt-5"><p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">{tx("Confirm appointment")}</p><div className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label={tx("Appointment date")} type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} className="h-11 min-w-0 rounded-md border border-border bg-secondary px-2 text-sm" /><input aria-label={tx("Appointment time")} type="time" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} className="h-11 min-w-0 rounded-md border border-border bg-secondary px-2 text-sm" /><WorkspaceButton type="button" disabled={!appointmentDate || saving} onClick={() => void createAppointment()}><Calendar className="size-4" /><span className="hidden sm:inline">{tx("Confirm")}</span></WorkspaceButton></div><p className="mt-2 text-[10px] text-muted-foreground">{tx("The project becomes Booked when this time is confirmed.")}</p></div>}
    </section>}
  </>;
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="flex items-start gap-2"><Icon className="mt-0.5 size-4 text-accent" /><div className="min-w-0"><p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p><p className="truncate text-xs">{value}</p></div></div>; }