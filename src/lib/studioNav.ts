/**
 * Single source of truth for studio-mode navigation (categories designed with
 * Fable 5.1). Drives the sidebar, tablet tabs, the "Go to" panel, the mobile
 * bottom bar and every back button.
 */
import type { Copy } from "@/lib/studioLang";

export type StudioTab =
  | "guide" | "profil" | "team" | "gallery" | "deals" | "kalender" | "hours" | "members"
  | "motiv" | "skisser" | "tjanster" | "bokningar" | "scans" | "sales" | "agent" | "oversikt"
  | "sync" | "notifs" | "prefs" | "skapa";

export type NavKey = StudioTab | "notifications" | "insights" | "requests" | "clients" | "concepts" | "posture";

export const POSTURE_URL = "https://project--fbc84c0e-fd1e-4855-ab1a-45e4a8f357e8.lovable.app/auth";

export type NavItem = { key: NavKey; label: Copy; tab?: StudioTab; to?: string; external?: string };
export type NavCategory = { key: string; label: Copy; items: NavItem[] };

const tab = (key: StudioTab, en: string, sv: string): NavItem => ({ key, tab: key, label: { en, sv } });

export const STUDIO_NAV: NavCategory[] = [
  { key: "overview", label: { en: "Start", sv: "Start" }, items: [
    tab("oversikt", "Today", "Idag"),
    { key: "requests", to: "/artists/requests", label: { en: "Inbox", sv: "Inkorg" } },
    tab("motiv", "Designs", "Motiv"),
    tab("profil", "Profile", "Profil"),
    { key: "notifications", to: "/notifications", label: { en: "Notifications", sv: "Aviseringar" } },
    tab("guide", "Setup guide", "Kom igång"),
  ] },
  { key: "tools", label: { en: "All tools", sv: "Alla verktyg" }, items: [
    tab("bokningar", "Bookings", "Bokningar"),
    { key: "clients", to: "/artists/clients/list", label: { en: "Clients", sv: "Kunder" } },
    tab("kalender", "Calendar", "Kalender"),
    tab("hours", "Availability", "Tillgänglighet"),
    tab("skapa", "Design tools", "Designverktyg"),
    tab("skisser", "Private sketches", "Privata skisser"),
    { key: "concepts", to: "/artists/clients", label: { en: "Client concepts", sv: "Kundkoncept" } },
    tab("scans", "3D models", "3D-modeller"),
    tab("gallery", "Gallery", "Galleri"),
    tab("tjanster", "Services & prices", "Tjänster & priser"),
    tab("deals", "Deals", "Erbjudanden"),
    tab("team", "Artists on the studio page", "Artister på studiosidan"),
    { key: "insights", to: "/artists/insights", label: { en: "Statistics", sv: "Statistik" } },
  ] },
  { key: "settings", label: { en: "Advanced settings", sv: "Avancerade inställningar" }, items: [
    tab("notifs", "Notification settings", "Aviseringsinställningar"),
    tab("agent", "Booking agent · Optional", "Bokningsagent · Valfritt"),
    tab("sync", "Calendar sync", "Kalendersynk"),
    tab("sales", "Payments & Fortnox", "Betalningar & Fortnox"),
    tab("members", "Team and access", "Team och åtkomst"),
    tab("prefs", "Language & theme", "Språk & tema"),
    { key: "posture", external: POSTURE_URL, label: { en: "Posture Pro", sv: "Posture Pro" } },
  ] },
];

export const STUDIO_TABS = STUDIO_NAV.flatMap(c => c.items).flatMap(i => (i.tab ? [i.tab] : []));

export const isStudioTab = (value: unknown): value is StudioTab =>
  typeof value === "string" && (STUDIO_TABS as string[]).includes(value);

export function navItem(key: NavKey): NavItem {
  return STUDIO_NAV.flatMap(c => c.items).find(i => i.key === key) ?? STUDIO_NAV[0].items[0];
}

export function categoryOf(key: NavKey): NavCategory {
  return STUDIO_NAV.find(c => c.items.some(i => i.key === key)) ?? STUDIO_NAV[0];
}

/** Structural back target: item → category landing → Today → none. */
export function structuralBack(key: NavKey): NavItem | null {
  if (key === "oversikt") return null;
  const landing = categoryOf(key).items[0];
  return landing.key === key ? navItem("oversikt") : landing;
}
