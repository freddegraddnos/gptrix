import { publicSiteUrl } from "./publicOrigin";

/** Preserve existing crawler policy; only the deployment sitemap origin changes. */
export function robotsText(): string {
  return (
    "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: Claude-SearchBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /" +
    `\n\nSitemap: ${publicSiteUrl("/sitemap.xml")}\n`
  );
}
