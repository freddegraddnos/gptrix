import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ConnectedAccountsCard } from "@/components/ConnectedAccountsCard";
import { useAuth } from "@/hooks/useAuth";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/profile/accounts")({
  head: () => ({
    meta: [
      { title: tx("Connected accounts — InkSimulator") },
      {
        name: "description",
        content:
          "Connect X, Facebook, Instagram, and Snapchat to your InkSimulator profile for faster sharing of your AR try-ons.",
      },
      { property: "og:title", content: "Connected accounts — InkSimulator" },
      {
        property: "og:description",
        content: "Manage which social accounts are connected to your InkSimulator profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  useUiLang();
  const { user, loading } = useAuth();

  return (
    <AppShell>
      <Link
        to="/profile"
        className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {tx("Profile")}
      </Link>

      <h1 className="mt-3 text-2xl font-display font-bold tracking-tight">
        {tx("Connected accounts")}
      </h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {tx("Connect your social accounts when you want to share — it's not required to use the app.")}
      </p>

      {loading ? (
        <div className="h-40 rounded-2xl border border-white/10 bg-slate animate-pulse" />
      ) : user ? (
        <ConnectedAccountsCard userId={user.id} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate p-4 text-sm text-muted-foreground">
          {tx("Log in to connect your social accounts.")}{" "}
          <Link to="/auth" search={{ redirect: "/profile/accounts" }} className="text-accent font-bold">
            {tx("Log in")}
          </Link>
        </div>
      )}
    </AppShell>
  );
}
