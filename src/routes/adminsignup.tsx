import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { createApprovedStudio, verifyAdminSignupCode } from "@/lib/adminSignup.functions";
import { uploadStudioImage } from "@/lib/studioMedia";

export const Route = createFileRoute("/adminsignup")({
  head: () => ({
    meta: [
      { title: "Studio signup — InkSimulator" },
      { name: "description", content: "Private studio signup for InkSimulator partners." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <RequireAuth><AdminSignupPage /></RequireAuth>,
});

function AdminSignupPage() {
  const navigate = useNavigate();
  const create = useServerFn(createApprovedStudio);
  const verifyCode = useServerFn(verifyAdminSignupCode);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studioName, setStudioName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [bio, setBio] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickLogo = (file: File | null) => {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const describe = (e: unknown) => {
    const msg = e instanceof Error ? e.message : "";
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return "Connection lost — reload the page and try again.";
    }
    if (/weak|easy to guess/i.test(msg)) {
      return "That password is too easy to guess. Use at least 8 characters and mix letters, numbers and a symbol.";
    }
    if (/already been registered|already registered|user already/i.test(msg)) {
      return "There is already an account with that email address.";
    }
    return msg || "Something went wrong";
  };

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await verifyCode({ data: { code } });
      if (res?.ok) setUnlocked(true);
      else setError("Wrong access code.");
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await create({
        data: { email, password, studioName, city, address, phone, website, instagram, socialUrl, bio, code },
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      if (logoFile && result?.userId) {
        try {
          const path = await uploadStudioImage(result.userId, logoFile, "logo");
          await supabase.from("artist_profiles").update({ logo_url: path }).eq("user_id", result.userId);
        } catch {
          setError("The studio was created, but the logo could not be uploaded. You can add it from the dashboard.");
        }
      }

      navigate({ to: "/artists/dashboard" });
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full h-11 px-3 rounded-xl bg-slate border border-white/10 text-sm";
  const heading = "text-[10px] font-bold uppercase tracking-wide text-muted-foreground pt-2";

  const errorBox = error && (
    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
      {error}
    </div>
  );

  if (!unlocked) {
    return (
      <AppShell>
        <h1 className="font-display font-bold text-2xl mb-1">Studio signup</h1>
        <p className="mb-5 text-xs text-muted-foreground">An administrator account and access code are required to continue.</p>
        <div className="space-y-3">
          <input
            className={field}
            placeholder="Access code"
            value={code}
            autoComplete="off"
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void unlock();
            }}
          />
          {errorBox}
          <button
            onClick={unlock}
            disabled={busy || !code.trim()}
            className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Continue
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="font-display font-bold text-2xl mb-1">Studio signup</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Private signup — the studio is live immediately, no email verification. Everything except
        studio name, email and password is optional and can be changed later.
      </p>

      <div className="space-y-3">
        <p className={heading}>Studio</p>
        <input
          className={field}
          placeholder="Studio name"
          value={studioName}
          onChange={(e) => setStudioName(e.target.value)}
        />
        <input
          className={field}
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={field}
          type="password"
          autoComplete="new-password"
          placeholder="Temporary password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Give the studio this temporary password. They must choose their own the first time they
          sign in.
        </p>
        <input
          className={field}
          placeholder="Street address (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <input
          className={field}
          placeholder="City (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <p className={heading}>Contact &amp; links</p>
        <input
          className={field}
          type="tel"
          placeholder="Phone number (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className={field}
          placeholder="Website (optional)"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <input
          className={field}
          placeholder="Instagram (optional)"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
        />
        <input
          className={field}
          placeholder="Other social link — Facebook, TikTok (optional)"
          value={socialUrl}
          onChange={(e) => setSocialUrl(e.target.value)}
        />
        <textarea
          className="w-full min-h-24 p-3 rounded-xl bg-slate border border-white/10 text-sm"
          placeholder="Short description of the studio (optional)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <div className="size-14 rounded-xl overflow-hidden bg-slate border border-white/10 flex items-center justify-center text-[10px] text-muted-foreground">
            {logoPreview ? (
              <img src={logoPreview} alt="Studio logo preview" className="h-full w-full object-cover" />
            ) : (
              "Logo"
            )}
          </div>
          <label className="text-xs text-muted-foreground">
            <span className="block mb-1">Logo (optional)</span>
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Create studio account
        </button>
      </div>
    </AppShell>
  );
}
