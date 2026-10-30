/** Send an SMS through 46elks. Never throws; returns ok/reason. */
export async function sendSms(to: string, message: string): Promise<{ ok: boolean; reason?: string }> {
  const user = process.env["ELKS_API_USERNAME"];
  const pass = process.env["ELKS_API_PASSWORD"];
  if (!user || !pass) return { ok: false, reason: "not_configured" };
  const phone = to.replace(/[\s-]/g, "");
  if (!/^\+\d{8,15}$/.test(phone)) return { ok: false, reason: "invalid_number" };
  try {
    const res = await fetch("https://api.46elks.com/a1/sms", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ from: "InkSimulato", to: phone, message: message.slice(0, 600) }),
    });
    if (!res.ok) {
      console.error("[sms] 46elks error", res.status, await res.text().catch(() => ""));
      return { ok: false, reason: "provider_error" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[sms] failed", e);
    return { ok: false, reason: "network_error" };
  }
}
