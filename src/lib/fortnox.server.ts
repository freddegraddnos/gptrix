import { createHmac, timingSafeEqual } from "node:crypto";

/** Fortnox OAuth + API helpers. Server only. */

const AUTH_BASE = "https://apps.fortnox.se/oauth-v1";
const API_BASE = "https://api.fortnox.se/3";
export const FORTNOX_SCOPES = "customer invoice payment bookkeeping companyinformation settings";

/** InkSimulator commission rates. */
export const COMMISSION = { tattoo: 0.05, motif: 0.05 } as const;

export function fortnoxConfig() {
  const clientId = process.env["FORTNOX_CLIENT_ID"];
  const clientSecret = process.env["FORTNOX_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function redirectUri(origin: string) {
  return `${origin}/api/public/fortnox/callback`;
}

export function signState(studioId: string, origin: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ s: studioId, o: origin, t: Date.now() })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(state: string, secret: string): { studioId: string; origin: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      s: string;
      o: string;
      t: number;
    };
    if (Date.now() - data.t > 30 * 60 * 1000) return null;
    return { studioId: data.s, origin: data.o };
  } catch {
    return null;
  }
}

export function authorizeUrl(clientId: string, origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    scope: FORTNOX_SCOPES,
    state,
    access_type: "offline",
    response_type: "code",
  });
  return `${AUTH_BASE}/auth?${p}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const cfg = fortnoxConfig();
  if (!cfg) throw new Error("Fortnox is not set up for this app yet.");
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    console.error("[fortnox] token error", res.status, await res.text());
    throw new Error("Fortnox did not accept the sign-in.");
  }
  return (await res.json()) as TokenResponse;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function exchangeCodeAndSave(studioId: string, code: string, origin: string) {
  const t = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin),
  });
  let companyName: string | null = null;
  try {
    const res = await fetch(`${API_BASE}/companyinformation`, {
      headers: { Authorization: `Bearer ${t.access_token}`, Accept: "application/json" },
    });
    if (res.ok) companyName = (await res.json())?.CompanyInformation?.CompanyName ?? null;
  } catch {
    /* optional */
  }
  const db = await admin();
  const { error } = await db.from("studio_fortnox_links").upsert({
    studio_id: studioId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    company_name: companyName,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export type FortnoxLink = {
  studio_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  sales_account: number;
  vat_percent: number;
  payment_account: number;
  fee_account: number;
};

async function getLink(studioId: string): Promise<FortnoxLink> {
  const db = await admin();
  const { data } = await db
    .from("studio_fortnox_links")
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!data) throw new Error("Connect Fortnox first.");
  let link = data as FortnoxLink;
  if (new Date(link.expires_at).getTime() - Date.now() < 60_000) {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: link.refresh_token });
    const update = {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.from("studio_fortnox_links").update(update).eq("studio_id", studioId);
    link = { ...link, ...update };
  }
  return link;
}

async function api<T = any>(link: FortnoxLink, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${link.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[fortnox] api error", method, path, res.status, text);
    let msg = "Fortnox rejected the request.";
    try {
      msg = JSON.parse(text)?.ErrorInformation?.message ?? msg;
    } catch {
      /* keep default */
    }
    throw new Error(`Fortnox: ${msg}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function findOrCreateCustomer(link: FortnoxLink, name: string, email: string | null) {
  if (email) {
    const found = await api(link, "GET", `/customers?email=${encodeURIComponent(email)}`);
    const hit = found?.Customers?.[0]?.CustomerNumber;
    if (hit) return String(hit);
  }
  const created = await api(link, "POST", "/customers", {
    Customer: { Name: name || email || "InkSimulator customer", ...(email && { Email: email }), Type: "PRIVATE" },
  });
  return String(created.Customer.CustomerNumber);
}

/**
 * Creates a paid invoice (VAT included) and books InkSimulator's commission as a
 * cost against the payment account. Returns the invoice number.
 */
export async function exportSale(
  studioId: string,
  sale: {
    customerName: string;
    customerEmail: string | null;
    description: string;
    amountOre: number;
    commissionRate: number;
    date: string;
    reference: string;
  },
) {
  const link = await getLink(studioId);
  const customerNumber = await findOrCreateCustomer(link, sale.customerName, sale.customerEmail);
  const kr = sale.amountOre / 100;
  const day = sale.date.slice(0, 10);

  const inv = await api(link, "POST", "/invoices", {
    Invoice: {
      CustomerNumber: customerNumber,
      InvoiceDate: day,
      DueDate: day,
      VATIncluded: true,
      YourReference: sale.reference.slice(0, 50),
      InvoiceRows: [
        {
          Description: sale.description.slice(0, 50),
          AccountNumber: link.sales_account,
          DeliveredQuantity: 1,
          Price: kr,
          VAT: link.vat_percent,
        },
      ],
    },
  });
  const invoiceNumber = String(inv.Invoice.DocumentNumber);
  await api(link, "PUT", `/invoices/${invoiceNumber}/bookkeep`);

  await api(link, "POST", "/invoicepayments", {
    InvoicePayment: {
      InvoiceNumber: Number(invoiceNumber),
      Amount: kr,
      PaymentDate: day,
      ModeOfPaymentAccount: link.payment_account,
    },
  });

  const fee = Math.round(kr * sale.commissionRate * 100) / 100;
  if (fee > 0) {
    await api(link, "POST", "/vouchers", {
      Voucher: {
        Description: `InkSimulator commission ${Math.round(sale.commissionRate * 100)}% — invoice ${invoiceNumber}`.slice(0, 200),
        TransactionDate: day,
        VoucherSeries: "A",
        VoucherRows: [
          { Account: link.fee_account, Debit: fee, Credit: 0 },
          { Account: link.payment_account, Debit: 0, Credit: fee },
        ],
      },
    });
  }
  return invoiceNumber;
}
