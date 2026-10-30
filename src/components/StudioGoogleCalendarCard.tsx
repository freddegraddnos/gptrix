import { StudioButton as Button } from "@/components/StudioPrimitives";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, RefreshCw, Stethoscope, Unplug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  completeStudioCalendarConnect,
  disconnectStudioCalendar,
  startStudioCalendarConnect,
  syncStudioCalendar,
  testStudioCalendar,
} from "@/lib/studioCalendar.functions";

import { tx, useUiLang } from "@/lib/uiLang";
type Status = { allowed: boolean; linked: boolean; account_email: string | null; last_synced_at: string | null };

function waitForOAuthCompletion(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== "google_calendar" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error(tx("The connection failed.")));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error(tx("The window closed before the connection finished.")));
    }, 500);
  });
}

export function StudioGoogleCalendarCard({ studioId }: { studioId: string }) {
  useUiLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const start = useServerFn(startStudioCalendarConnect);
  const complete = useServerFn(completeStudioCalendarConnect);
  const sync = useServerFn(syncStudioCalendar);
  const disconnect = useServerFn(disconnectStudioCalendar);
  const runTest = useServerFn(testStudioCalendar);

  const refresh = async () => {
    const { data } = await supabase.rpc("studio_calendar_status", { _studio: studioId });
    setStatus((data as unknown as Status) ?? null);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId]);

  const onConnect = async () => {
    const popup = window.open("", "inkvision-google-calendar", "width=600,height=720");
    if (!popup) {
      toast.error(tx("Allow pop-ups and try again."));
      return;
    }
    setBusy(true);
    try {
      const { authorizationUrl } = await start();
      const completion = waitForOAuthCompletion(popup);
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await complete({ data: { code } });
      toast.success(tx("Google Calendar connected."));
      await refresh();
    } catch (error) {
      popup.close();
      toast.error(error instanceof Error ? error.message : "Could not connect Google Calendar.");
    } finally {
      setBusy(false);
    }
  };

  const onSync = async () => {
    setBusy(true);
    try {
      const result = await sync();
      if ("reconnectRequired" in result && result.reconnectRequired) {
        toast.error(tx("Your Google access needs to be renewed. Connect again."));
      } else {
        toast.success(tx("Calendar synced — {n} times blocked.", { n: result.blocked }));
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      const result = await runTest();
      if (result.ok) toast.success(result.detail);
      else toast.error(`${result.detail}${result.status ? ` (code ${result.status})` : ""}`, { duration: 12000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The test call failed.", { duration: 12000 });
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect();
      toast.success(tx("Google Calendar disconnected."));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <section className="studio-card">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">{tx("Google Calendar")}</h3>
      </div>
      {!status.allowed ? (
        <p className="mt-2 text-xs text-muted-foreground">{tx("Only the studio owner can connect a calendar.")}</p>
      ) : status.linked ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {tx("Connected")}{status.account_email ? ` · ${status.account_email}` : ""}{tx(". Confirmed sessions are added to your Google Calendar, and busy times there block your InkSimulator times.")}
            {status.last_synced_at ? tx(" Last sync {time}.", { time: new Date(status.last_synced_at).toLocaleString() }) : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={onSync}
              variant="outline" className="flex items-center gap-1.5 rounded-full border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />{" "}{tx("Sync now")}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={onTest}
              variant="outline" className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Stethoscope className="h-3.5 w-3.5" />{" "}{tx("Test connection")}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={onDisconnect}
              variant="outline" className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Unplug className="h-3.5 w-3.5" />{" "}{tx("Disconnect")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {tx("Connect your Google Calendar so booked sessions land there automatically and your existing appointments block times in InkSimulator.")}
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={onConnect}
            className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-50"
          >
            {tx("Connect Google Calendar")}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {tx("On a phone, allow pop-ups for inksimulator.com first — the Google window opens as a pop-up.")}
          </p>
        </>
      )}
    </section>
  );
}
