// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  plugins: [mcpPlugin()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Static HTML for key public pages so crawlers and AI agents get full text without JS.
    pages: [
      { path: "/" },
      { path: "/for-studios" },
      { path: "/sv/for-studios" },
      { path: "/studio-guide" },
      { path: "/sv/studio-guide" },
      { path: "/studio-guide/setup" },
      { path: "/sv/studio-guide/setup" },
      { path: "/pricing" },
      { path: "/studios" },
      { path: "/ar" },
      { path: "/photo-tryon" },
      { path: "/about" },
      { path: "/sv/prova-tatuering" },
      { path: "/sv/tatuering-text" },
      { path: "/sv/texttatuering-ai-ar" },
      { path: "/sv/ai-tatuering" },
      { path: "/sv/skapa-tatuering" },
      { path: "/sv/skapa-tatueringsmotiv" },
      { path: "/sv/cover-up-tatuering" },
      { path: "/sv/prova-tatueringsmotiv" },
      { path: "/sv/romerska-siffror-tatuering" },
      { path: "/sv/fineline-tatuering" },
      { path: "/sv/realistisk-tatuering" },
      { path: "/sv/djur-tatuering" },
      { path: "/sv/tatueringsmotiv" },
      { path: "/sv/sma-tatueringar" },
      { path: "/sv/tatuering-blommor" },
      { path: "/sv/tatuering-fjaril" },
      { path: "/sv/tatuering-hjarta" },
      { path: "/sv/tatuering-kompass" },
      { path: "/sv/tatuering-fagel" },
      { path: "/sv/tatuering-stjarna" },
      { path: "/sv/tatuering-orm" },
      { path: "/sv/tatuering-ros" },
      { path: "/sv/tatuering-varg" },
      { path: "/sv/japansk-tatuering" },
      { path: "/sv/tatuering-placering" },
      { path: "/sv/pris-tatuering" },
      { path: "/sv/boka-tatuering" },
      { path: "/sv/tatuerare-stockholm" },
      { path: "/sv/tatuerare-goteborg" },
      { path: "/sv/tatuerare-malmo" },
      { path: "/sv/tatuerare-linkoping" },
      { path: "/sv/tatuerare-helsingborg" },
      { path: "/guides/placement-guide" },
    ],
    prerender: { enabled: true, autoStaticPathsDiscovery: false, crawlLinks: false },
  },
});
