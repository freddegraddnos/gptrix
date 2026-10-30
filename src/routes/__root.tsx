import { publicSiteUrl } from "@/lib/publicOrigin";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { TATTOO_FONTS_HREF } from "../lib/tattooFonts";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useAuth } from "../hooks/useAuth";
import { useSubscription } from "../hooks/useSubscription";
import { useRedeemPendingReferral } from "../hooks/useReferral";
import { Toaster } from "../components/ui/sonner";
import { PendingTryOnResumer } from "../components/PendingTryOnResumer";
import { UsernameGate } from "../components/UsernameGate";
import { InstallPrompt } from "../components/InstallPrompt";
import { useStudioTheme } from "../lib/studioTheme";
import { markUiHydrated, useUiLang } from "../lib/uiLang";
import { StudioModeBar } from "../components/StudioModeBar";

/** Ink-and-violet mark used on empty / error screens instead of browser chrome. */
function InkMark({ cracked = false }: { cracked?: boolean }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className="mx-auto size-20 text-accent"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="38" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="48" cy="48" r="26" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="6 8" />
      {cracked ? (
        <path d="M40 30 L52 46 L42 52 L56 68" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M48 32 C58 44 62 52 62 58 a14 14 0 0 1 -28 0 c0 -6 4 -14 14 -26 Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <InkMark />
        <div className="mt-4 text-mono-caps text-[10px] text-accent">404</div>
        <h1 className="mt-2 text-3xl font-display font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find what you were looking for.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
        >
          Open camera
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    // A stale cached app version can't load new page files after a publish —
    // reload once to pick up the current version.
    const msg = error instanceof Error ? error.message : String(error);
    if (/dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|Loading chunk/i.test(msg)) {
      if (!sessionStorage.getItem("ink-chunk-reload")) {
        sessionStorage.setItem("ink-chunk-reload", "1");
        void navigator.serviceWorker?.getRegistrations?.().then((rs) => rs.forEach((r) => r.update()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <InkMark cracked />
        <div className="mt-4 text-mono-caps text-[10px] text-accent">Error</div>
        <h1 className="mt-2 text-xl font-display font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again or go back to the camera.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground/70 break-words">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
          >
            Try again
          </button>
          <a
            href="/"
            className="h-11 px-5 inline-flex items-center rounded-xl border border-white/10 text-foreground font-bold text-sm"
          >
            To the camera
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#050505" },
      { name: "author", content: "InkSimulator" },
      {
        name: "google-site-verification",
        content: "e0VXmGK7kiI3_mCW6bDFxCZAziN2dLHqVlSBj1YbqgU",
      },
      {
        name: "google-site-verification",
        content: "i-KMAL6TrfN6TBoyBp5Qn5sNyWB32zMuYu9hp8EAthk",
      },
      {
        name: "google-site-verification",
        content: "JPTevx2HUjwRGwbNOb3RpN9oIEA5C_AO5qDsASn0ODk",
      },
      {
        name: "google-site-verification",
        content: "ydeRJ77EverwD-UhhPzY1uwFCUar27pys9QcBwRavTM",
      },
      {
        name: "facebook-domain-verification",
        content: "wu1cwpfngvzgopk1pg5tqp4373gjvo",
      },
      { property: "og:site_name", content: "InkSimulator" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "InkSimulator" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png?v=20261013", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png?v=20261013" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&family=Bodoni+Moda:opsz,wght@6..96,600&family=DM+Mono:wght@300;400;500&family=IBM+Plex+Mono:wght@400&family=Inter:wght@400&display=swap",
      },
      { rel: "stylesheet", href: TATTOO_FONTS_HREF },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": publicSiteUrl("/#organization"),
              name: "InkSimulator",
              url: publicSiteUrl("/"),
              slogan: "Try it before it's forever",
              description: "InkSimulator is a free web app for trying tattoos on your own skin in live AR at true 1:1 scale, or on a photo, before booking a tattoo artist.",
              logo: publicSiteUrl("/brand/inksimulator-logo.png"),
            },
            {
              "@type": "WebSite",
              "@id": publicSiteUrl("/#website"),
              name: "InkSimulator",
              alternateName: ["InkSimulator AR", "inksimulator.com"],
              url: publicSiteUrl("/"),
              inLanguage: "en",
              publisher: { "@id": publicSiteUrl("/#organization") },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }): ReactElement {
  const pathname: string = useRouterState({ select: (s) => s.location.pathname });
  const inner = (
    <>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </>
  );
  // Swedish public pages declare sv on <html>; everything else is en.
  return pathname.startsWith("/sv/") ? (
    <html lang="sv" className="theme-ink theme-violet">{inner}</html>
  ) : (
    <html lang="en" className="theme-ink theme-violet">{inner}</html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionSync />
      <UiLangSync pathname={pathname} />
      <UsernameGate />
      <StudioModeBar pathname={pathname} />
      <StudioThemeBoundary pathname={pathname}><div className={pathname === "/" ? "" : "light-actions"}><Outlet /></div></StudioThemeBoundary>
      <InstallPrompt />
      <Toaster />
      <PendingTryOnResumer />
    </QueryClientProvider>
  );
}

/** Switch fixed interface text to the chosen language after hydration and keep <html lang> truthful. */
function UiLangSync({ pathname }: { pathname: string }) {
  const lang = useUiLang();
  useEffect(() => { markUiHydrated(); }, []);
  useEffect(() => {
    document.documentElement.lang = pathname.startsWith("/sv/") ? "sv" : lang;
  }, [lang, pathname]);
  return null;
}

/** Keep saved studio appearance on its working pages, never on customer or AR pages. */
function StudioThemeBoundary({ pathname, children }: { pathname: string; children: ReactNode }) {
  const [theme] = useStudioTheme();
  const [studioNotices, setStudioNotices] = useState(false);
  useEffect(() => {
    setStudioNotices(pathname === "/notifications" && sessionStorage.getItem("inksimulator.studio-notifications") === "1");
    if (pathname !== "/notifications" && !pathname.startsWith("/artists/")) sessionStorage.removeItem("inksimulator.studio-notifications");
  }, [pathname]);
  const studioPage = (pathname.startsWith("/artists/") && !["/artists/browse", "/artists/search", "/artists/set-password"].some(p => pathname.startsWith(p))) || (pathname === "/notifications" && studioNotices);
  return <div className={studioPage && theme === "bright" ? "studio-bright" : ""}>{children}</div>;
}



function SubscriptionSync() {
  // Runs the DB→localStorage sync of active plan status once at app boot
  // so gating works across sessions and devices. Also redeems any pending
  // /i/{code} referral as soon as a user is signed in.
  const { user } = useAuth();
  useSubscription(user?.id);
  useRedeemPendingReferral();
  useEffect(() => {
    void import("@/lib/track").then((m) => m.installFunnelTracking());
  }, []);

  useEffect(() => {
    if (!user?.id) {
      void import("@/lib/myMotifsSync").then((m) => m.resetMyMotifsSync());
      return;
    }
    void import("@/lib/myMotifsSync").then((m) => m.syncMyMotifs(user.id));
  }, [user?.id]);
  return null;
}
