import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  getAgeVerificationImage,
  requestAgeVerification,
  reviewAgeVerification,
  submitAgeVerification,
} from "@/lib/ageVerification.functions";

type Verification = {
  id: string;
  project_id: string;
  min_age: number;
  status: "open" | "submitted" | "approved" | "rejected";
  birth_year: number | null;
  reject_reason: string | null;
  reviewed_at: string | null;
};

/**
 * Age check before booking. The studio asks, the customer uploads a photo of
 * their ID, the studio approves or rejects. The photo is deleted as soon as it
 * has been reviewed.
 */
export function AgeVerificationCard({ projectId, artistMode, hasBooking = false }: { projectId: string; artistMode: boolean; hasBooking?: boolean }) {
  const [row, setRow] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [minAge, setMinAge] = useState("18");
  const [birthYear, setBirthYear] = useState("");
  const [reason, setReason] = useState("");
  const [idUrl, setIdUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("artist_project_age_verifications")
      .select("id,project_id,min_age,status,birth_year,reject_reason,reviewed_at")
      .eq("project_id", projectId)
      .maybeSingle();
    setRow((data as Verification | null) ?? null);
    setIdUrl(null);
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const ask = async () => {
    setBusy(true);
    try {
      await requestAgeVerification({ data: { projectId, minAge: Number(minAge) || 18 } });
      toast.success("Age verification requested");
      await refresh();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not request verification"); }
    finally { setBusy(false); }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Upload a photo of your ID.");
    if (file.size > 15 * 1024 * 1024) return toast.error("The photo must be under 15 MB.");
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `project/${projectId}/age-id/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await submitAgeVerification({ data: { projectId, storagePath: path } });
      toast.success("Sent to the studio");
      await refresh();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not send the photo"); }
    finally { setBusy(false); }
  };

  const openId = async () => {
    setBusy(true);
    try {
      const result = await getAgeVerificationImage({ data: { projectId } });
      setIdUrl(result.url);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not open the photo"); }
    finally { setBusy(false); }
  };

  const review = async (decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      await reviewAgeVerification({
        data: {
          projectId,
          decision,
          birthYear: decision === "approved" ? Number(birthYear) || null : null,
          reason: decision === "rejected" ? reason.trim() || undefined : undefined,
        },
      });
      toast.success(decision === "approved" ? "Age verified" : "ID rejected");
      setBirthYear("");
      setReason("");
      await refresh();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not save the review"); }
    finally { setBusy(false); }
  };

  if (!row && !artistMode) return null;
  // Nothing requested and a time is already booked: no generic prompt.
  if (!row && hasBooking) return null;

  if (!row) {
    return (
      <section className="mt-5 rounded-md border border-border bg-secondary/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4 text-accent" />Age verification</p>
            <p className="mt-1 text-xs text-muted-foreground">Ask the customer for a photo of their ID before a time can be booked. The photo is deleted as soon as you review it.</p>
          </div>
          <label className="w-24">
            <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Min age</span>
            <input type="number" min={16} max={30} value={minAge} onChange={(e) => setMinAge(e.target.value)} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm" />
          </label>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void ask()}>Request age verification</Button>
        </div>
      </section>
    );
  }

  if (row.status === "approved") {
    return (
      <section className="mt-5 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-bold text-emerald-400"><BadgeCheck className="size-4" />Age verified</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {artistMode
            ? `Checked ${row.reviewed_at ? new Date(row.reviewed_at).toLocaleDateString() : ""}${row.birth_year ? ` · born ${row.birth_year}` : ""}. The ID photo has been deleted.`
            : "Your age is verified. You can book a time."}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-md border border-accent/40 bg-accent/5 p-4">
      <p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4 text-accent" />Age verification required</p>
      {artistMode ? (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-muted-foreground">
            {row.status === "submitted" ? "The customer sent an ID. Open it, check the date of birth, then approve or reject." : row.status === "rejected" ? "You rejected the last photo. Waiting for a new one." : `Waiting for the customer to upload an ID (minimum age ${row.min_age}).`}
          </p>
          {row.status === "submitted" && (
            <>
              {idUrl ? <img src={idUrl} alt="Customer ID" className="max-h-72 w-full rounded-md border border-border object-contain" /> : <Button type="button" variant="outline" disabled={busy} onClick={() => void openId()}>Open ID photo</Button>}
              <div className="flex flex-wrap items-end gap-2">
                <label className="w-32">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Year of birth</span>
                  <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1998" className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm" />
                </label>
                <Button type="button" disabled={busy || !birthYear} onClick={() => void review("approved")}>Approve</Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Reason (optional)</span>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={280} placeholder="Photo too blurry" className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm" />
                </label>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void review("rejected")}>Reject</Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-muted-foreground">The studio needs to verify you are at least {row.min_age} before booking. Upload a photo of your ID where your date of birth is readable. Only the studio can open it, and it is deleted as soon as they have checked it — we only keep that you are verified and your year of birth.</p>
          {row.status === "rejected" && <p className="text-xs text-destructive">{row.reject_reason || "The studio could not read your ID. Please upload a new photo."}</p>}
          {row.status === "submitted" ? (
            <p className="text-xs text-accent">Sent. Waiting for the studio to check it.</p>
          ) : (
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-accent-foreground">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Upload ID photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
          )}
        </div>
      )}
    </section>
  );
}
