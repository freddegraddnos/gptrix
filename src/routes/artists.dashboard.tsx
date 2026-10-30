import { geocodeMyStudio } from "@/lib/studioGeocode.functions";
import { normalizeExternalUrl } from "@/lib/externalUrl";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StudioDraftStart } from "@/components/StudioDraftStart";
import { StudioWorkspace } from "@/components/StudioWorkspace";
import { StudioPreferences } from "@/components/StudioPreferences";
import { useStudioModules } from "@/hooks/useStudioModules";
import { isStudioTab, type StudioTab } from "@/lib/studioNav";
import { StudioAppearanceEditor } from "@/components/StudioAppearanceEditor";
import { StudioAddress } from "@/components/StudioAddress";
import { StudioOverview } from "@/components/StudioOverview";
import { studioBookingUrl } from "@/lib/studioBookingUrl";
import { supabase } from "@/integrations/supabase/client";
import { StudioCreateTools } from "@/components/StudioCreateTools";
import { ArtistSketches } from "@/components/ArtistSketches";
import { ArtistBookings } from "@/components/ArtistBookings";
import { ArtistScans } from "@/components/ArtistScans";
import { StudioVerificationCard } from "@/components/StudioVerificationCard";
import { MotifSales } from "@/components/MotifSales";
import { FortnoxCard } from "@/components/FortnoxCard";
import { StudioTeamManager } from "@/components/StudioTeamManager";
import { StudioGalleryManager } from "@/components/StudioGalleryManager";
import { StudioDealsManager } from "@/components/StudioDealsManager";
import { StudioAvailabilityManager } from "@/components/StudioAvailabilityManager";
import { StudioCalendar } from "@/components/StudioCalendar";
import { StudioGoogleCalendarCard } from "@/components/StudioGoogleCalendarCard";
import { StudioInstagramCard } from "@/components/StudioInstagramCard";
import { StudioApprovalCard } from "@/components/StudioApprovalCard";
import { StudioMembersManager } from "@/components/StudioMembersManager";
import { NotificationSettings } from "@/components/NotificationSettings";
import { StudioCalendarManager } from "@/components/StudioCalendarManager";
import { StudioGuide } from "@/components/StudioGuide";
import { StudioAgentSettings } from "@/components/StudioAgentSettings";
import { studioImageUrl, uploadStudioImage } from "@/lib/studioMedia";
import { StudioSmsSettings } from "@/components/StudioSmsSettings";
import { StudioBookingFormSettings } from "@/components/StudioBookingFormSettings";
import { Button } from "@/components/ui/button";
import { useStudioLang } from "@/lib/studioLang";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

import { useAuth, markIntentionalSignOut } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";
import {
  Loader2,
  Plus,
  Trash2,
  Palette,
  CalendarClock,
  Save,
  LogOut,
  ShieldCheck,
  Clock,
  MessageCircle,
  Inbox,
  Copy,
} from "lucide-react";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/dashboard")({
  validateSearch: (search: Record<string, unknown>): { tab?: StudioTab; guide?: string; fortnox?: string } => {
    const rawTab = typeof search.tab === "string" ? search.tab.replace(/^"|"$/g, "") : undefined;
    const guide = Number(typeof search.guide === "string" || typeof search.guide === "number" ? search.guide : NaN);
    return {
      tab: isStudioTab(rawTab) ? rawTab : undefined,
      guide: Number.isInteger(guide) && guide >= 1 && guide <= 19 ? String(guide) : undefined,
      fortnox: typeof search.fortnox === "string" ? search.fortnox : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: tx("Artist Panel — InkSimulator") },
      {
        name: "description",
        content:
          "Manage your studio profile, your designs, custom orders, and tattoo appointments.",
      },
      { property: "og:title", content: "Studio workspace — InkSimulator" },
      {
        property: "og:description",
        content: "Manage bookings, clients, designs and your studio on InkSimulator.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArtistDashboard,
});

type Profile = {
  id: string;
  handle: string | null;
  studio_name: string;
  address: string | null;
  website: string | null;
  contact_email: string;
  city: string | null;
  bio: string | null;
  instagram: string | null;
  status: string;
  logo_url: string | null;
  headline: string | null;
};

type Service = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  price_ore: number;
  duration_minutes: number | null;
  active: boolean;
};

