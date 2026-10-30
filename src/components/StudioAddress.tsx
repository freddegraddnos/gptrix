import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changeStudioHandle } from "@/lib/agentSettings.functions";
import { studioBookingUrl } from "@/lib/studioBookingUrl";

import { tx, useUiLang } from "@/lib/uiLang";
export function StudioAddress({ studioId }: { studioId: string }) {
  useUiLang();
  const rename = useServerFn(changeStudioHandle);
  const [current, setCurrent] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.from("artist_profiles").select("handle").eq("user_id", studioId).maybeSingle()
    ).then(({ data }) => { if (active) { setCurrent(data?.handle ?? ""); setHandle(data?.handle ?? ""); } }).catch(() => { if (active) toast.error(tx("Could not load studio address")); });
    return () => { active = false; };
  }, [studioId]);
  const links = current ? [
    ["Studio page", `https://www.inksimulator.com/${current}`],
    ["Booking", studioBookingUrl(current)],
    ["Booking agent", `https://www.inksimulator.com/${current}/agent`],
  ] as const : [];
  const save = async () => {
    setBusy(true);
    try {
      const result = await rename({ data: { studioId, handle } });
      setCurrent(result.handle);
      toast.success(tx("Address updated — old links still work"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not change address"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 border-y border-border py-6" aria-labelledby="studio-address-heading">
    <div>
      <h3 id="studio-address-heading" className="font-display text-xl uppercase">{tx("Your address")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tx("Your studio address on InkSimulator. Old links and QR codes continue to forward after a change.")}</p>
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:flex sm:items-center">
      <label className="min-w-0 text-xs text-muted-foreground sm:flex sm:flex-1 sm:items-center sm:gap-2"><span className="block shrink-0 pb-1 sm:pb-0">inksimulator.com/</span><input aria-label={tx("Studio address")} value={handle} maxLength={30} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground" /></label>
      <Button type="button" disabled={busy || !handle || handle === current} onClick={() => void save()}>{tx("Save")}</Button>
    </div>
    <ul className="space-y-3">{links.map(([label, href]) => <li key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm"><div className="min-w-0"><strong className="block text-xs">{label}</strong><a className="block truncate text-accent underline" href={href} target="_blank" rel="noreferrer">{href.replace("https://www.", "")}</a></div><Button type="button" variant="outline" size="icon" title={`Copy ${label} link`} aria-label={`Copy ${label} link`} onClick={() => { void navigator.clipboard.writeText(href); toast.success(tx("Link copied")); }}><Copy className="size-4" /></Button></li>)}</ul>
    {current && <Button asChild variant="outline" size="sm"><a href={`/${current}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />{tx("Customer view")}</a></Button>}
  </section>;
}