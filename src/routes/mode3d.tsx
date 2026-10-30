import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Box,
  Columns2,
  CreditCard,
  PlayCircle,
  Ruler,
  ScanLine,
  Send,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { listMyScans } from "@/lib/scans.functions";
import { LocalModelPreview } from "@/components/LocalModelPreview";
import { seo } from "@/lib/seo";
import { tx, useUiLang } from "@/lib/uiLang";

export const Route = createFileRoute("/mode3d")({
  head: () => seo({
    path: "/mode3d",
    title: "3D Models & Private Body Scans — InkSimulator",
    description: "Preview an existing 3D model or review your private body scans. Model measurements are estimates that your tattoo artist should verify.",
    breadcrumb: "3D mode",
  }),
  component: Mode3DPage,
});

const TUTORIAL = [
  {
    icon: CreditCard,
    title: "1. Prepare a size reference",
    body: "Use an object with a known measurement. A bank card is 85.6 × 54 mm; business cards vary in size. Calibration is an estimate, not a precision guarantee.",
  },
  {
    icon: ScanLine,
    title: "2. Scan around the body part",
    body: "Follow the guide and move the camera slowly all the way around the arm or leg in a single recording.",
  },
  {
    icon: Box,
    title: "3. Get your 3D model",
    body: "Reconstruction requires the connected 3D service and may fail. A video alone is not a model. Once processing succeeds, rotate the model and inspect its estimated scale.",
  },
  {
    icon: Send,
    title: "4. Send it to the tattoo artist",
    body: "Choose what to share with your artist after inspecting the result. Your private scans are not a public gallery.",
  },
];

function statusLabel(s: string) {
  if (s === "ready") return "Ready";
  if (s === "processing") return "Processing";
  if (s === "failed") return "Failed";
  return "Uploaded";
}

function Mode3DPage() {
  const lang = useUiLang();
  const { user } = useAuth();
  const fetchScans = useServerFn(listMyScans);
  const { data: scans = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["my-scans", user?.id],
    queryFn: () => fetchScans(),
    enabled: !!user,
  });

  return (
    <AppShell>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {tx("Switch mode")}
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <Box className="size-5 text-accent" />
        <span className="text-mono-caps text-[10px] text-accent">{tx("3D mode")}</span>
      </div>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-balance">
        {tx("For curved surfaces — sleeves, arms, and legs")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        {tx("A real 3D model can be rotated and zoomed. Camera try-on is a separate tool. A personal body model requires reconstruction; final size and placement must be checked with your artist.")}
      </p>

      <LocalModelPreview />

      <ol className="mt-5 space-y-2.5">
        {TUTORIAL.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-slate p-3.5">
            <div className="size-8 shrink-0 rounded-lg bg-accent/15 grid place-items-center">
              <Icon className="size-4 text-accent" />
            </div>
            <div>
              <div className="text-[13px] font-bold leading-tight">{tx(title)}</div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{tx(body)}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link
        to="/scan-my-body"
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-ink font-bold text-[15px] active:scale-[0.98] transition"
      >
        <PlayCircle className="size-5" />
        {tx("Calibrate & scan")}
      </Link>

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">{tx("My scans")}</h2>
        {scans.filter((s) => s.status === "ready").length >= 2 && (
          <Link
            to="/scans/compare"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent"
          >
            <Columns2 className="size-3.5" />
            {tx("Compare two")}
          </Link>
        )}
      </div>

      {!user ? (
        <p className="mt-2 text-sm text-muted-foreground">
          <Link to="/auth" search={{ redirect: "/mode3d" }} className="text-accent font-bold">
            {tx("Sign in")}
          </Link>{" "}
          {tx("to save your 3D scans.")}
        </p>
      ) : isLoading ? (
        <div className="mt-3 h-20 rounded-2xl border border-white/10 bg-slate animate-pulse" />
      ) : isError ? (
        <div className="mt-3" role="alert"><p className="text-sm">{tx("Your scans could not be loaded.")}</p><button type="button" className="min-h-11 text-accent underline" onClick={() => void refetch()}>{tx("Try again")}</button></div>
      ) : scans.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {tx("No scans yet — make your first one above.")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2 pb-8">
          {scans.map((s) => (
            <li key={s.id}>
              <Link
                to="/scans/$id"
                params={{ id: s.id }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate p-3.5"
              >
                <div className="size-10 rounded-xl bg-ink grid place-items-center">
                  <Box className="size-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">
                    {s.bodyPart ?? tx("Body part")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString(lang === "sv" ? "sv-SE" : "en-US")} ·{" "}
                    {tx(statusLabel(s.status))}
                    {s.calibrated ? ` · ${tx("calibrated")}` : ""}
                  </div>
                </div>
                <Ruler className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
