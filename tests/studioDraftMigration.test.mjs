// Run with PGLITE_MODULE set to an installed @electric-sql/pglite module path.
// No service, email, network or production database is contacted.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE ?? "@electric-sql/pglite");
const db = new PGlite();
const user = "00000000-0000-0000-0000-000000000001";
const unconfirmed = "00000000-0000-0000-0000-000000000002";
const teammate = "00000000-0000-0000-0000-000000000003";
const outsider = "00000000-0000-0000-0000-000000000004";
const admin = "00000000-0000-0000-0000-000000000005";
const schema = `
 CREATE ROLE authenticated NOLOGIN;
 CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;
 CREATE TYPE public.app_role AS ENUM ('admin','user');
 CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT _user_id='${admin}'::uuid AND _role='admin' $$;
 CREATE TABLE public.studio_members(studio_id uuid,user_id uuid,status text,role text);
 GRANT SELECT ON public.studio_members TO authenticated;
 CREATE FUNCTION public.is_studio_admin(_studio uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
 SELECT _studio=_user OR EXISTS(SELECT 1 FROM public.studio_members WHERE studio_id=_studio AND user_id=_user AND status='active' AND role='admin') $$;
 CREATE TABLE public.artist_profiles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES auth.users(id),
 studio_name text NOT NULL,contact_email text NOT NULL,city text,handle text UNIQUE,
 status text DEFAULT 'approved',approval_status text DEFAULT 'pending',
 approval_requested_at timestamptz,approval_token text,approval_token_used_at timestamptz,
 approved_at timestamptz,approval_note text, verified boolean DEFAULT false,verified_at timestamptz,
 verification_status text DEFAULT 'unverified',verification_note text,email_verified_at timestamptz);
 ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT,UPDATE ON public.artist_profiles TO authenticated,service_role;
 CREATE POLICY owner ON public.artist_profiles FOR ALL TO authenticated USING(auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK(auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
 INSERT INTO auth.users VALUES
 ('${user}','owner@example.test',now()),('${unconfirmed}','unconfirmed@example.test',null),
 ('${teammate}','team@example.test',now()),('${outsider}','other@example.test',now()),('${admin}','admin@example.test',now());
 INSERT INTO public.studio_members VALUES('${user}','${teammate}','active','artist');
`;
const actor = async (id) =>
  db.exec(
    `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`,
  );
const draft = (name = "Studio", goal = "presence") =>
  db.query(`SELECT public.create_studio_draft($1,$2,$3) AS result`, [name, "", goal]);
try {
  await db.exec(schema);
  for (const file of ["0057_studio_modules.sql", "0059_studio_draft_start.sql"])
    await db.exec(readFileSync(new URL(`../drizzle/migrations/${file}`, import.meta.url), "utf8"));
  await actor(unconfirmed);
  await assert.rejects(() => draft(), /Confirm your email/);
  await actor(teammate);
  await assert.rejects(() => draft(), /already belongs/);
  await actor(user);
  await assert.rejects(
    () =>
      db.exec(
        `INSERT INTO artist_profiles(user_id,studio_name,contact_email,status,approval_status) VALUES('${user}','Bad','x@example.test','approved','approved')`,
      ),
    /authenticated startup/,
  );
  const first = (await draft("My studio", "designs")).rows[0].result;
  assert.equal(first.created, true);
  let row = (await db.query("SELECT * FROM artist_profiles")).rows[0];
  assert.equal(row.status, "pending");
  assert.equal(row.approval_status, "pending");
  assert.equal(row.contact_email, "owner@example.test");
  assert.deepEqual(
    (await db.query("SELECT enabled FROM studio_module_preferences")).rows[0].enabled,
    ["requests", "designs"],
  );
  await db.exec("UPDATE artist_profiles SET studio_name='Edited studio'");
  const repeat = (await draft("Do not reset", "booking")).rows[0].result;
  assert.equal(repeat.created, false);
  assert.equal(repeat.id, first.id);
  assert.equal(
    (await db.query("SELECT studio_name FROM artist_profiles")).rows[0].studio_name,
    "Edited studio",
  );
  assert.deepEqual(
    (await db.query("SELECT enabled FROM studio_module_preferences")).rows[0].enabled,
    ["requests", "designs"],
  );
  for (const update of [
    "status='approved'",
    "approval_status='approved'",
    "verified=true",
    "approval_token='stolen'",
    "email_verified_at=now()",
  ])
    await assert.rejects(
      () => db.exec(`UPDATE artist_profiles SET ${update}`),
      /managed by the review workflow/,
    );
  await actor(outsider);
  assert.equal((await db.query("SELECT * FROM artist_profiles")).rows.length, 0);
  await actor(admin);
  await db.exec("UPDATE artist_profiles SET status='approved',approval_status='approved'");
  await actor(user);
  await db.exec("UPDATE artist_profiles SET city='Stockholm'");
  assert.equal(
    (await db.query("SELECT approval_status FROM artist_profiles")).rows[0].approval_status,
    "approved",
  );
  await db.exec("RESET ROLE; SET ROLE service_role;");
  await db.exec("UPDATE artist_profiles SET email_verified_at=now()");
  assert.ok(
    (await db.query("SELECT email_verified_at FROM artist_profiles")).rows[0].email_verified_at,
  );
  await actor(outsider);
  await assert.rejects(() => draft("Invalid goal", "not-a-goal"), /Choose a studio goal/);
  assert.equal((await db.query("SELECT * FROM artist_profiles")).rows.length, 0);
  console.log(
    "PASS: studio draft confirmed-email, membership, direct insert, private defaults, modules, idempotence, privilege escalation, ordinary editing, outsider RLS, admin/service compatibility, invalid goal atomicity.",
  );
} finally {
  await db.close();
}
