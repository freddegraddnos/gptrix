import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Clock,
  Camera,
  Sparkles,
  Send,
  User,
  LogOut,
  Copy,
  Check,
  Share2,
  MessageSquare,
  Gift,
  AtSign,
  Star,
  Vote,
  Milestone,
  Link2,
  GitCompareArrows,
  Bell,
  Inbox,
} from "lucide-react";
import { useAuth, markIntentionalSignOut } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";
import { useProjects } from "@/hooks/useProjects";
import { useSubscription } from "@/hooks/useSubscription";
import { useMyReferralCode } from "@/hooks/useReferral";
import { supabase } from "@/integrations/supabase/client";
import {
  setSubscribed,
} from "@/lib/access";
import { JourneyCard } from "@/components/JourneyCard";
import { LookbookWall } from "@/components/LookbookWall";
import { AccessibilityCard } from "@/components/AccessibilityCard";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useSocialConnections } from "@/hooks/useSocialConnections";
import { platformInfo } from "@/lib/socialAccounts";

import { tx, useUiLang } from "@/lib/uiLang";
type TabId = "tattoos" | "designs" | "considering" | "collections";
type PrivacyId = "public" | "friends" | "private";

const TAB_KEYS: { id: TabId; label: string; fallback: PrivacyId }[] = [
  { id: "tattoos", label: "Tattoos", fallback: "public" },
  { id: "designs", label: "Designs", fallback: "public" },
  { id: "considering", label: "Considering", fallback: "private" },
  { id: "collections", label: "Collections", fallback: "public" },
];

const PRIVACY_OPTIONS: { id: PrivacyId; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "friends", label: "Friends" },
  { id: "private", label: "Private" },
];

