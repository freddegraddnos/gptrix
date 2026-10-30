import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — InkSimulator" },
      {
        name: "description",
        content:
          "How InkSimulator handles camera frames, uploaded designs, saved placements and account data. Camera video stays on your device unless you save or share.",
      },
      { property: "og:title", content: "Privacy Policy — InkSimulator" },
      {
        property: "og:description",
        content:
          "Camera frames stay on your device. Here is exactly what InkSimulator stores and why.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://www.inksimulator.com/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/privacy" }],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  {
    h: "Your camera",
    p: "The camera is only used to place the design on your skin. Frames are processed on your device in real time and nothing is uploaded until you actively save or share a photo or video.",
  },
  {
    h: "What we store",
    p: "If you create an account we store your email, username, optional phone number, your self-declared 18+ status, saved placements, uploaded designs, vote sessions and any messages you send to studios. We use your contact details to notify you about bookings.",
  },
  {
    h: "What we do not do",
    p: "We do not sell your data, and we do not use your photos to train models.",
  },
  {
    h: "Sharing",
    p: "When you share to a social app, the image or video leaves InkSimulator and is handled by that app's own policy. Vote links are visible to anyone with the link.",
  },
  {
    h: "Your control",
    p: "You can delete individual placements and uploads at any time, or ask us to delete your whole account: hello@inksimulator.com",
  },
];

function PrivacyPage() {
  return (
    <AppShell showNav={false}>
      <TopBar title="Privacy" />
      <h1 className="font-display font-bold text-2xl">Privacy Policy</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Short version: the camera stays on your device.
      </p>
      <div className="mt-5 space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.h} className="rounded-2xl border border-white/10 bg-slate/60 p-4">
            <h2 className="font-semibold text-sm">{s.h}</h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>
      <Link
        to="/terms"
        className="mt-5 inline-flex h-11 items-center text-xs font-bold uppercase tracking-widest text-accent"
      >
        Terms of service →
      </Link>
    </AppShell>
  );
}
