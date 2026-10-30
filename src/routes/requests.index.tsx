import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { ArtistRequest } from "@/hooks/useArtistRequests";

import { tx, useUiLang } from "@/lib/uiLang";
const STATUS_LABELS: Record<string, string> = { open: "Open", sketch_in_progress: "Sketch in progress", changes_requested: "Changes requested", approved: "Design approved", booked: "Booked", completed: "Completed", archived: "Archived" };

export const Route = createFileRoute("/requests/")({
  head: () => ({ meta: [{ title: tx("My Tattoo Requests — InkSimulator") }, { name: "description", content: "View your private tattoo requests and studio conversations." }, { property: "og:title", content: "My Tattoo Requests — InkSimulator" }, { property: "og:description", content: "Your private tattoo project workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <RequireAuth requireVerified title={tx("Sign in to view your requests")}><MyRequests /></RequireAuth>,
});

function MyRequests() {
  useUiLang();
  const { user } = useAuth();
  const [items, setItems] = useState<ArtistRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    void supabase.from("artist_client_projects").select("*").eq("client_user_id", user.id).order("latest_activity_at", { ascending: false }).then(({ data }) => { setItems((data ?? []) as ArtistRequest[]); setLoading(false); });
  }, [user]);
  return <AppShell><Link to="/profile" className="inline-flex items-center gap-1 text-xs text-accent"><ArrowLeft className="size-4" />{tx("Profile")}</Link><header className="mt-5 border-b border-border pb-5"><p className="text-mono-caps text-[10px] text-accent">{tx("Private workspace")}</p><h1 className="mt-1 text-3xl font-display font-bold">{tx("My requests")}</h1><p className="mt-1 text-sm text-muted-foreground">{tx("Messages, files, quotes and confirmed times with your studio.")}</p></header>{loading ? <div className="grid py-20 place-items-center"><Loader2 className="size-5 animate-spin text-accent" /></div> : items.length === 0 ? <div className="py-16 text-center"><p className="text-sm text-muted-foreground">{tx("No tattoo requests yet.")}</p><Link to="/artists/search" className="mt-4 inline-flex rounded-md bg-accent px-4 py-3 text-xs font-bold text-accent-foreground">{tx("Find an artist")}</Link></div> : <div className="divide-y divide-border">{items.map((item) => <Link key={item.id} to="/requests/$id" params={{ id: item.id }} className="flex items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="truncate font-bold">{item.title}</p><p className="truncate text-xs text-muted-foreground">{item.placement ?? tx("Placement pending")}{item.size_cm ? ` · ${item.size_cm} cm` : ""}</p><p className="mt-1 text-[10px] uppercase text-accent">{tx(STATUS_LABELS[item.status] ?? item.status)}</p></div><ChevronRight className="size-4 text-muted-foreground" /></Link>)}</div>}</AppShell>;
}