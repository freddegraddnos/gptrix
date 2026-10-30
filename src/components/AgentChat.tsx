import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";

const T = {
  sv: {
    notActive: "Bokningsassistenten är inte aktiv", notActiveBody: "Den här studion har inte slagit på sin bokningsassistent än.", browse: "Se studios",
    hi: (n: string, c: string | null) => `Hej! Jag är bokningsassistent för ${n}${c ? ` i ${c}` : ""}. Berätta om din tatueringsidé — placering och storlek — så ger jag ett prisförslag och hittar en ledig tid. (You can also write in English.)`,
    busy: "Många chattar just nu — försök igen om en stund.", err: "Något gick fel. Försök igen.", conn: "Anslutningsproblem. Försök igen.",
    typing: "Skriver…", placeholder: "Skriv ett meddelande…", send: "Skicka", msg: "Meddelande",
  },
  en: {
    notActive: "Booking assistant not active", notActiveBody: "This studio has not turned on its booking assistant yet.", browse: "Browse studios",
    hi: (n: string, c: string | null) => `Hi! I'm the booking assistant for ${n}${c ? ` in ${c}` : ""}. Tell me about your tattoo idea — placement and size — and I'll give an estimate and find a free time. (Du kan också skriva på svenska.)`,
    busy: "Many people are chatting right now — try again in a moment.", err: "Sorry, something went wrong. Try again.", conn: "Connection problem. Try again.",
    typing: "Typing…", placeholder: "Write a message…", send: "Send", msg: "Message",
  },
};

type Msg = { role: "user" | "assistant"; content: string };

function sessionKey(handle: string) {
  const k = `inksimulator.agent.${handle}`;
  let v = localStorage.getItem(k);
  if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
  return v;
}

export type AgentStudio = { name: string; city: string | null; handle: string; enabled: boolean; lang: "sv" | "en" } | null;

export function AgentChat({ studio, handle }: { studio: AgentStudio; handle: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const t = T[studio?.lang ?? "en"];
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = text.trim();
    if (!m || busy) return;
    setText("");
    setMsgs((x) => [...x, { role: "user", content: m }]);
    setBusy(true);
    try {
      const res = await fetch(`/api/public/agent/${encodeURIComponent(handle)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: sessionKey(handle), message: m }),
      });
      const j = (await res.json()) as { reply?: string; error?: string };
      setMsgs((x) => [...x, { role: "assistant", content: j.reply ?? (j.error === "busy" ? t.busy : t.err) }]);
    } catch {
      setMsgs((x) => [...x, { role: "assistant", content: t.conn }]);
    } finally { setBusy(false); }
  };

  return (
    <main lang={studio?.lang ?? "en"} className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b-2 border-foreground px-4 py-3">
        <Link to="/" aria-label="InkSimulator home"><InkSimulatorLockup markClassName="h-8 w-8" /></Link>
        <span className="h-6 w-px bg-foreground/40" />
        <h1 className="font-display uppercase text-lg tracking-wide truncate">{studio?.name ?? handle}</h1>
      </header>
      {!studio || !studio.enabled ? (
        <section className="flex-1 grid place-items-center p-8 text-center">
          <div>
            <p className="font-display uppercase text-2xl">{t.notActive}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.notActiveBody}</p>
            <Link to="/studios" className="mt-4 inline-block underline">{t.browse}</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
            <div className="rounded-2xl border-2 border-foreground bg-card p-3 text-sm">
              {t.hi(studio.name, studio.city)}
            </div>
            {msgs.map((m, i) => (
              <div key={i} className={`rounded-2xl p-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "ml-10 bg-primary text-primary-foreground" : "mr-10 border-2 border-foreground bg-card"}`}>{m.content}</div>
            ))}
            {busy && <div className="mr-10 rounded-2xl border-2 border-foreground bg-card p-3 text-sm text-muted-foreground">{t.typing}</div>}
            <div ref={end} />
          </section>
          <form onSubmit={send} className="sticky bottom-0 border-t-2 border-foreground bg-background p-3 flex gap-2 max-w-2xl w-full mx-auto">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} placeholder={t.placeholder} aria-label={t.msg}
              className="flex-1 h-11 rounded-xl border-2 border-foreground bg-background px-3 text-sm" />
            <button disabled={busy || !text.trim()} className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-display uppercase disabled:opacity-50">{t.send}</button>
          </form>
        </>
      )}
    </main>
  );
}
