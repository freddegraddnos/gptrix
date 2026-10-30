import { useState } from "react";
import { Link2, Check, X as XIcon, Eye, EyeOff } from "lucide-react";
import { SocialIcon } from "@/components/SocialIcon";
import { useSocialConnections } from "@/hooks/useSocialConnections";
import { PLATFORMS, type SocialPlatform } from "@/lib/socialAccounts";

/** "Connected accounts" in profile settings. */
export function ConnectedAccountsCard({ userId }: { userId?: string }) {
  const { connections, connect, setPublic, disconnect } = useSocialConnections(userId);
  const [openId, setOpenId] = useState<SocialPlatform | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const byId = (id: SocialPlatform) => connections.find((c) => c.platform === id);

  const submit = async (id: SocialPlatform) => {
    setError(null);
    const res = await connect(id, draft);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setOpenId(null);
    setDraft("");
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate p-4 mb-6">
      <div className="flex items-center gap-2 text-mono-caps text-[10px] text-accent">
        <Link2 className="size-3" />
        Connected accounts
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Connect your social accounts for faster sharing and to show them as icons
        on your public profile.
      </p>

      <div className="mt-3 space-y-2">
        {PLATFORMS.map((p) => {
          const conn = byId(p.id);
          const open = openId === p.id;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-ink px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span style={{ color: p.color }}>
                  <SocialIcon platform={p.id} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold">{p.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {conn?.username ? `@${conn.username}` : "Not connected"}
                  </div>
                </div>

                {conn ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void setPublic(p.id, !conn.is_public)}
                      title={conn.is_public ? "Shown publicly" : "Hidden on profile"}
                      className={`h-8 px-2 rounded-lg border text-[10px] uppercase tracking-widest flex items-center gap-1 ${
                        conn.is_public
                          ? "border-accent/60 text-accent"
                          : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      {conn.is_public ? (
                        <Eye className="size-3" />
                      ) : (
                        <EyeOff className="size-3" />
                      )}
                      {conn.is_public ? "Public" : "Hidden"}
                    </button>
                    <button
                      onClick={() => void disconnect(p.id)}
                      title="Disconnect"
                      className="h-8 w-8 rounded-lg border border-white/10 text-muted-foreground flex items-center justify-center"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setOpenId(open ? null : p.id);
                      setDraft("");
                      setError(null);
                    }}
                    className="h-8 px-3 rounded-lg border border-accent/60 text-accent text-[10px] font-bold uppercase tracking-widest"
                  >
                    Connect
                  </button>
                )}
              </div>

              {open && !conn && (
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 min-w-0 flex items-center h-10 rounded-lg bg-slate border border-white/10 px-3">
                    <span className="text-muted-foreground text-sm">@</span>
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="username or profile link"
                      className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-xs ml-1"
                    />
                  </div>
                  <button
                    onClick={() => void submit(p.id)}
                    className="h-10 w-10 rounded-lg border border-accent/60 text-accent flex items-center justify-center"
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              )}

              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
                {p.note}
              </p>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
