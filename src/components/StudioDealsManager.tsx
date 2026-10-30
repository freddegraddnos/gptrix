import { useState } from "react";
import { Loader2, Percent, Plus, Trash2 } from "lucide-react";
import { useStudioDeals, useStudioTeam } from "@/hooks/useStudio";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

import { tx, useUiLang } from "@/lib/uiLang";
const fieldCls =
  "w-full h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm outline-none focus:border-accent";

/** Short-notice offers, e.g. a cancelled appointment at 50% off. */
export function StudioDealsManager({ studioId }: { studioId: string }) {
  useUiLang();
  const { deals, loading, add, update, remove } = useStudioDeals(studioId);
  const { team } = useStudioTeam(studioId);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [discount, setDiscount] = useState("");
  const [member, setMember] = useState("");
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);
  useUnsavedChangesGuard(title !== "" || desc !== "" || discount !== "" || member !== "" || ends !== "");

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    await add({
      title: title.trim(),
      description: desc.trim() || null,
      discount_percent: discount ? Number(discount) : null,
      member_id: member || null,
      ends_at: ends ? new Date(ends).toISOString() : null,
    });
    setTitle("");
    setDesc("");
    setDiscount("");
    setEnds("");
    setBusy(false);
  };

  return (
    <section className="mt-5 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-2">
        <p className="text-sm font-bold">{tx("New offer")}</p>
        <input
          className={fieldCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tx("e.g. Cancellation — book today")}
        />
        <textarea
          className="w-full min-h-16 rounded-xl bg-ink/60 border border-white/10 p-3 text-sm outline-none focus:border-accent"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={tx("Details, conditions, what's included…")}
        />
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm">
            <Percent className="size-4 text-accent" />
            <input
              type="number"
              min={0}
              max={100}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="50"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <input
            type="datetime-local"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            className="flex-1 h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <select
          value={member}
          onChange={(e) => setMember(e.target.value)}
          className={fieldCls}
        >
          <option value="">{tx("Whole studio")}</option>
          {team.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => void submit()}
          disabled={busy || !title.trim()}
          className="w-full h-11 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {tx("Publish offer")}
        </button>
      </div>

      {loading && <Loader2 className="mx-auto size-5 animate-spin text-accent" />}
      {!loading && deals.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {tx("No offers yet. Fill last-minute gaps by posting a discount.")}
        </p>
      )}

      {deals.map((d) => (
        <div key={d.id} className="rounded-2xl border border-white/5 bg-slate p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold flex-1 truncate">{d.title}</span>
            {d.discount_percent != null && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                -{d.discount_percent}%
              </span>
            )}
            <button onClick={() => void remove(d.id)} aria-label={tx("Remove offer")}>
              <Trash2 className="size-4 text-muted-foreground" />
            </button>
          </div>
          {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {d.member_id
                ? (team.find((t) => t.id === d.member_id)?.name ?? tx("Artist"))
                : tx("Whole studio")}
              {d.ends_at ? ` · until ${new Date(d.ends_at).toLocaleString()}` : ""}
            </span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={d.active}
                onChange={(e) => void update(d.id, { active: e.target.checked })}
                className="size-4"
              />
              {tx("Live")}
            </label>
          </div>
        </div>
      ))}
    </section>
  );
}
