import { useAuth } from "@/hooks/useAuth";
import { useArtistMode } from "@/hooks/useArtistMode";

/**
 * Whether the signed-in user is a studio account (owner or active team member).
 * Presentation only: the database and server functions enforce the real rules.
 */
export function useStudioAccount() {
  const { user, loading: authLoading } = useAuth();
  const { artist, loading } = useArtistMode(user?.id);
  return {
    loading: authLoading || (!!user && loading),
    isStudio: !!artist,
    studioName: artist?.studio_name ?? null,
    handle: artist?.handle ?? null,
  };
}
