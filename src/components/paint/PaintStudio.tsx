/**
 * The drawing studio shell.
 *
 * The paint engine is a large, canvas-only bundle, so it is loaded lazily:
 * nothing of it is fetched until someone actually opens /rita. The
 * `paint-scope` class carries the studio's neutral graphite panel palette
 * (see src/styles.css) so the rest of InkSimulator keeps its own theme.
 */
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

const PaintApp = lazy(() =>
  import("@/components/paint/PaintApp").then((m) => ({ default: m.PaintApp })),
);

export function PaintStudio() {
  return (
    <div className="paint-scope">
      <Suspense
        fallback={
          <div className="grid h-screen w-screen place-items-center bg-canvas-void">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs tracking-widest uppercase text-muted-foreground">
                Loading drawing studio…
              </p>
            </div>
          </div>
        }
      >
        <PaintApp />
      </Suspense>
    </div>
  );
}
