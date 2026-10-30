import { publicSiteUrl } from "@/lib/publicOrigin";
/**
 * One-click approve / reject link from the studio approval email.
 * The token is single use and only ever arrives by email to InkSimulator.
 */
import { createFileRoute } from "@tanstack/react-router";
import { isStudioApprovalBearer, studioApprovalTokenDigest, studioApprovalTokenMatches } from "@/lib/studioApprovalToken";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/><title>${title} · InkSimulator</title></head>
<body style="font-family:Helvetica,Arial,sans-serif;background:#0d0f12;color:#f2f2f2;display:grid;place-items:center;height:100vh;margin:0">
<main style="max-width:420px;padding:32px;text-align:center">
<p style="letter-spacing:4px;font-size:12px;color:#00c2d1;margin:0 0 16px">INKSIMULATOR</p>
<h1 style="font-size:22px;margin:0 0 10px">${title}</h1>
<p style="font-size:15px;line-height:24px;color:#b9b9b9;margin:0">${body}</p>
</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/studio-approval")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const action = url.searchParams.get("action") ?? "";
        if (!isStudioApprovalBearer(token) || (action !== "approve" && action !== "reject")) {
          return page("Link not valid", "This approval link is incomplete.", 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("artist_profiles")
          .select("user_id, studio_name, contact_email, approval_token, approval_token_used_at")
          .in("approval_token", [await studioApprovalTokenDigest(token), token])
          .maybeSingle();

        if (!profile || !profile.approval_token || !(await studioApprovalTokenMatches(token, profile.approval_token))) {
          return page("Link not valid", "This approval link has already been used.", 404);
        }
        if (profile.approval_token_used_at) {
          return page("Already handled", "This studio request has already been decided.");
        }

        const approved = action === "approve";
        const { data: decision, error } = await supabaseAdmin
          .from("artist_profiles")
          .update({
            approval_status: approved ? "approved" : "rejected",
            ...(approved ? { status: "approved" } : {}),
            approved_at: approved ? new Date().toISOString() : null,
            approval_token_used_at: new Date().toISOString(),
            approval_token: null,
          })
          .eq("user_id", profile.user_id)
          .eq("approval_token", profile.approval_token)
          .is("approval_token_used_at", null)
          .select("id")
          .maybeSingle();
        if (error) return page("Something went wrong", "Please try again in a moment.", 500);
        if (!decision) return page("Already handled", "This studio request has already been decided.");

        if (profile.contact_email) {
          try {
            // One-click sign-in link → choose password → studio panel.
            let loginUrl: string | undefined;
            if (approved) {
              const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
              const authEmail = u?.user?.email;
              if (authEmail) {
                const { data: link } = await supabaseAdmin.auth.admin.generateLink({
                  type: "magiclink", email: authEmail,
                  options: { redirectTo: publicSiteUrl("/artists/set-password") },
                });
                loginUrl = link?.properties?.action_link;
              }
            }
            await sendTemplateEmail("studio-approval-result", profile.contact_email, {
              templateData: { studioName: profile.studio_name, approved, loginUrl },
              idempotencyKey: `studio-approval-result-${profile.user_id}-${action}`,
            });
          } catch {
            // The decision is saved even if the notification cannot be sent.
          }
        }

        return approved
          ? page(
              "Studio approved",
              `${escapeText(profile.studio_name ?? "The studio")} is now visible to clients.`,
            )
          : page(
              "Studio rejected",
              `${escapeText(profile.studio_name ?? "The studio")} stays hidden from search.`,
            );
      },
    },
  },
});
