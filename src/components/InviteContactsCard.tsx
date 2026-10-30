import { useEffect, useState } from "react";
import { Check, Contact, Copy, Loader2, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  canPickContacts,
  inviteChannels,
  inviteText,
  inviteUrl,
  pickContacts,
  type PickedContact,
} from "@/lib/inviteContacts";
import { copyToClipboard, shareLink } from "@/lib/share";

/**
 * Invite people to InkSimulator — from the phone's contact list where the browser
 * supports it, otherwise straight into SMS, WhatsApp, e-mail or a social app.
 */
export function InviteContactsCard({ referral }: { referral?: string }) {
  const [contacts, setContacts] = useState<PickedContact[]>([]);
  const [picking, setPicking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setSupported(canPickContacts()), []);

  const url = inviteUrl(referral);

  const openPicker = async () => {
    setPicking(true);
    try {
      const picked = await pickContacts();
      if (picked.length === 0) toast.info("No contacts picked.");
      setContacts(picked);
    } catch {
      toast.error("Could not open your contacts. Use SMS or share instead.");
    } finally {
      setPicking(false);
    }
  };

  const copy = async () => {
    const ok = await copyToClipboard(url);
    setCopied(ok);
    toast[ok ? "success" : "error"](ok ? "Invite link copied" : "Could not copy");
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
        <Send className="size-3" />
        Invite friends
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Invite from your phone contacts or send the link in any app — they land
        straight in the AR camera.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {supported && (
          <button
            type="button"
            onClick={() => void openPicker()}
            disabled={picking}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[12px] font-bold text-ink disabled:opacity-50"
          >
            {picking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Contact className="size-4" />
            )}
            Pick contacts
          </button>
        )}
        <button
          type="button"
          onClick={() => void shareLink(url, inviteText())}
          className="flex h-10 items-center gap-2 rounded-xl border border-white/12 px-3 text-[12px] font-bold"
        >
          <Share2 className="size-4" />
          Share invite
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex h-10 items-center gap-2 rounded-xl border border-white/12 px-3 text-[12px] font-bold"
        >
          {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
          Copy link
        </button>
      </div>

      {!supported && (
        <p className="mt-2 text-[11px] text-muted-foreground/80">
          Your browser can't open the contact list — the invite buttons below
          still work in Messages, WhatsApp and e-mail.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {(contacts.length > 0 ? contacts : [undefined]).map((c, i) => (
          <div
            key={c ? `${c.name}-${i}` : "generic"}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
          >
            {c && (
              <div className="mb-2 truncate text-[13px] font-bold">
                {c.name}
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  {c.tel ?? c.email}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {inviteChannels(url, inviteText(c?.name?.split(" ")[0]), c).map((ch) => (
                <a
                  key={ch.id}
                  href={ch.href}
                  target={ch.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="h-9 rounded-lg border border-white/12 bg-ink px-3 text-[12px] font-bold leading-9"
                >
                  {ch.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
