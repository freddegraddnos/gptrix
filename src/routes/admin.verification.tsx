import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  listVerificationSubmissions,
  reviewVerification,
  type VerificationSubmission,
} from "@/lib/verifyAdmin.functions";

export const Route = createFileRoute("/admin/verification")({
  head: () => ({
    meta: [
      { title: "Verification review — InkSimulator admin" },
      {
        name: "description",
        content:
          "Admin review of studio verification: approve or reject business documents and inspect one-time code history.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Verification review — InkSimulator admin" },
      {
        property: "og:description",
        content: "Approve or reject studio verification documents and audit OTP history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerificationAdminPage,
});

const FILTERS = ["pending", "verified", "rejected", "all"] as const;

function VerificationAdminPage() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("pending");
  const fetchList = useServerFn(listVerificationSubmissions);
  const review = useServerFn(reviewVerification);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["verification-submissions", status],
    queryFn: () => fetchList({ data: { status } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; action: "approve" | "reject"; note: string }) =>
      review({ data: { userId: vars.userId, action: vars.action, note: vars.note || null } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Review saved");
        void qc.invalidateQueries({ queryKey: ["verification-submissions"] });
      } else {
        toast.error(res.error);
      }
    },
    onError: () => toast.error("Could not save the review."),
  });

  return (
    <AppShell>
      <TopBar title="Verification review" />
      <main className="space-y-4 pb-24">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight">Studio verification</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Approve or reject submitted business documents and audit the one-time codes sent to each
            studio's contact email.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={status === f ? "default" : "outline"}
              onClick={() => setStatus(f)}
            >
              {f}
            </Button>
          ))}
        </div>

        {error && (
          <div className="flex gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            You need an admin account to view verification submissions.
          </div>
        )}

        {isLoading && (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        )}

        {data?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing to review with this filter.
          </p>
        )}

        <ul className="space-y-3">
          {(data ?? []).map((s) => (
            <SubmissionCard
              key={s.userId}
              submission={s}
              busy={mutation.isPending}
              onReview={(action, note) => mutation.mutate({ userId: s.userId, action, note })}
            />
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

function SubmissionCard({
  submission: s,
  busy,
  onReview,
}: {
  submission: VerificationSubmission;
  busy: boolean;
  onReview: (action: "approve" | "reject", note: string) => void;
}) {
  const [note, setNote] = useState(s.note ?? "");
  const [showOtp, setShowOtp] = useState(false);

  return (
    <li className="rounded-2xl border border-white/5 bg-slate p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{s.studioName}</span>
        {s.verified && <BadgeCheck className="size-4 text-accent" />}
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {s.status}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {s.city ?? "—"} · {s.contactEmail ?? "no email"}
        </span>
      </div>

      <dl className="mt-3 grid gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
        <div>
          Email verified:{" "}
          <span className="text-foreground">
            {s.emailVerifiedAt ? new Date(s.emailVerifiedAt).toLocaleString("en-US") : "no"}
          </span>
        </div>
        <div>
          Document sent:{" "}
          <span className="text-foreground">
            {s.documentSubmittedAt
              ? new Date(s.documentSubmittedAt).toLocaleString("en-US")
              : "no"}
          </span>
        </div>
        {s.website && (
          <div className="truncate">
            Website: <span className="text-foreground">{s.website}</span>
          </div>
        )}
        {s.handle && (
          <div>
            Handle: <span className="text-foreground">@{s.handle}</span>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {s.documentUrl ? (
          <a
            href={s.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[11px] font-bold uppercase tracking-widest"
          >
            <ExternalLink className="size-3.5" /> Open document
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground">No document uploaded</span>
        )}
        <Button size="sm" variant="outline" onClick={() => setShowOtp((v) => !v)}>
          <KeyRound className="mr-2 h-4 w-4" /> OTP history ({s.otps.length})
        </Button>
      </div>

      {showOtp && (
        <ul className="mt-3 space-y-1 rounded-xl border border-white/10 bg-background/50 p-3 text-[11px]">
          {s.otps.length === 0 && <li className="text-muted-foreground">No codes sent yet.</li>}
          {s.otps.map((o) => (
            <li key={o.id} className="flex flex-wrap gap-x-3 text-muted-foreground">
              <span className="text-foreground">{new Date(o.createdAt).toLocaleString("en-US")}</span>
              <span>{o.email}</span>
              <span>{o.consumedAt ? "used" : new Date(o.expiresAt).getTime() < Date.now() ? "expired" : "active"}</span>
              <span>{o.attempts} attempts</span>
            </li>
          ))}
        </ul>
      )}

      <Textarea
        className="mt-3"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Internal note shown to the studio (optional)"
      />

      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => onReview("approve", note)}>
          <BadgeCheck className="mr-2 h-4 w-4" /> Approve
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onReview("reject", note)}>
          <XCircle className="mr-2 h-4 w-4" /> Reject
        </Button>
      </div>
    </li>
  );
}
