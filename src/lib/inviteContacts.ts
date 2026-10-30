/**
 * Invite friends from the phone's contacts or from social apps.
 *
 * The Contact Picker API (`navigator.contacts.select`) is only available in
 * Chrome/Android over HTTPS, and it never hands us the address book without an
 * explicit user pick — so it is a progressive enhancement: when it is missing
 * we fall back to SMS / WhatsApp / e-mail / the OS share sheet.
 */

export type PickedContact = { name: string; tel?: string; email?: string };

type ContactsManager = {
  select: (
    props: string[],
    opts?: { multiple?: boolean },
  ) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>;
  getProperties?: () => Promise<string[]>;
};

type NavWithContacts = Navigator & { contacts?: ContactsManager };

/** True when the browser can open the native contact picker. */
export function canPickContacts(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavWithContacts;
  return typeof nav.contacts?.select === "function";
}

/** Opens the OS contact picker and returns the contacts the user chose. */
export async function pickContacts(): Promise<PickedContact[]> {
  const nav = navigator as NavWithContacts;
  if (!nav.contacts?.select) return [];
  const picked = await nav.contacts.select(["name", "tel", "email"], {
    multiple: true,
  });
  return picked
    .map((c) => ({
      name: c.name?.[0]?.trim() || c.tel?.[0] || c.email?.[0] || "Contact",
      tel: c.tel?.[0],
      email: c.email?.[0],
    }))
    .filter((c) => c.tel || c.email);
}

/** The personal invite link — carries the inviter so we can greet by name. */
export function inviteUrl(handleOrId?: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.inksimulator.com";
  const url = new URL("/ar", origin);
  url.searchParams.set("utm_source", "invite");
  if (handleOrId) url.searchParams.set("ref", handleOrId);
  return url.toString();
}

export function inviteText(firstName?: string): string {
  const hi = firstName ? `${firstName}, ` : "";
  return `${hi}try a tattoo on your own skin in AR with me on InkSimulator`;
}

/** Ready-made invite links per channel for one contact (or a blank invite). */
export function inviteChannels(
  url: string,
  text: string,
  contact?: PickedContact,
): { id: string; label: string; href: string }[] {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  const list: { id: string; label: string; href: string }[] = [];
  if (contact?.tel) {
    list.push({ id: "sms", label: "SMS", href: `sms:${contact.tel}?&body=${t}%20${u}` });
    list.push({
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/${contact.tel.replace(/[^\d]/g, "")}?text=${t}%20${u}`,
    });
  } else {
    list.push({ id: "sms", label: "SMS", href: `sms:?&body=${t}%20${u}` });
    list.push({ id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` });
  }
  list.push({
    id: "email",
    label: "E-mail",
    href: `mailto:${contact?.email ?? ""}?subject=${encodeURIComponent("Try this tattoo on in AR")}&body=${t}%20${u}`,
  });
  list.push({
    id: "messenger",
    label: "Messenger",
    href: `https://www.facebook.com/dialog/send?link=${u}&app_id=291494419107518&redirect_uri=${u}`,
  });
  list.push({
    id: "facebook",
    label: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`,
  });
  list.push({ id: "x", label: "X", href: `https://x.com/intent/post?text=${t}&url=${u}` });
  list.push({
    id: "snapchat",
    label: "Snapchat",
    href: `https://www.snapchat.com/scan?attachmentUrl=${u}`,
  });
  return list;
}
