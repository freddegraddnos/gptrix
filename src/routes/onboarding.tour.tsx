import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import arImg from "@/assets/onboard-ar.jpg";
import shareImg from "@/assets/onboard-share.jpg";
import saveImg from "@/assets/onboard-save.jpg";
import artistsImg from "@/assets/onboard-artists.jpg";

export const Route = createFileRoute("/onboarding/tour")({
  head: () => ({
    meta: [
      { title: "Get Started with InkSimulator" },
      {
        name: "description",
        content:
          "A quick tour of InkSimulator: try tattoos in real time, share with friends, save favorites, and find tattoo artists.",
      },
      { property: "og:title", content: "Get Started with InkSimulator" },
      {
        property: "og:description",
        content: "Three quick steps before you try your first tattoo in AR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingTour,
});

const STEPS = [
  {
    image: arImg,
    title: "Try tattoos in real time",
    body: "Point the camera at your arm and see the design at the right size directly on your skin.",
  },
  {
    image: shareImg,
    title: "Share with friends and get their opinion",
    body: "Send a voting link — friends respond without downloading anything.",
  },
  {
    image: saveImg,
    title: "Save your favorites with the star",
    body: "Bookmark designs you like and find them again under Bookmarked.",
  },
  {
    image: artistsImg,
    title: "Find the right tattoo artist",
    body: "Search studios near you and send your idea directly in the app.",
  },
];

export function markOnboardingDone(userId: string | undefined) {
  try {
    localStorage.setItem("iv_onboarding_done", "1");
  } catch {
    /* ignore */
  }
  if (!userId) return Promise.resolve();
  return supabase
    .from("profiles")
    .update({ onboarding_done: true })
    .eq("id", userId)
    .then(() => undefined);
}

function OnboardingTour() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const finish = async () => {
    await markOnboardingDone(user?.id);
    navigate({ to: "/calibrate" });
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col px-5 pt-6 pb-8">
      {/* Progress */}
      <div className="flex items-center gap-1.5" aria-label="Progress">
        {STEPS.map((s, idx) => (
          <span
            key={s.title}
            className={`h-1 flex-1 rounded-full transition-colors ${
              idx <= i ? "bg-accent" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 h-6">
        {!last && (
          <button
            type="button"
            onClick={finish}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <img
          key={step.image}
          src={step.image}
          alt={step.title}
          width={1024}
          height={1024}
          loading={i === 0 ? "eager" : "lazy"}
          className="w-full max-w-xs aspect-square rounded-3xl border border-white/10 object-cover animate-in fade-in duration-300"
        />
        <div className="mt-6 text-mono-caps text-[10px] text-accent">
          {i + 1} av {STEPS.length}
        </div>
        <h1 className="mt-2 text-2xl font-display font-bold tracking-tight text-balance">
          {step.title}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{step.body}</p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => (last ? void finish() : setI((n) => n + 1))}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-foreground"
        >
          {last ? "Get Started" : "Next"}
          {last ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
        </button>
      </div>
    </div>
  );
}
