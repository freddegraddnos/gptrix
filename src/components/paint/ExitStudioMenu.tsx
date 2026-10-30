/**
 * The way out of the drawing studio.
 *
 * The studio is full-screen with no app chrome, so this button sits first in
 * the top toolbar. It returns straight to wherever the artist came from when
 * that is known, and otherwise offers the handful of places worth going.
 * Unsaved strokes always get a confirmation first.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera, CalendarDays, Home, Images } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clearPaintReturnTo } from "@/lib/paintHandoff";

const DESTINATIONS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/library", label: "Designs library", icon: Images },
  { to: "/ar", label: "AR camera", icon: Camera },
  { to: "/bookings", label: "My bookings", icon: CalendarDays },
] as const;

export function ExitStudioMenu({
  hasUnsavedWork,
  returnTo,
  returnLabel,
  bookingLabel,
  onSaveToMyDesigns,
}: {
  hasUnsavedWork: boolean;
  /** Page the artist came from, when known. */
  returnTo: string | null;
  returnLabel?: string;
  /** Set when the studio is attached to a booking. */
  bookingLabel?: string | null;
  onSaveToMyDesigns: () => void;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  const go = (path: string) => {
    clearPaintReturnTo();
    void navigate({ to: path as never });
  };

  const request = (path: string) => {
    if (hasUnsavedWork) setPending(path);
    else go(path);
  };

  const backLabel = returnTo ? (returnLabel ?? "Back") : "Leave studio";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={returnTo ? "Leave the drawing studio" : "Leave the drawing studio"}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft size={17} />
            <span className="hidden text-[11px] sm:inline">{backLabel}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
            Leave the drawing studio
          </DropdownMenuLabel>
          {returnTo && (
            <>
              <DropdownMenuItem onSelect={() => request(returnTo)}>
                <ArrowLeft size={15} />
                {returnLabel ?? "Back to where I came from"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {DESTINATIONS.map((d) => (
            <DropdownMenuItem key={d.to} onSelect={() => request(d.to)}>
              <d.icon size={15} />
              {d.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Stay in the studio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              {bookingLabel
                ? `This sketch has changes that are not saved to the booking (${bookingLabel}) or to My designs.`
                : "This sketch has changes that are not saved yet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                const target = pending;
                setPending(null);
                if (target) go(target);
              }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-panel-border px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Leave without saving
            </button>
            <AlertDialogAction
              onClick={() => {
                const target = pending;
                setPending(null);
                onSaveToMyDesigns();
                if (target) go(target);
              }}
            >
              Save and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
