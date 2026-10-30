import { StudioButton as Button } from "@/components/StudioPrimitives";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, FileUp, Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getVerificationState,
  sendStudioOtp,
  submitStudioDocument,
  verifyStudioOtp,
  type VerificationState,
} from "@/lib/artistVerify.functions";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
/**
 * Two-step studio verification: an OTP sent to the studio contact email plus a
 * business document upload. Both done = verified badge across the app.
 */
export function StudioVerificationCard({ artistId }: { artistId: string }) {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const [state, setState] = useState<VerificationState | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "otp" | "verify" | "doc">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await getVerificationState());
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requestCode = async () => {
    setBusy("otp");
    setMsg(null);
    const res = await sendStudioOtp().catch(() => null);
    setBusy(null);
    setMsg(res?.ok ? tx("Code sent to {email}.", { email: res.email }) : (res?.error ?? "Could not send the code."));
  };

  const confirmCode = async () => {
    setBusy("verify");
    setMsg(null);
    const res = await verifyStudioOtp({ data: { code } }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setCode("");
      setMsg(res.verified ? "Studio verified!" : "Email confirmed. Upload a document to finish.");
      await load();
    } else {
      setMsg(res?.error ?? "Could not verify the code.");
    }
  };

  const uploadDoc = async (file: File) => {
    setBusy("doc");
    setMsg(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `${artistId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("verification").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (up.error) {
      setBusy(null);
      setMsg(tx("Upload failed."));
      return;
    }
    const res = await submitStudioDocument({ data: { path } }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setMsg(res.verified ? "Studio verified!" : "Document received. Confirm your email to finish.");
      await load();
    } else {
      setMsg(res?.error ?? "Could not save the document.");
    }
  };

  return (
    <div className="studio-card">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-4 text-accent" />
        <p className="text-sm font-bold">{tr("Studio verification", "Studioverifiering")}</p>
        {state?.verified && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">
             <BadgeCheck className="size-3" /> {tr("Verified", "Verifierad")}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {state?.verified
          ? tr("Verified means that the contact email is confirmed and business documentation is registered. It is not a hygiene inspection.", "Verifierad betyder att kontaktmejlen är bekräftad och företagsdokumentation är registrerad. Det är ingen hygienkontroll.")
          : tr("Pending means that email confirmation or business documentation is still missing. Uploading a document is not a hygiene inspection.", "Väntar betyder att mejlbekräftelse eller företagsdokumentation fortfarande saknas. Dokumentuppladdning är ingen hygienkontroll.")}
      </p>

      <ol className="mt-4 space-y-3 text-sm">
        <li className="studio-subsection">
          <div className="flex flex-wrap items-center gap-2">
            <Mail className="size-4 text-accent" />
             <span className="font-semibold">{tr("1. Confirm contact email", "1. Bekräfta kontaktmejl")}</span>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
               {state?.emailVerified ? tr("done", "klar") : tr("pending", "väntar")}
            </span>
          </div>
          {!state?.emailVerified && (
            <>
              <p className="mt-1 text-[11px] text-muted-foreground">
                 {tr("We send a 6-digit code to", "Vi skickar en sexsiffrig kod till")} {state?.contactEmail ?? tr("your contact email", "din kontaktmejl")}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="123456"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-slate px-4 text-sm tracking-[0.3em] outline-none focus:border-accent"
                />
                <Button
                  onClick={() => void (code.length === 6 ? confirmCode() : requestCode())}
                  disabled={busy !== null}
                  className="h-11 rounded-xl bg-accent px-4 text-[11px] font-bold uppercase tracking-widest text-ink disabled:opacity-60"
                >
                  {busy === "otp" || busy === "verify" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : code.length === 6 ? (
                    tx("Verify")
                  ) : (
                    tx("Send code")
                  )}
                </Button>
              </div>
            </>
          )}
        </li>

        <li className="studio-subsection">
          <div className="flex flex-wrap items-center gap-2">
            <FileUp className="size-4 text-accent" />
             <span className="font-semibold">{tr("2. Register business documentation", "2. Registrera företagsdokumentation")}</span>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
               {state?.documentSubmitted ? tr("done", "klar") : tr("pending", "väntar")}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
             {tr("Business registration or studio licence (PDF or image, max 10 MB). Only InkSimulator can see it. Registration does not mean that InkSimulator has inspected hygiene practices.", "Företagsregistrering eller studiotillstånd (PDF eller bild, max 10 MB). Endast InkSimulator kan se det. Registreringen innebär inte att InkSimulator har kontrollerat hygienrutiner.")}
          </p>
          <label className="mt-3 flex h-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-widest">
             {busy === "doc" ? <Loader2 className="size-4 animate-spin" /> : tr("Choose file", "Välj fil")}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadDoc(f);
                e.target.value = "";
              }}
            />
          </label>
        </li>
      </ol>

      {msg && <p className="mt-3 text-[11px] text-accent">{msg}</p>}
    </div>
  );
}
