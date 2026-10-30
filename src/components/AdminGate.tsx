import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";

/** Shows children only to signed-in admins (checked in the database). */
export function AdminGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  if (!hydrated || loading || (user && isAdmin === null)) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin text-accent" /></div>;
  }
  if (!user || !isAdmin) {
    return (
      <div className="flex gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" /> {user ? "You need an admin account." : "Sign in with an admin account."}
      </div>
    );
  }
  return <>{children}</>;
}
