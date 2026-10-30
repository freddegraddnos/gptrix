# Skapa-sidan enligt bild 07

Only the Create page (`/create`) changes. Nothing is published automatically, and the change is built in a separate draft. Direct try-on stays as it is; no motif preview card is added.

## What the visitor sees

- Small kicker "CREATE", the heading "MAKE IT YOURS" (Anton, white with violet glow) and the line "Start with an image, a word or an idea."
- Four large stacked cards on a dark surface with violet outlines and shadow, each with an icon and an arrow:
  1. **Upload a design**: "Make the background transparent." Opens /try-it-on.
  2. **Create a text tattoo**: "Choose a font. Make it personal." Opens /tattoo-font-generator.
  3. **Create with AI**: "Turn your description into a design." plus a small "Account required" line, because the AI tool really does ask you to sign in. Opens /generator.
  4. **Draw your design**: "Sketch, add lettering and refine." Opens the drawing app and returns to /create, as it does today.
- Below the cards, "Already have a motif in mind?" with two visible secondary links:
  - **Customise a motif**: the current "Create your own" (drawing app with the motif library open).
  - **Build a sleeve**: /sleeve-builder.

All six current destinations stay; only their order and look change. The bottom menu, the AR camera, the other pages, the data and the logins are not touched. The page title and description stay as they are.

## Checks
- Phone (390 px) and computer (1280 px) screenshots.
- Every card and link opens the right page, and Draw returns to /create.
- Keyboard focus is visible, and every tap target is at least 44 px.

## Technical
- Rewrite `CreatePage` in `src/routes/create.tsx` with a local card component that uses semantic tokens and the existing violet tokens. Keep `setPaintReturnTo` / `requestPaintMotifLibrary` exactly as they are.
- `HubCard` / `HubHeader` stay unchanged for the other pages that use them.
