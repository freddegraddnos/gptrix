// Run with node; PGLITE_MODULE can point to an external test-tools installation.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE public.marketplace_motifs (id uuid PRIMARY KEY);
    CREATE TABLE public.artist_client_projects (id uuid PRIMARY KEY, title text);
    INSERT INTO public.marketplace_motifs VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');`);
  await db.exec(
    await readFile(
      new URL("../drizzle/migrations/0058_request_motif_context.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`INSERT INTO public.artist_client_projects VALUES
    ('33333333-3333-4333-8333-333333333333', 'Original enquiry', '11111111-1111-4111-8111-111111111111', '{"name":"Original design"}');`);
  await assert.rejects(
    db.exec(
      `UPDATE public.artist_client_projects SET source_motif_snapshot = '{"name":"Changed"}'`,
    ),
    /snapshot is immutable/,
  );
  await assert.rejects(
    db.exec(
      `UPDATE public.artist_client_projects SET source_motif_id = '22222222-2222-4222-8222-222222222222'`,
    ),
    /identity is immutable/,
  );
  await assert.rejects(
    db.exec(`UPDATE public.artist_client_projects SET source_motif_id = NULL`),
    /identity is immutable/,
  );
  await db.exec(`UPDATE public.artist_client_projects SET title = 'Ordinary update';`);
  assert.equal(
    (await db.query("SELECT title FROM public.artist_client_projects")).rows[0].title,
    "Ordinary update",
  );
  await db.exec(
    `DELETE FROM public.marketplace_motifs WHERE id = '11111111-1111-4111-8111-111111111111'`,
  );
  const row = (
    await db.query(
      "SELECT source_motif_id, source_motif_snapshot FROM public.artist_client_projects",
    )
  ).rows[0];
  assert.equal(row.source_motif_id, null);
  assert.deepEqual(row.source_motif_snapshot, { name: "Original design" });
  console.log(
    "PASS: snapshot immutable; motif ID cannot be replaced/unlinked; normal update preserved; deletion retains snapshot (5 PostgreSQL checks).",
  );
} finally {
  await db.close();
}
