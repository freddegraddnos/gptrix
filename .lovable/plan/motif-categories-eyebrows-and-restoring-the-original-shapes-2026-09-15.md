# Motif categories, eyebrows, and restoring the original shapes

The work is split into four separate steps, run one at a time so each can be checked
before the next starts.

## Step 1 — Japanese category (small)

"Realistic" already exists as a category; "Japanese" does not.

- Add **Japanese** to the category list used by the library, the sleeve builder and the gallery.
- Move the ten Japanese motifs (koi, oni mask, ryu dragon, sakura, hannya, ho-o phoenix,
  great waves, tiger in bamboo, geisha, kiku) into Japanese.
- Keep them findable by their current search words.

## Step 2 — Re-check every motif's category (medium)

Go through all motifs one by one and put each in the category it really belongs to,
now that both Japanese and Realistic exist. Portraits, eyes and skulls read as Realistic;
Japanese-style pieces move to Japanese; the rest stay as they are.
Nothing else about the motifs changes in this step.

## Step 3 — Remove the eyebrow from the eye motifs (small)

The eye motifs that include a brow get the brow removed, keeping the eye, lashes and the
shading around it intact, then each image is re-trimmed tight so its size stays truthful.
Affected: "Eye With Brow", "Soft Gaze Eye", "Realistic Eye" and the older all-seeing eye —
each is checked individually and only the brow is taken away.

## Step 4 — Restore the shapes that came out wrong (largest)

The last cleaning pass was run with a hard cut-off that also erased pale grey tones, so some
motifs lost parts of their outline and no longer match the pictures that were uploaded.

- The original uploads are still available, so every affected motif is re-made from its
  original instead of being patched.
- Cleaning is redone per image with a softer cut-off: white and near-white backgrounds go
  fully transparent, pale grey shading fades instead of disappearing, and the silhouette
  stays exactly as in the uploaded picture.
- Each result is compared side by side with the original upload, on both a dark and a
  skin-toned surface, before it replaces the current file.
- The corrected files are also re-uploaded to the gallery so library, sleeve builder,
  gallery and AR all show the same image.

## Technical notes

- `src/lib/tattoos.ts`: `TattooType` gains `"Japanese"`, added to `TYPES`; `type` corrected
  per entry. Category chips in `src/routes/library.tsx`, `src/routes/sleeve-builder.tsx`
  and `src/routes/shop.index.tsx` pick the new value up from `TYPES`; gallery rows in
  `marketplace_motifs` get their `category` updated with a targeted SQL update.
- Eyebrow removal via `imagegen--edit_image` (inpaint where a clean mask is possible),
  followed by the existing alpha-bbox crop with uniform padding.
- Step 4 re-runs a per-image variant of the cleaning script from `/mnt/user-uploads/*`
  with a soft luminance ramp (background-only flood from the border, interior pale tones
  kept at partial alpha) instead of the global hard threshold.
- Verification per step: zero opaque near-white pixels, before/after contact sheets,
  `bun test`, `tsgo --noEmit`, green build, and a 393px mobile pass over library,
  sleeve builder and gallery. The AR lock is untouched.
