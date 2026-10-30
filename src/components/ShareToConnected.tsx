import { SocialIcon } from "@/components/SocialIcon";
import { useSocialConnections } from "@/hooks/useSocialConnections";
import { platformInfo } from "@/lib/socialAccounts";
import { saveToCameraRoll, shareLink } from "@/lib/share";

/**
 * Sharing suggestions based on the user's connected accounts.
 * X/Facebook opens the platform's share dialog with the link.
 * Instagram/Snapchat do not allow direct publishing from the web — there we
 * save the file to the camera roll so the user can post it in the app.
 */
export function ShareToConnected({
  userId,
  url,
  text,
  file,
  filename = "inkvision.mp4",
}: {
  userId?: string;
  url: string;
  text: string;
  file?: Blob | null;
  filename?: string;
}) {
  const { connections } = useSocialConnections(userId);
  if (!userId || connections.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Share to your accounts
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {connections.map((c) => {
          const info = platformInfo(c.platform);
          if (!info) return null;
          const onClick = async () => {
            if (info.canShareLink && info.shareUrl) {
              window.open(info.shareUrl(url, text), "_blank", "noopener");
              return;
            }
            if (file) {
              await saveToCameraRoll(file, filename);
            } else {
              await shareLink(url, text);
            }
          };
          return (
            <button
              key={c.platform}
              onClick={() => void onClick()}
              className="h-10 px-3 rounded-xl border border-white/10 bg-ink flex items-center gap-2 text-xs"
            >
              <span style={{ color: info.color }}>
                <SocialIcon platform={c.platform} className="size-4" />
              </span>
              {info.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground/80">
        Instagram and Snapchat do not allow direct publishing from the web —
        the file is saved to the camera roll so you can post it in the app.
      </p>
    </div>
  );
}
