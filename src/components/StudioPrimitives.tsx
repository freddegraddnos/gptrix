import type { HTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Platform-only roles; never wrap a studio's custom public-page preview. */
export function StudioButton({ className, ...props }: ButtonProps) {
  return <Button className={cn("studio-control", className)} {...props} />;
}

export function StudioCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("studio-card", className)} {...props} />;
}

export function StudioSubsection({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("studio-subsection", className)} {...props} />;
}

export function StudioEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("studio-empty", className)}>{children}</div>;
}

export function StudioStatus({ children }: { children: ReactNode }) {
  return <span className="studio-status">{children}</span>;
}