export const Route = createFileRoute("/profile/")({
  head: () => ({
    meta: [
      { title: tx("Profile — InkSimulator") },
      {
        name: "description",
        content: "Your profile, referrals, and public handle.",
      },
      { property: "og:title", content: "Profile — InkSimulator" },
      {
        property: "og:description",
        content: "Manage your InkSimulator profile, invite friends, and choose a public handle.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Profile,
});

function Profile() {
  useUiLang();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const hydrated = useHydrated();
  const { isActive, row, bonusActive, bonusUntil } = useSubscription(user?.id);
  const { projects } = useProjects(user?.id);
  const { code: referralCode, uses: referralUses } = useMyReferralCode();
  const { ids: bookmarkIds } = useBookmarks();
  const { connections } = useSocialConnections(user?.id);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [handle, setHandle] = useState<string>("");
  const [handleSaved, setHandleSaved] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [tabPrivacy, setTabPrivacyState] = useState<Partial<Record<TabId, PrivacyId>>>({});

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("handle, email_message_notifications, tab_privacy")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.handle) setHandle(data.handle);
        if (data) setEmailNotifs(data.email_message_notifications !== false);
        if (data?.tab_privacy && typeof data.tab_privacy === "object") {
          setTabPrivacyState(data.tab_privacy as Partial<Record<TabId, PrivacyId>>);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setVoteCount(null);
      return;
    }
    supabase
      .from("vote_sessions")
      .select("id", { count: "exact", head: true })
      .eq("creator_user_id", user.id)
      .then(({ count }) => setVoteCount(count ?? 0));
  }, [user]);

  const setTabPrivacy = async (tab: TabId, value: PrivacyId) => {
    if (!user) return;
    const prev = tabPrivacy;
    const next = { ...tabPrivacy, [tab]: value };
    setTabPrivacyState(next);
    const { error } = await supabase
      .from("profiles")
      .update({ tab_privacy: next })
      .eq("id", user.id);
    if (error) setTabPrivacyState(prev);
  };

  const toggleEmailNotifs = async () => {
    if (!user) return;
    const next = !emailNotifs;
    setEmailNotifs(next);
    const { error } = await supabase
      .from("profiles")
      .update({ email_message_notifications: next })
      .eq("id", user.id);
    if (error) setEmailNotifs(!next);
  };

  const signOut = async () => {
    markIntentionalSignOut();
    await supabase.auth.signOut();
    setSubscribed(false);
    navigate({ to: "/" });
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.inksimulator.com";
  const inviteLink = referralCode ? `${origin}/i/${referralCode}` : "";
  const inviteText = referralCode
    ? `Try InkSimulator — see a tattoo on your own skin before the needle: ${inviteLink}`
    : "";

  const copyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied("code");
    setTimeout(() => setCopied(null), 1500);
  };
  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied("link");
    setTimeout(() => setCopied(null), 1500);
  };
  const shareInvite = async () => {
    if (!inviteText) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: tx("InkSimulator"), text: inviteText, url: inviteLink });
      } else {
        await navigator.clipboard.writeText(inviteText);
        setCopied("link");
        setTimeout(() => setCopied(null), 1500);
      }
    } catch {
      /* user cancelled */
    }
  };
  const smsInvite = () => {
    if (!inviteText) return;
    window.location.href = `sms:?&body=${encodeURIComponent(inviteText)}`;
  };

  const saveHandle = async () => {
    if (!user) return;
    setHandleError(null);
    const normalized = handle.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    if (normalized.length < 3) {
      setHandleError("At least 3 characters (a-z, 0-9, . _ -).");
      return;
    }
    setHandle(normalized);
    const { error } = await supabase
      .from("profiles")
      .update({ handle: normalized })
      .eq("id", user.id);
    if (error) {
      setHandleError(
        error.code === "23505" ? "Handle is already taken." : "Could not save.",
      );
      return;
    }
    setHandleSaved(true);
    setTimeout(() => setHandleSaved(false), 1500);
  };

  const planName =
    row?.price_id === "inkvision_yearly_sub"
      ? "Yearly plan"
      : row?.price_id === "inkvision_monthly_sub"
        ? "Monthly plan"
        : row?.price_id === "inkvision_day_once"
          ? "24h pass"
          : bonusActive
            ? "Referral bonus"
            : "Premium";



  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-4">
        <div className="size-16 rounded-full bg-slate border border-white/10 grid place-items-center overflow-hidden">
          <User className="size-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-mono-caps text-xs text-accent">
            {user ? tx("Logged in") : tx("Guest")}
          </div>
          <h1 className="font-display font-bold text-xl truncate">
            {user?.email ?? tx("Browsing as a guest")}
          </h1>
        </div>
        {user && (
          <button
            onClick={signOut}
            className="size-10 rounded-full glass grid place-items-center"
            aria-label={tx("Log out")}
          >
            <LogOut className="size-4" />
          </button>
        )}
      </header>

      {user && <StudioModeCard userId={user.id} />}

      {user && <JourneyCard />}

      <LookbookWall />



      <div className="rounded-2xl border border-white/10 bg-slate p-5 mb-6">
        <div className="text-mono-caps text-xs text-accent">{tx("Access")}</div>
        <div className="mt-1 flex items-baseline justify-between">
          <div>
            <div className="font-display text-xl font-bold">{tx("Full access")}</div>
            <div className="text-xs text-muted-foreground">
              {tx("All features are free — no payments, no commitment.")}
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold uppercase tracking-widest">
            {tx("Free")}
          </span>
        </div>
      </div>

      {/* Public handle editor */}
      {user && (
        <div className="rounded-2xl border border-white/10 bg-slate p-4 mb-6">
          <div className="flex items-center gap-2 text-mono-caps text-xs text-accent">
            <AtSign className="size-3" />
            {tx("Your public profile")}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {tx("Shareable link:")}{" "}<span className="text-foreground">{origin}/@{handle || "handle"}</span>
          </p>
          <div className="mt-2 flex gap-2">
            <div className="flex-1 min-w-0 flex items-center h-11 rounded-xl bg-ink border border-white/10 px-3">
              <span className="text-muted-foreground text-sm">@</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                placeholder="yourname"
                maxLength={30}
                className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-sm ml-1 lowercase"
              />
            </div>
            <button
              onClick={saveHandle}
              className="h-11 px-4 rounded-xl border border-accent/60 text-accent font-bold text-xs uppercase tracking-widest"
            >
              {handleSaved ? <Check className="size-3.5" /> : tx("Save")}
            </button>
          </div>
          {handleError && (
            <p className="mt-2 text-[13px] text-destructive">{handleError}</p>
          )}
          {handle && !handleError && (
            <Link
              to="/@{$username}"
              params={{ username: handle }}
              className="mt-2 inline-block text-[13px] text-accent underline underline-offset-4"
            >
              {tx("Open public profile →")}
            </Link>
          )}

          {/* Integritet per flik */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {tx("Visibility per tab")}
            </div>
            <div className="mt-2 space-y-2">
              {TAB_KEYS.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="flex-1 text-xs">{tx(t.label)}</span>
                  <div className="flex gap-1">
                    {PRIVACY_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => void setTabPrivacy(t.id, o.id)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border ${
                          (tabPrivacy[t.id] ?? t.fallback) === o.id
                            ? "border-accent/60 text-accent bg-accent/10"
                            : "border-white/10 text-muted-foreground"
                        }`}
                      >
                        {tx(o.label)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}



      {/* Notification settings */}
      {user && (
        <div className="rounded-2xl border border-white/10 bg-slate p-4 mb-6">
          <div className="text-mono-caps text-xs text-accent">{tx("Notifications")}</div>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold">{tx("Email on new messages")}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {tx("Get an email when someone sends you a message in the app.")}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={emailNotifs}
              aria-label={tx("Email notification for new messages")}
              onClick={toggleEmailNotifs}
              className={`mt-1 w-12 h-7 rounded-full border transition-colors shrink-0 ${
                emailNotifs ? "bg-accent border-accent" : "bg-ink border-white/20"
              }`}
            >
              <span
                className={`block size-5 rounded-full bg-ink transition-transform ${
                  emailNotifs ? "translate-x-6 bg-ink" : "translate-x-1 bg-white/50"
                }`}
              />
            </button>
          </div>
        </div>
      )}



      {/* Invite friends */}
      {user && referralCode && (
        <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-mono-caps text-xs text-accent">
              <Gift className="size-3" />
              {tx("Invite friends")}
            </div>
            {referralUses > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">
                {referralUses} invited
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 min-w-0 h-11 rounded-xl bg-ink border border-white/10 px-3 grid place-items-center font-mono text-sm tracking-widest uppercase">
              {referralCode}
            </code>
            <button
              onClick={copyCode}
              className="h-11 px-3 rounded-xl border border-accent/60 text-accent text-xs uppercase font-bold tracking-widest flex items-center gap-1.5 shrink-0"
              aria-label={tx("Copy code")}
            >
              {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 min-w-0 h-11 rounded-xl bg-ink border border-white/10 px-3 flex items-center text-[13px] text-muted-foreground truncate">
              {inviteLink}
            </div>
            <button
              onClick={copyLink}
              className="h-11 px-3 rounded-xl border border-white/15 text-foreground text-xs uppercase font-bold tracking-widest flex items-center gap-1.5 shrink-0"
              aria-label={tx("Copy link")}
            >
              {copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={smsInvite}
              className="h-10 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="size-3.5" />
              {tx("SMS")}
            </button>
            <button
              onClick={shareInvite}
              className="h-10 rounded-xl border border-white/10 text-foreground font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5"
            >
              <Share2 className="size-3.5" />
              {tx("Share")}
            </button>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {tx("Share your link so friends can try tattoos on their own skin.")}
          </p>
        </div>
      )}



      {hydrated && !user && !loading && (
        <section className="mb-6 rounded-2xl border border-white/10 bg-slate p-5" aria-labelledby="guest-access">
          <h2 id="guest-access" className="text-mono-caps text-xs text-accent">{tx("What you can do")}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-bold">{tx("As a guest")}</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                <li>{tx("Try designs in the AR camera and on a photo")}</li>
                <li>{tx("Browse designs and studios")}</li>
                <li>{tx("Bookmark designs — kept on this device only")}</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-bold">{tx("With an account")}</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                <li>{tx("Save AR projects and compare them")}</li>
                <li>{tx("Automatic history of your AR tests")}</li>
                <li>{tx("Send booking requests and follow your requests")}</li>
                <li>{tx("Notifications and bookmarks across devices")}</li>
              </ul>
            </div>
          </div>
          <Link
            to="/auth"
            search={{ redirect: "/profile" }}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent text-ink text-[15px] font-medium"
          >
            {tx("Log in or create account")}
          </Link>
        </section>
      )}

      <p className="heading-setting mb-3">{tx("My motifs")}</p>
      <ul className="space-y-2">
        <Row icon={Sparkles} label={tx("Owned designs")} value="0" />
        <Row
          icon={Star}
          label={tx("Bookmarked")}
          value={String(bookmarkIds.length)}
          to="/library"
          search={{ saved: true }}
        />
      </ul>

      <p className="heading-setting mb-1 mt-8">{tx("Try-ons")}</p>
      <p className="mb-3 text-xs text-muted-foreground">
        {tx("Saved projects are try-ons you choose to keep, with placement and size — these can be compared and sent to a studio. History logs every AR photo automatically.")}
      </p>
      <ul className="space-y-2">
        <Row
          icon={Camera}
          label={tx("Saved AR projects")}
          value={String(projects.length)}
          to="/projects"
        />
        <Row icon={Clock} label={tx("My history")} value="AR tests" to="/history" />
        {projects.length > 0 && (
          <Row
            icon={Milestone}
            label={tx("My tattoo journey")}
            value="Timeline"
            to="/projects"
          />
        )}
        <Row
          icon={GitCompareArrows}
          label={tx("Compare 2 photos")}
          value="Start a vote"
          to="/compare"
        />
        {!!voteCount && (
          <Row
            icon={Vote}
            label={tx("Friend voting")}
            value={String(voteCount)}
            to="/votes"
          />
        )}
      </ul>

      <p className="heading-setting mb-3 mt-8">{tx("Requests")}</p>
      <ul className="space-y-2">
        <Row icon={Send} label={tx("Bookings")} value="Studios" to="/bookings" />
        <Row icon={Inbox} label={tx("Tattoo requests")} value="Studios" to="/requests" />
      </ul>

      <p className="heading-setting mb-3 mt-8">{tx("Account")}</p>
      <ul className="space-y-2">
        <Row
          icon={Link2}
          label={tx("Your details")}
          value="Name & contact"
          to="/profile/details"
        />
        {connections.length > 0 && (
        <Row
          icon={Link2}
          label={tx("Connected accounts")}
          value={connections.length === 0 ? tx("None") : ""}
          to="/profile/accounts"
          right={
            connections.length > 0 ? (
              <span className="flex items-center gap-1.5">
                {connections.map((c) => {
                  const info = platformInfo(c.platform);
                  if (!info) return null;
                  return (
                    <span
                      key={c.id}
                      title={tx(info.label)}
                      aria-label={tx(info.label)}
                      className="size-6 rounded-full border border-white/10 grid place-items-center text-xs font-bold text-ink"
                      style={{ background: info.color }}
                    >
                      {tx(info.label).slice(0, 1)}
                    </span>
                  );
                })}
              </span>
            ) : undefined
          }
        />
        )}
        <Row
          icon={Bell}
          label={tx("Notifications")}
          value="Channels & events"
          to="/profile/notifications"
        />
      </ul>

      <div className="mt-6">
        <AccessibilityCard />
      </div>
    </AppShell>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  to,
  search,
  hash,
  right,
}: {
  icon: typeof Camera;
  label: string;
  value: string;
  to?: string;
  search?: Record<string, unknown>;
  hash?: string;
  right?: React.ReactNode;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      {right ?? <span className="text-sm font-bold">{value}</span>}
    </>
  );
  const cls =
    "flex items-center justify-between rounded-xl border border-white/5 bg-slate px-4 py-3";
  return to ? (
    <li>
      <Link
        to={to}
        {...(search ? { search: search as never } : {})}
        {...(hash ? { hash } : {})}
        className={cls}
      >
        {content}
      </Link>
    </li>
  ) : (
    <li className={cls}>{content}</li>
  );
}

/** Shown only to studio accounts: a clear switch into the studio workspace. */
function StudioModeCard({ userId }: { userId: string }) {
  useUiLang();
  const [studioName, setStudioName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase
      .from("artist_profiles")
      .select("studio_name")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setStudioName(data.studio_name ?? "Your studio");
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  if (!studioName) return null;
  return (
    <Link
      to="/artists/dashboard"
      className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-foreground p-4 text-background"
    >
      <span className="min-w-0">
        <span className="block text-xs uppercase tracking-widest opacity-70">{tx("You are a studio")}</span>
        <span className="block font-display text-2xl leading-tight truncate">{studioName}</span>
      </span>
      <span className="shrink-0 text-[13px] uppercase tracking-widest">{tx("Studio mode →")}</span>
    </Link>
  );
}
