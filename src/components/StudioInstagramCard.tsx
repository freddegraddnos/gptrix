import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Instagram, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  disconnectInstagram,
  getInstagramSetup,
  startInstagramConnect,
} from "@/lib/instagram.functions";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
type Setup = {
  configured: boolean;
  linked: boolean;
  username: string | null;
  accountType: string | null;
  permissionsOk: boolean;
};

/** Connect card for answering Instagram DMs inside InkSimulator. */
/** Hidden until Meta business verification + App Review are complete. Flip to true to re-enable. */
const INSTAGRAM_INTEGRATION_LIVE = false;

export function StudioInstagramCard({ studioId }: { studioId: string }) {
  if (!INSTAGRAM_INTEGRATION_LIVE) return null;
  return <StudioInstagramCardInner studioId={studioId} />;
}

function StudioInstagramCardInner({ studioId }: { studioId: string }) {
  useUiLang();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [lang] = useStudioLang();
  const read = useServerFn(getInstagramSetup);
  const start = useServerFn(startInstagramConnect);
  const disconnect = useServerFn(disconnectInstagram);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("instagram");
    const sv = localStorage.getItem("inkvision.studio-lang") === "sv";
    const msgs: Record<string, [string, string]> = {
      denied: ["Instagram connection was cancelled.", "Instagram-anslutningen avbröts."],
      expired: ["The connection link expired. Try again.", "Länken gick ut. Försök igen."],
      failed: ["Could not connect Instagram. Try again.", "Kunde inte ansluta Instagram. Försök igen."],
    };
    if (status && msgs[status]) toast.error(msgs[status][sv ? 1 : 0]);
    if (status === "connected") toast.success(sv ? "Instagram anslutet" : "Instagram connected");
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setSetup(await read({ data: { studioId } }));
      } catch {
        setSetup({
          configured: false,
          linked: false,
          username: null,
          accountType: null,
          permissionsOk: false,
        });
      }
    })();
  }, [read, studioId]);

  if (!setup) return null;

  const isProfessional = setup.accountType === "BUSINESS" || setup.accountType === "CREATOR";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Instagram className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">{tx("Connect your studio's Instagram")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {!setup.configured
              ? tx("Almost ready. Instagram needs to be set up for InkSimulator before studios can connect their account.")
              : setup.linked
                ? `Connected${setup.username ? ` as @${setup.username}` : ""}. New DMs arrive in your inbox and replies are sent as real Instagram messages.`
                : tx("You log in with your own Instagram Business account. InkSimulator reads and replies to your DMs through a secure API connection.")}
          </p>

          {setup.configured && !setup.linked && (
            <p className="mt-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
              {lang === "sv"
                ? tx("Under testfasen: ditt Instagram-konto måste läggas till som testare av InkSimulator hos Meta (App roles → Instagram testare). Be InkSimulator om inbjudan, acceptera den i Instagram-appen och anslut sedan här. Full åtkomst för alla studios kommer när Metas granskning är klar.")
                : tx("During testing: your Instagram account must be added as an InkSimulator tester on Meta (App roles → Instagram testers). Ask InkSimulator for the invite, accept it in the Instagram app, then connect here. Full access for every studio comes after Meta's review.")}
            </p>
          )}

          {setup.linked && setup.accountType && !isProfessional && (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>{tx("This Instagram account cannot receive DMs via API")}</AlertTitle>
              <AlertDescription>
                {tx("Switch to an Instagram Business or Creator account to use this feature.")}
              </AlertDescription>
            </Alert>
          )}

          {setup.linked && isProfessional && !setup.permissionsOk && (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>{tx("Some Instagram permissions are missing")}</AlertTitle>
              <AlertDescription>
                {tx("Reconnect below and allow all requested permissions.")}
              </AlertDescription>
            </Alert>
          )}

          {setup.configured && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {setup.linked ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await disconnect({ data: { studioId } });
                      setSetup({ ...setup, linked: false, username: null, accountType: null });
                      toast.success(tx("Instagram disconnected"));
                    } catch (cause) {
                      toast.error(cause instanceof Error ? cause.message : "Could not disconnect");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Unplug className="mr-2 h-4 w-4" aria-hidden />
                  {tx("Disconnect")}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const { authorizationUrl } = await start({ data: { studioId } });
                      window.location.href = authorizationUrl;
                    } catch (cause) {
                      toast.error(
                        cause instanceof Error ? cause.message : "Could not start the connection",
                      );
                      setBusy(false);
                    }
                  }}
                >
                  {tx("Connect Instagram")}
                </Button>
              )}

              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <HelpCircle className="mr-2 h-4 w-4" aria-hidden />
                    {tx("How it works")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx("Instagram messages in InkSimulator")}</DialogTitle>
                    <DialogDescription>
                      {tx("Answer your studio's Instagram DMs without leaving InkSimulator.")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">{tx("Do I need my own Meta app?")}</strong>
                      <br />
                      {tx("No. InkSimulator uses one secure app to talk to Instagram. You only log in with your own Instagram Business or Creator account.")}
                    </p>
                    <p>
                      <strong className="text-foreground">{tx("What can I do?")}</strong>
                      <br />
                      {tx("Read and reply to DMs, turn chats into projects, send sketch links, and share available appointment times.")}
                    </p>
                    <p>
                      <strong className="text-foreground">{tx("What kind of account works?")}</strong>
                      <br />
                      {tx("Instagram Business or Creator accounts linked to Meta Business Suite. Personal accounts cannot receive API messages.")}
                    </p>
                    <p>
                      <strong className="text-foreground">{tx("Is it secure?")}</strong>
                      <br />
                      {tx("Your token is encrypted and never shown in the app. You can disconnect anytime.")}
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