type Motif = { id: string; name: string; price_ore: number; published: boolean };

const fieldCls =
  "w-full h-12 rounded-xl bg-slate border border-white/10 px-4 text-sm outline-none focus:border-accent";

function ArtistDashboard() {
  useUiLang();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [lang] = useStudioLang();
  const { user, loading: authLoading } = useAuth();
  const { enabled: enabledModules } = useStudioModules();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [motifs, setMotifs] = useState<Motif[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<StudioTab>("oversikt");
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const [returnStep, setReturnStep] = useState<number | null>(null);

  const openTab = useCallback((next: StudioTab, options?: { replace?: boolean }) => {
    setGuideStep(null);
    void navigate({
      to: "/artists/dashboard",
      search: { tab: next },
      replace: options?.replace,
    });
  }, [navigate]);

  const returnToGuide = () => {
    sessionStorage.removeItem("inksimulator.guide-return");
    setReturnStep(guideStep);
    setGuideStep(null);
    void navigate({ to: "/artists/dashboard", search: { tab: "guide" } });
  };

  useEffect(() => {
    if (tab !== "guide" || returnStep === null) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`guide-step-${returnStep}`)?.scrollIntoView({ block: "start" });
      setReturnStep(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, returnStep]);

  // Shortcuts from the page builder land on the shared booking settings block.
  useEffect(() => {
    if (tab !== "profil" || typeof window === "undefined" || window.location.hash !== "#booking-settings") return;
    const timer = window.setTimeout(() => document.getElementById("booking-settings")?.scrollIntoView({ block: "start" }), 300);
    return () => window.clearTimeout(timer);
  }, [tab]);

  useEffect(() => {
    if (search.guide) {
      setTab("guide");
      setReturnStep(Number(search.guide));
      return;
    }
    setTab(search.fortnox !== undefined ? "sales" : (search.tab ?? "oversikt"));
  }, [search.fortnox, search.guide, search.tab]);

  const [form, setForm] = useState({
    studio_name: "",
    address: "",
    website: "",
    contact_email: "",
    city: "",
    instagram: "",
    bio: "",
    headline: "",
    opening_hours: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savedProfileState, setSavedProfileState] = useState("");

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [acceptsMessages, setAcceptsMessages] = useState(true);
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/artists" });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setProfileLoadFailed(false);
    const { data: p, error: profileError } = await supabase
      .from("artist_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) { setProfileLoadFailed(true); setLoading(false); return; }
    let current = p as Profile | null;

    if (!current) {
      const { data: membership, error: membershipError } = await supabase.from("studio_members")
        .select("studio_id").eq("user_id", user.id).eq("status", "active")
        .in("role", ["admin", "artist"]).limit(1).maybeSingle();
      if (membershipError) { setProfileLoadFailed(true); setLoading(false); return; }
      if (membership) {
        await navigate({ to: "/artists/requests" });
        setLoading(false);
        return;
      }
    }

    if ((current as unknown as { must_change_password?: boolean } | null)?.must_change_password) {
      navigate({ to: "/artists/set-password" });
      setLoading(false);
      return;
    }

    if (current) {
      setProfile(current);
      setForm({
        studio_name: current.studio_name ?? "",
        address: current.address ?? "",
        website: current.website ?? "",
        contact_email: current.contact_email ?? "",
        city: current.city ?? "",
        instagram: current.instagram ?? "",
        bio: current.bio ?? "",
        headline: current.headline ?? "",
        opening_hours: (current as unknown as { opening_hours: string | null }).opening_hours ?? "",
      });
      setLogoUrl(current.logo_url ?? null);
      void studioImageUrl(current.logo_url ?? null).then(setLogoPreview);

      const c = current as unknown as {
        lat: number | null;
        lng: number | null;
        accepts_messages: boolean | null;
        require_deposit_for_confirmation: boolean | null;
      };
      if (typeof c.lat === "number" && typeof c.lng === "number")
        setCoords({ lat: c.lat, lng: c.lng });
      setAcceptsMessages(c.accepts_messages !== false);
      setRequireDeposit(c.require_deposit_for_confirmation === true);
      setSavedProfileState(JSON.stringify({
        form: {
          studio_name: current.studio_name ?? "", address: current.address ?? "", website: current.website ?? "",
          contact_email: current.contact_email ?? "", city: current.city ?? "", instagram: current.instagram ?? "",
          bio: current.bio ?? "", headline: current.headline ?? "",
          opening_hours: (current as unknown as { opening_hours: string | null }).opening_hours ?? "",
        },
        logoUrl: current.logo_url ?? null,
        coords: typeof c.lat === "number" && typeof c.lng === "number" ? { lat: c.lat, lng: c.lng } : null,
        acceptsMessages: c.accepts_messages !== false,
        requireDeposit: c.require_deposit_for_confirmation === true,
      }));
    }

    const [{ data: svc }, { data: mot }] = await Promise.all([
      supabase.from("artist_services").select("*").eq("artist_id", user.id).order("created_at"),
      supabase
        .from("marketplace_motifs")
        .select("id,name,price_ore,published")
        .eq("artist_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setServices((svc as Service[]) ?? []);
    setMotifs((mot as Motif[]) ?? []);
    setLoading(false);
  }, [user, navigate]);

  const currentProfileState = useMemo(() => JSON.stringify({ form, logoUrl, coords, acceptsMessages, requireDeposit }), [form, logoUrl, coords, acceptsMessages, requireDeposit]);
  const profileDirty = tab === "profil" && savedProfileState !== "" && currentProfileState !== savedProfileState;
  useUnsavedChangesGuard(profileDirty);
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    if (!profile) return;
    const websiteValue = form.website.trim() ? normalizeExternalUrl(form.website) : null;
    if (form.website.trim() && !websiteValue) {
      setMsg(tr("Enter a valid website address, for example yourstudio.com.", "Ange en giltig webbadress, till exempel dinstudio.se."));
      return;
    }
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("artist_profiles")
      .update({
        studio_name: form.studio_name.trim(),
        address: form.address.trim() || null,
        website: websiteValue,
        contact_email: form.contact_email.trim(),
        city: form.city.trim() || null,
        instagram: form.instagram.trim() || null,
        bio: form.bio.trim() || null,
        headline: form.headline.trim() || null,
        opening_hours: form.opening_hours.trim() || null,
        logo_url: logoUrl,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        accepts_messages: acceptsMessages,
        require_deposit_for_confirmation: requireDeposit,
      })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? error.message : tr("Profile saved.", "Profilen har sparats."));
    if (!error) setSavedProfileState(currentProfileState);
    // Map position from the saved address when the address changed or none is set.
    if (!error && form.address.trim() && (!coords || form.address.trim() !== (profile.address ?? ""))) {
      try {
        const r = await geocodeMyStudio({ data: { profileId: profile.id } });
        if (r.ok && r.lat != null && r.lng != null) setCoords({ lat: r.lat, lng: r.lng });
      } catch {
        /* position stays as it was */
      }
    }
  };

  /** Uploads a studio logo and shows it right away. */
  const uploadLogo = async (file: File) => {
    if (!user) return;
    try {
      const path = await uploadStudioImage(user.id, file, "logo");
      setLogoUrl(path);
      setLogoPreview(await studioImageUrl(path));
      await supabase.from("artist_profiles").update({ logo_url: path }).eq("user_id", user.id);
      setMsg(tr("Logo uploaded.", "Logotypen har laddats upp."));
    } catch {
      setMsg(tr("Could not upload the logo.", "Kunde inte ladda upp logotypen."));
    }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setMsg(tr("Location services are not supported in this browser.", "Platstjänster stöds inte i den här webbläsaren."));
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
        setMsg(tr("Location captured — don't forget to save.", "Positionen har hämtats — glöm inte att spara."));
      },
      () => {
        setGeoBusy(false);
        setMsg(tr("Could not get location.", "Kunde inte hämta positionen."));
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const addService = async (kind: "custom" | "session") => {
    if (!user) return;
    const { data } = await supabase
      .from("artist_services")
      .insert({
        artist_id: user.id,
        kind,
        title: kind === "custom" ? "Custom design" : "Tattoo appointment",
        price_ore: kind === "custom" ? 149900 : 250000,
        duration_minutes: kind === "session" ? 120 : null,
      })
      .select("*")
      .maybeSingle();
    if (data) setServices((s) => [...s, data as Service]);
  };

  const updateService = async (id: string, patch: Partial<Service>) => {
    setServices((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("artist_services").update(patch).eq("id", id);
  };

  const removeService = async (id: string) => {
    setServices((s) => s.filter((x) => x.id !== id));
    await supabase.from("artist_services").delete().eq("id", id);
  };

  if (!hydrated || authLoading || (user && loading)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return null;

  if (!profile) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        {profileLoadFailed ? <section role="alert" className="w-full max-w-md space-y-4">
          <p>{tr("Could not check your studio access. Your existing studio has not changed.", "Kunde inte kontrollera din studioåtkomst. Din befintliga studio har inte ändrats.")}</p>
          <Button onClick={() => void load()}>{tr("Try again", "Försök igen")}</Button>
        </section> : <StudioDraftStart onCreated={load} />}
      </main>
    );
  }

  return (
    <StudioWorkspace
      name={profile?.studio_name ?? tx("Your studio")}
      approved={profile?.status === "approved"}
      handle={profile?.handle}
      userId={user.id}
      tab={tab}
      onTabChange={openTab}
      guideStep={guideStep}
      onReturnToGuide={returnToGuide}
      action={
        tab === "motiv" ? (
          <Link
            to="/shop/new"
            search={guideStep === 9 ? { guide: 9 } : {}}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-foreground"
          >
            <Plus className="size-4" /> {tr("Sell a design", "Sälj ett motiv")}
          </Link>
        ) : undefined
      }
      onSignOut={() => {
        void (async () => {
          markIntentionalSignOut();
          await supabase.auth.signOut();
          navigate({ to: "/artists" });
        })();
      }}
      copied={msg === "Booking link copied."}
      onCopy={() => {
        if (!profile?.handle) return;
        void navigator.clipboard.writeText(studioBookingUrl(profile.handle));
        setMsg(tx("Booking link copied."));
      }}
    >
      {tab === "oversikt" && user && (
        <StudioOverview studioId={user.id} onOpenTab={openTab} />
      )}
      {tab === "guide" && (
        <StudioGuide
          onOpenTab={(t, step) => {
            sessionStorage.setItem("inksimulator.guide-return", String(step));
            setGuideStep(step);
            void navigate({ to: "/artists/dashboard", search: { tab: t } });
            window.scrollTo(0, 0);
          }}
        />
      )}
      {tab === "sales" && user && (
        <>
          <FortnoxCard studioId={user.id} showSetup={enabledModules.includes("payments") && enabledModules.includes("fortnox")} />
          <MotifSales studioId={user.id} />
        </>
      )}
      {tab === "team" && user && <StudioTeamManager studioId={user.id} />}
      {tab === "gallery" && user && <StudioGalleryManager studioId={user.id} />}
      {tab === "deals" && user && <StudioDealsManager studioId={user.id} />}
      {tab === "kalender" && user && <StudioCalendarManager studioId={user.id} />}
      {tab === "agent" && user && <StudioAgentSettings studioId={user.id} />}
      {tab === "hours" && user && (
        <div className="space-y-6">
          <StudioAvailabilityManager studioId={user.id} />
          <StudioCalendar studioId={user.id} />
        </div>
      )}
      {tab === "sync" && user && <StudioGoogleCalendarCard studioId={user.id} />}
      {tab === "notifs" && user && (
        <div className="space-y-4">
          <StudioSmsSettings userId={user.id} />
          <NotificationSettings userId={user.id} />
        </div>
      )}
      {tab === "prefs" && <StudioPreferences />}
      {tab === "members" && user && <StudioMembersManager studioId={user.id} />}

      {tab === "bokningar" && user && (
        <section className="mt-5">
          <ArtistBookings artistId={user.id} />
        </section>
      )}

      {tab === "scans" && user && (
        <section className="mt-5">
          <ArtistScans artistId={user.id} />
        </section>
      )}

      {tab === "profil" && user && (
        <section className="mt-5 space-y-3">
          <StudioApprovalCard />
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-bold">{tr("Verification status", "Verifieringsstatus")}</summary>
            <div className="mt-3"><StudioVerificationCard artistId={user.id} /></div>
          </details>
          <StudioInstagramCard studioId={user.id} />
          <StudioAppearanceEditor studioId={user.id} />
          <StudioAddress studioId={user.id} />
          <label className="block text-xs text-muted-foreground">{tr("Studio name", "Studionamn")}<input className={`${fieldCls} mt-1`} value={form.studio_name} onChange={(e) => setForm({ ...form, studio_name: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">{tr("Public tagline", "Offentlig kortbeskrivning")}<input className={`${fieldCls} mt-1`} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder={tr("For example: Blackwork studio in Gothenburg", "Till exempel: Blackwork-studio i Göteborg")} /></label>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate p-3">
            <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-ink/60 grid place-items-center">
              {logoPreview ? (
                <img src={logoPreview} alt={tx("Studio logo")} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted-foreground">{tx("LOGO")}</span>
              )}
            </div>
            <label className="flex-1 h-10 cursor-pointer rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center">
              {tr("Upload logo", "Ladda upp logotyp")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">{tr("Address (optional)", "Adress (valfritt)")}<input className={`${fieldCls} mt-1`} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">{tr("City", "Stad")}<input className={`${fieldCls} mt-1`} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">{tr("Website (optional)", "Webbplats (valfritt)")}<input className={`${fieldCls} mt-1`} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">{tx("Instagram (")}{tr("optional", "valfritt")})<input className={`${fieldCls} mt-1`} value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">{tr("Contact email", "Kontaktmejl")}<input className={`${fieldCls} mt-1`} type="email" autoComplete="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label>
          <section id="booking-settings" className="scroll-mt-24 space-y-3 rounded-xl border border-border p-3">
            <h3 className="font-display text-lg uppercase">{tr("Booking settings", "Bokningsinställningar")}</h3>
            <p className="text-[12px] text-muted-foreground">{tr("Booking questions, deposit rule and message reception in one place. Deposit and messages are saved with “Save profile”.", "Bokningsfrågor, handpenningsregel och meddelandemottagning på ett ställe. Handpenning och meddelanden sparas med ”Spara profil”.")}</p>
            {user && <StudioBookingFormSettings userId={user.id} />}
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate p-4">
            <input
              type="checkbox"
              checked={acceptsMessages}
              onChange={(e) => setAcceptsMessages(e.target.checked)}
              className="size-4 accent-current"
            />
            <span className="text-sm">{tr("Receive messages from clients in the app", "Ta emot meddelanden från kunder i appen")}</span>
          </label>

          {(enabledModules.includes("payments") || requireDeposit) && <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate p-4">
            <input
              type="checkbox"
              checked={requireDeposit}
              onChange={(e) => setRequireDeposit(e.target.checked)}
              className="mt-0.5 size-4 accent-current"
            />
            <span className="text-sm">
              {tr("A booking counts as confirmed only when the deposit is paid", "En bokning räknas som bekräftad först när handpenningen är betald")}
              <span className="mt-1 block text-[12px] text-muted-foreground">
                 {tr("Off by default. When on, a booked time is held until the customer pays.", "Av som standard. När inställningen är på hålls tiden tills kunden betalar.")}
              </span>
            </span>
          </label>}
            <button type="button" onClick={() => void navigate({ to: "/artists/dashboard", search: { tab: "notifs" } })} className="text-xs underline">{tr("Notification settings →", "Aviseringsinställningar →")}</button>
          </section>
          <label className="block text-xs text-muted-foreground">{tr("Public studio description", "Offentlig studiobeskrivning")}<textarea className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-slate p-4 text-sm text-foreground outline-none focus:border-accent" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={tr("Styles, price level and information for customers", "Stilar, prisnivå och information till kunder")} /></label>
          <label className="block text-xs text-muted-foreground">{tr("Opening hours", "Öppettider")}<textarea className="mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-slate p-4 text-sm text-foreground outline-none focus:border-accent" value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder={tr("Mon–Fri 10–18\nSat 11–16\nSun closed", "Mån–fre 10–18\nLör 11–16\nSön stängt")} /></label>

          <div className="rounded-xl border border-white/10 bg-slate p-4">
            <p className="text-sm font-bold">{tr("Studio location", "Studions position")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {tr("Required for clients to find you via “near me”.", "Krävs för att kunder ska hitta er via ”nära mig”.")}
              {coords
                ? ` Saved: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                : tx(" No location saved.")}
            </p>
            <button
              onClick={captureLocation}
              className="mt-3 h-11 px-4 rounded-xl border border-accent/60 text-accent font-bold text-xs uppercase tracking-widest"
            >
              {geoBusy ? tr("Fetching…", "Hämtar…") : tr("Use my current location", "Använd min aktuella position")}
            </button>
          </div>


          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
             {tr("Save profile", "Spara profil")}
          </button>
          {msg && <p className="text-[12px] text-muted-foreground text-center">{msg}</p>}
        </section>
      )}

      {tab === "motiv" && (
        <section className="mt-5 space-y-3">
          <p className="text-sm text-muted-foreground">{tr("Motifs uploaded here are separate from public work samples and private customer sketches.", "Motiv som laddas upp här är separata från offentliga arbetsprover och privata kundskisser.")}</p>
          {motifs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {tr("No designs yet. Upload your first design to start selling in the library.", "Inga motiv ännu. Ladda upp ditt första motiv för att börja sälja i biblioteket.")}
            </p>
          )}
          {motifs.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-white/5 bg-slate p-4 flex items-center gap-3"
            >
              <Palette className="size-4 text-accent" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  <span className="whitespace-nowrap">
                    {m.price_ore > 0 ? `${tx("For sale")} · ${(m.price_ore / 100).toFixed(0)}\u00a0kr` : tx("Shown for requests")}
                  </span>{" "}
                  · {m.published ? tx("Published") : tx("Draft")}
                </div>
              </div>
            </div>
          ))}
          <Link
            to="/shop"
            className="block text-center text-[11px] uppercase tracking-widest text-muted-foreground"
          >
            {tr("View the marketplace →", "Visa marknadsplatsen →")}
          </Link>
        </section>
      )}

      {tab === "skapa" && <StudioCreateTools />}

      {tab === "skisser" && user && <ArtistSketches artistId={user.id} />}

      {tab === "tjanster" && (
        <section className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => addService("custom")}
              className="h-12 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2"
            >
              <Plus className="size-4" /> {tr("Custom design", "Eget motiv")}
            </button>
            <button
              onClick={() => addService("session")}
              className="h-12 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2"
            >
              <Plus className="size-4" /> {tr("Tattoo appointment", "Tatueringstid")}
            </button>
          </div>

          {services.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {tx("List what you sell: custom sketches and bookable appointments.")}
            </p>
          )}

          {services.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/5 bg-slate p-4 space-y-2">
              <div className="flex items-center gap-2">
                {s.kind === "session" ? (
                  <CalendarClock className="size-4 text-accent" />
                ) : (
                  <Palette className="size-4 text-accent" />
                )}
                <input
                  className="flex-1 bg-transparent font-semibold outline-none"
                  value={s.title}
                  onChange={(e) => updateService(s.id, { title: e.target.value })}
                />
                <button onClick={() => removeService(s.id)} aria-label={tx("Remove")}>
                  <Trash2 className="size-4 text-muted-foreground" />
                </button>
              </div>
              <textarea
                className="w-full min-h-16 rounded-xl bg-ink/60 border border-white/10 p-3 text-sm outline-none focus:border-accent"
                value={s.description ?? ""}
                onChange={(e) => updateService(s.id, { description: e.target.value })}
                placeholder={tr("Description", "Beskrivning")}
              />
              <div className="flex gap-2">
                <label className="flex-1 flex items-center gap-2 h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    kr
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="flex-1 bg-transparent outline-none"
                    value={Math.round(s.price_ore / 100)}
                    onChange={(e) =>
                      updateService(s.id, { price_ore: Math.max(0, Number(e.target.value) * 100) })
                    }
                  />
                </label>
                {s.kind === "session" && (
                  <label className="flex-1 flex items-center gap-2 h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      min
                    </span>
                    <input
                      type="number"
                      min={15}
                      step={15}
                      className="flex-1 bg-transparent outline-none"
                      value={s.duration_minutes ?? 60}
                      onChange={(e) =>
                        updateService(s.id, { duration_minutes: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
              </div>
              <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                <input
                  type="checkbox"
                  checked={s.active}
                  onChange={(e) => updateService(s.id, { active: e.target.checked })}
                />
                {tr("Visible to clients", "Synlig för kunder")}
              </label>
            </div>
          ))}
        </section>
      )}
    </StudioWorkspace>
  );
}
