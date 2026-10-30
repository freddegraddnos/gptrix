import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/google-calendar/return")({
  component: OAuthReturn,
  head: () => ({
    meta: [
      { title: "Connecting Google Calendar | InkSimulator" },
      { name: "description", content: "Finishing the Google Calendar connection for your studio." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Connecting Google Calendar | InkSimulator" },
      { property: "og:description", content: "Finishing the Google Calendar connection for your studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_calendar", code: code ?? null },
        window.location.origin,
      );
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "The connection did not complete.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("The connection completed without a code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
      <h1 className="sr-only">Connecting Google Calendar</h1>
      <p>{message}</p>
    </main>
  );
}
