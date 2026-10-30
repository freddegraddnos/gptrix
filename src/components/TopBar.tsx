import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useConversations } from "@/hooks/useMessages";

import { tx, useUiLang } from "@/lib/uiLang";
export function TopBar({ title }: { title?: string }) {
  useUiLang();
  const { user } = useAuth();
  const { unread } = useNotifications(user?.id);
  const { items: convs } = useConversations(user?.id);
  const unreadConvs = convs.filter((c) => c.unread).length;

  return (
    <div className="flex items-center justify-between mb-4">
      <Link to="/" className="text-mono-caps text-[10px] text-accent">
        {title ?? tx("InkSimulator")}
      </Link>
      {user && (
        <div className="flex items-center gap-1">
          <Link
            to="/messages"
            aria-label={tx("Messages")}
            className="relative size-10 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="size-5" />
            {unreadConvs > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent" />
            )}
          </Link>
          <Link
            to="/notifications"
            aria-label={tx("Notifications")}
            className="relative size-10 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-ink text-[9px] font-bold grid place-items-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}
