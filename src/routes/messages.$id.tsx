import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { ArrowLeft, Send, Paperclip, X, Loader2 } from "lucide-react";
import { ChatAttachment } from "@/components/ChatAttachment";
import { uploadAttachment } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { useThread } from "@/hooks/useMessages";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/messages/$id")({
  head: ({ params }) => {
    const short = String(params.id).slice(0, 8);
    const title = `Conversation ${short} — InkSimulator Messages`;
    const description = `Private conversation ${short} with your tattoo artist or studio on InkSimulator.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        {
          property: "og:url",
          content: `https://www.inksimulator.com/messages/${params.id}`,
        },
      ],
    };
  },
  component: () => (
    <RequireAuth requireVerified title={tx("Sign in to open this chat")} description={tx("You need an account to message artists and studios.")}>
      <ThreadPage />
    </RequireAuth>
  ),
});

function ThreadPage() {
  useUiLang();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { messages, other, send } = useThread(id, user?.id);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files can be attached.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("The image is too large (max 8 MB).");
      return;
    }
    setUploadError(null);
    setPending({ file, preview: URL.createObjectURL(file) });
  };

  const submit = async () => {
    if (!text.trim() && !pending) return;
    setSending(true);
    const value = text;
    const attach = pending;
    setText("");
    setPending(null);
    try {
      let path: string | null = null;
      if (attach) {
        const ext = attach.file.name.split(".").pop()?.toLowerCase() ?? "png";
        path = await uploadAttachment(id, attach.file, ext);
      }
      await send(value, path);
      setUploadError(null);
    } catch {
      setUploadError("Could not send the attachment. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell showNav={false} fullBleed>
      <div className="h-[100dvh] flex flex-col">
        <header className="flex items-center gap-2 p-3 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
          <Link
            to="/messages"
            aria-label={tx("Back")}
            className="size-10 grid place-items-center rounded-xl text-muted-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="size-9 rounded-full overflow-hidden bg-slate border border-white/10 grid place-items-center">
            {other?.avatar_url ? (
              <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-accent">
                {(other?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">
              {other?.display_name ?? tx("Conversation")}
            </div>
            <div className="text-[10px] text-muted-foreground">{tx("Live")}</div>
          </div>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground mt-10">
              {tx("Write the first message.")}
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap space-y-2 ${
                      mine
                        ? "bg-accent text-ink rounded-br-sm"
                        : "bg-slate text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.attachment_path && (
                      <ChatAttachment path={m.attachment_path} />
                    )}
                    <div>{m.body}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2">
          {pending && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate p-2">
              <img
                src={pending.preview}
                alt=""
                className="size-12 rounded-lg object-cover bg-white"
              />
              <span className="flex-1 text-[11px] text-muted-foreground truncate">
                {pending.file.name}
              </span>
              <button
                onClick={() => setPending(null)}
                className="size-8 grid place-items-center rounded-lg text-muted-foreground"
                aria-label={tx("Remove attachment")}
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          {uploadError && (
            <p className="text-[11px] text-red-400">{uploadError}</p>
          )}
          <div className="flex gap-2">
          <label
            className="h-11 w-11 rounded-xl bg-slate border border-white/10 grid place-items-center cursor-pointer text-muted-foreground"
            aria-label={tx("Send a design")}
            title={tx("Send a design straight to this client — it stays private, nothing is published to the library")}
          >
            <Paperclip className="size-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={tx("Write a message…")}
            maxLength={2000}
            className="flex-1 h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={submit}
            disabled={(!text.trim() && !pending) || sending}
            className="h-11 w-11 rounded-xl bg-accent text-ink grid place-items-center disabled:opacity-40"
            aria-label={tx("Send")}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
