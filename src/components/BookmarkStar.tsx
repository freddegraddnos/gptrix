import { useState } from "react";
import { Bookmark, Star } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type Props = {
  active: boolean;
  onToggle: () => void | Promise<unknown>;
  label: string;
  signedIn?: boolean;
  /** "bookmark" = outline bookmark icon on a light artwork tile (Discover cards). */
  variant?: "star" | "bookmark";
};

/** Small star button with a "pop" animation for gallery cards. */
export function BookmarkStar({ active, onToggle, label, signedIn, variant = "star" }: Props) {
  const [pop, setPop] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove bookmark: ${label}` : `Bookmark ${label}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPop(true);
        window.setTimeout(() => setPop(false), 260);
        void Promise.resolve(onToggle())
          .then(() => {
            if (!active && signedIn === false) {
              toast("Saved locally", {
                description: "Log in to save bookmarks to your account.",
              });
            }
          })
          .catch(() =>
            toast.error("Could not save the bookmark. Try again."),
          );
      }}
      className={
        variant === "bookmark"
          ? `absolute right-1 top-1 z-10 grid size-11 place-items-center transition-transform duration-200 ${pop ? "scale-125" : "scale-100 active:scale-90"}`
          : `absolute right-1.5 top-1.5 z-10 grid size-8 place-items-center rounded-full border backdrop-blur transition-transform duration-200 ${
              active
                ? "border-amber-300/60 bg-ink/70"
                : "border-white/15 bg-ink/50 hover:border-white/30"
            } ${pop ? "scale-125" : "scale-100 active:scale-90"}`
      }
    >
      {variant === "bookmark" ? (
        <Bookmark
          className="size-5 text-paper-ink"
          fill={active ? "currentColor" : "none"}
          strokeWidth={1.75}
        />
      ) : (
        <Star
          className={`size-4 transition-colors ${
            active ? "text-amber-300" : "text-white/70"
          }`}
          fill={active ? "currentColor" : "none"}
          strokeWidth={2}
        />
      )}
    </button>
  );
}

/** Small sign-in prompt shown in the bookmarks view. */
export function BookmarkSignInHint() {
  return (
    <p className="mt-2 text-[11px] text-muted-foreground">
      Your bookmarks are saved on this device.{" "}
      <Link to="/auth" className="text-accent font-semibold">
        Log in
      </Link>{" "}
      to save them to your account.
    </p>
  );
}
