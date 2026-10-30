import type { ReactElement, ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsCompact } from "@/hooks/useIsCompact";

/**
 * One panel, two containers.
 *
 * On a tablet or desktop the panel floats next to its trigger the way Procreate
 * does. On a phone a fixed-width popover would cover the whole canvas, so the
 * same body is presented as a bottom sheet instead: full width, scrollable and
 * swipe-to-close.
 */
export function ResponsivePanel({
  trigger,
  title,
  description,
  side = "left",
  align = "start",
  width = "w-72",
  children,
}: {
  trigger: ReactElement;
  title: string;
  description?: string;
  side?: "left" | "bottom" | "right" | "top";
  align?: "start" | "center" | "end";
  /** Tailwind width class used in the floating (non-phone) presentation. */
  width?: string;
  children: ReactNode;
}) {
  const compact = useIsCompact();

  if (compact) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="border-panel-border bg-panel/97 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerTitle className="pb-1 text-sm text-foreground">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {description ?? title}
            </DrawerDescription>
            <div className="max-h-[70vh] overflow-y-auto pt-2">{children}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={12}
        className={`${width} max-h-[80vh] overflow-y-auto border-panel-border bg-panel/95 backdrop-blur-xl`}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
