// Disposable PostgreSQL execution. No production connection or data.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE public.marketplace_motifs (id uuid PRIMARY KEY, artist_id uuid NOT NULL, price_ore integer, usage_terms text, published boolean);
    ALTER TABLE public.marketplace_motifs ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,UPDATE ON public.marketplace_motifs TO authenticated;
    CREATE POLICY "Auth users view published motifs" ON public.marketplace_motifs FOR SELECT TO authenticated USING (published OR auth.uid()=artist_id);
    CREATE POLICY "Artists update own motifs" ON public.marketplace_motifs FOR UPDATE TO authenticated USING (auth.uid()=artist_id);
    INSERT INTO public.marketplace_motifs VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',19900,'Existing digital terms',true);`);
  await db.exec(
    await readFile(
      new URL("../drizzle/migrations/0060_tattoo_offer_availability.sql", import.meta.url),
      "utf8",
    ),
  );
  const original = (await db.query("SELECT * FROM public.marketplace_motifs")).rows[0];
  assert.equal(original.tattoo_availability, null);
  assert.equal(original.price_ore, 19900);
  assert.equal(original.usage_terms, "Existing digital terms");
  await db.exec(
    `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)`,
  );
  await assert.rejects(
    db.exec(`UPDATE public.marketplace_motifs SET tattoo_availability='available'`),
    /tattoo_offer_requires_reuse/,
  );
  await db.exec(
    `UPDATE public.marketplace_motifs SET tattoo_availability='available',tattoo_reuse='unique',suggested_size_cm=12.5,tattoo_price_note='Consultation required'`,
  );
  await assert.rejects(
    db.exec(`UPDATE public.marketplace_motifs SET tattoo_availability='booked'`),
    /tattoo_offer_availability_valid/,
  );
  await assert.rejects(
    db.exec(`UPDATE public.marketplace_motifs SET suggested_size_cm='NaN'`),
    /tattoo_offer_size_valid/,
  );
  await assert.rejects(
    db.exec(`UPDATE public.marketplace_motifs SET tattoo_price_note=repeat('x',301)`),
    /tattoo_offer_price_note_length/,
  );
  await db.exec(
    `SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false); UPDATE public.marketplace_motifs SET tattoo_availability='reserved'`,
  );
  assert.equal(
    (await db.query("SELECT tattoo_availability FROM public.marketplace_motifs")).rows[0]
      .tattoo_availability,
    "available",
  );
  await db.exec(
    `SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false); UPDATE public.marketplace_motifs SET tattoo_availability='tattooed'`,
  );
  const final = (await db.query("SELECT * FROM public.marketplace_motifs")).rows[0];
  assert.equal(final.tattoo_availability, "tattooed");
  assert.equal(final.price_ore, 19900);
  assert.equal(final.usage_terms, "Existing digital terms");
  console.log(
    "PASS: legacy defaults, explicit repeatability, valid states, finite size, note length, nonowner denied, owner status update, digital terms/price preserved (8 PostgreSQL checks).",
  );
} finally {
  await db.close();
}
