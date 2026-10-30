import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Sparkles, Send, ImagePlus, Loader2, X } from "lucide-react";
import { askAdvisor } from "@/lib/advisor.functions";
import { markFlag } from "@/hooks/useJourney";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "AI Tattoo Advisor — InkSimulator" },
      {
        name: "description",
        content:
          "Ask InkSimulator's AI advisor about placement, size, and style — or upload a photo for personalized suggestions.",
      },
      { property: "og:title", content: "AI Tattoo Advisor — InkSimulator" },
      {
        property: "og:description",
        content: "Personalized tattoo advice from InkSimulator's AI — text or image.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/advisor" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/advisor" }],
  }),
  component: AdvisorPage,
});

type Msg = {
  role: "user" | "assistant";
  text: string;
  imageDataUrl?: string;
};

const SUGGESTIONS = [
  "A small bird on the wrist — what size and style?",
  "I want a geometric design on my upper arm",
  "Fine line vs blackwork for my first tattoo?",
  "How sore is it on the ribs?",
];

function AdvisorPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi! I'm your AI advisor for tattoos. Describe your idea in words, or upload a photo of a design / existing tattoo — and I'll give you advice on placement, size, and style.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
    markFlag("advisor");
  }, []);

  const handleFile = (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      alert("The image is too large (max 4 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPendingImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text && !pendingImage) return;
    if (loading) return;
    const userMsg: Msg = {
      role: "user",
      text: text || "What do you think of this?",
      imageDataUrl: pendingImage ?? undefined,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setPendingImage(null);
    setLoading(true);
    try {
      const result = await askAdvisor({
        data: {
          history: nextHistory.map((m) => ({
            role: m.role,
            text: m.text,
            imageDataUrl: m.imageDataUrl,
          })),
        },
      });
      if ("error" in result) {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: `⚠️ ${result.error}` },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: result.reply }]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `⚠️ ${e instanceof Error ? e.message : "Something went wrong"}`,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <AppShell>
      <header className="mb-4">
        <div className="flex items-center gap-2 text-mono-caps text-[10px] text-accent">
          <Sparkles className="size-3" />
          AI Advisor
        </div>
        <h1 className="mt-1 font-display font-bold text-2xl">Ask the advisor</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Personalized advice on placement, size, and style — text or image.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="rounded-2xl border border-white/10 bg-slate p-3 h-[52vh] overflow-y-auto flex flex-col gap-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-accent text-ink font-medium"
                  : "bg-ink border border-white/10"
              }`}
            >
              {m.imageDataUrl && (
                <img
                  src={m.imageDataUrl}
                  alt=""
                  className="mb-2 rounded-lg max-h-48 object-cover"
                />
              )}
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2 bg-ink border border-white/10 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Advisor is thinking…
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 rounded-full border border-white/10 bg-slate px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {pendingImage && (
        <div className="mt-3 relative inline-block">
          <img
            src={pendingImage}
            alt=""
            className="h-20 rounded-lg border border-white/10"
          />
          <button
            onClick={() => setPendingImage(null)}
            className="absolute -top-2 -right-2 size-6 rounded-full bg-ink border border-white/20 grid place-items-center"
            aria-label="Remove image"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="size-11 shrink-0 rounded-xl border border-white/10 bg-slate grid place-items-center hover:border-accent/40 transition-colors"
          aria-label="Attach image"
        >
          <ImagePlus className="size-4" />
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Type your question…"
          aria-label="Your question"
          className="flex-1 min-h-11 max-h-32 rounded-xl bg-slate border border-white/10 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-accent/60"
        />
        <button
          onClick={() => void send()}
          disabled={loading || (!input.trim() && !pendingImage)}
          className="size-11 shrink-0 rounded-xl bg-accent text-ink grid place-items-center disabled:opacity-40 active:scale-95 transition-transform"
          aria-label="Send"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </div>
    </AppShell>
  );
}
