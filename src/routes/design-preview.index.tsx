import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { TATTOOS } from "@/lib/tattoos";

export const Route = createFileRoute("/design-preview/")({ component: DesignPreview });

const rows = [
  ["Primary button", "DM Mono", "15 px", "500", "12 px", "50 px", "Sentence case, white, dark text, subtle violet glow"],
  ["Secondary button", "DM Mono", "15 px", "500", "12 px", "50 px", "Dark outline"],
  ["Link styled as button", "DM Mono", "15 px", "500", "12 px", "50 px", "Same as primary/secondary"],
  ["Text link", "DM Mono", "13 px", "400", "—", "44 px", "Underlined"],
  ["Filter / language", "DM Mono", "13 px", "400", "20 px", "40 px", "Selected = violet tint, no weight change"],
  ["Field", "DM Mono", "16 px", "400", "12 px", "48 px", "Label 14 px above, violet focus, error below"],
  ["Card", "—", "—", "—", "24 px", "—", "Heading hierarchy kept"],
  ["Navigation card", "Anton + DM Mono", "20 / 14 px", "—", "24 px", "—", "Separate family: title + description"],
  ["Heading", "Anton", "28–72 px", "—", "—", "—", "Glow only on selected white main headings"],
];

function DesignPreview() {
  const [filter, setFilter] = useState("Fineline");
  const motif = TATTOOS[0];
  return <main className="studio-time-page ds-preview min-h-screen bg-background font-mono text-foreground">
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-10">
      <p className="text-xs text-muted-foreground">InkSimulator · Prompt 1</p>
      <h1 className="ds-glow-strong mt-3 font-display text-4xl uppercase leading-[1.04] md:text-6xl">Identity &amp; components</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">Design proposal only. Production pages are unchanged.</p>

      <nav className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/design-preview/for-studios" search={{ lang: "en" }} className="ds-navcard"><span className="block font-display text-xl uppercase">For studios</span><span className="mt-2 block text-sm text-muted-foreground">Proposal at 1440 / 1280 / 390 px</span></Link>
        <Link to="/design-preview/interest" search={{ lang: "en" }} className="ds-navcard"><span className="block font-display text-xl uppercase">Interest form</span><span className="mt-2 block text-sm text-muted-foreground">Proposal at 1440 / 1280 / 390 px</span></Link>
      </nav>

      <h2 className="mt-14 font-display text-2xl uppercase">Component table</h2>
      <div className="ds-card mt-4 overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-muted-foreground"><tr>{["Role", "Font", "Size", "Weight", "Radius", "Height", "Rule"].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r[0]} className="border-t border-border">{r.map((c, i) => <td key={i} className="px-4 py-3 align-top">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>

      <h2 className="mt-14 font-display text-2xl uppercase">States</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="ds-card space-y-3 border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Buttons — normal, focus, loading, disabled</p>
          <button type="button" className="btn-primary w-full justify-between">Register your interest<ArrowUpRight aria-hidden className="size-4" /></button>
          <button type="button" className="btn-primary w-full justify-between outline-2 outline-offset-[3px] outline-accent [outline-style:solid]">Register your interest (focus)<ArrowUpRight aria-hidden className="size-4" /></button>
          <button type="button" className="btn-primary w-full justify-center" disabled aria-busy><Loader2 aria-hidden className="size-4 animate-spin" />Sending…</button>
          <button type="button" className="btn-secondary w-full justify-between">Read the step-by-step guide<ArrowUpRight aria-hidden className="size-4" /></button>
          <button type="button" className="btn-secondary w-full" disabled>Disabled</button>
          <a href="mailto:fredrik@inksimulator.com" className="btn-link">Email us</a>
        </div>
        <div className="ds-card space-y-4 border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Fields — normal, focus, error</p>
          <div><label htmlFor="ds-a" className="field-label">Studio name</label><input id="ds-a" className="field-input" placeholder="Studio name" /></div>
          <div><label htmlFor="ds-b" className="field-label">Email</label><input id="ds-b" className="field-input border-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)]" defaultValue="studio@example.com" /></div>
          <div><label htmlFor="ds-c" className="field-label">Phone</label><input id="ds-c" className="field-input" aria-invalid="true" aria-describedby="ds-c-err" defaultValue="abc" /><p id="ds-c-err" className="field-error">Enter a valid phone number.</p></div>
          <p className="text-sm text-muted-foreground">Filters — selected</p>
          <div className="flex flex-wrap gap-2">{["Fineline", "Blackwork", "Traditional"].map(f => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="ds-filter">{f}</button>)}</div>
        </div>
      </div>

      <h2 className="mt-14 font-display text-2xl uppercase">Motif detail / photo entry</h2>
      <div className="ds-card mt-4 max-w-sm border border-border bg-card p-4">
        <div className="ds-media ds-card overflow-hidden"><img src={motif.src} alt={motif.name} className="aspect-square w-full object-contain" /></div>
        <h3 className="mt-4 font-display text-xl uppercase">{motif.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{motif.style}</p>
        <div className="mt-4 grid gap-3">
          <a href={`/ar?motif=${motif.id}`} className="btn-primary w-full justify-between">On me with the camera<Camera aria-hidden className="size-4" /></a>
          <a href={`/photo-tryon?motif=${motif.id}`} className="btn-secondary w-full justify-between">On a photo<ImageIcon aria-hidden className="size-4" /></a>
        </div>
      </div>
    </div>
  </main>;
}
