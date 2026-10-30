import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_LOCAL_MODEL_BYTES, validateLocalGlb } from "@/lib/glbValidation";
import { tx, useUiLang } from "@/lib/uiLang";

const Model3DViewer = lazy(() => import("@/components/Model3DViewer"));

/** Opens a real model on this device without uploading it or publishing a scan. */
export function LocalModelPreview() {
  useUiLang();
  const [model, setModel] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  useEffect(
    () => () => {
      if (model) URL.revokeObjectURL(model.url);
    },
    [model],
  );

  const select = async (file?: File) => {
    if (!file) return;
    const current = ++generation.current;
    setError(null);
    setBusy(true);
    try {
      if (!/\.glb$/i.test(file.name) || file.size > MAX_LOCAL_MODEL_BYTES) {
        throw new Error("Choose a GLB file smaller than 40 MB.");
      }
      const bytes = await file.arrayBuffer();
      validateLocalGlb(bytes);
      if (current !== generation.current) return;
      setModel({
        url: URL.createObjectURL(new Blob([bytes], { type: "model/gltf-binary" })),
        name: file.name,
      });
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? tx(cause.message) : tx("The model could not be opened."));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };

  return (
    <section
      className="mt-6 rounded-2xl border border-border p-4"
      aria-labelledby="local-model-title"
    >
      <h2 id="local-model-title" className="font-display text-lg">
        {tx("Preview an existing 3D model")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {tx(
          "Open a GLB 2.0 file with embedded textures, up to 40 MB. It stays on this device and is not saved to your account or shared.",
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {tx(
          "A Procreate project, image or 360° video is not a 3D model. Export a compatible GLB first. A generic model does not represent your body's measurements.",
        )}
      </p>
      <label className="mt-3 block text-sm">
        {tx("Choose GLB model")}
        <input
          type="file"
          accept=".glb,model/gltf-binary"
          disabled={busy}
          onChange={(e) => {
            void select(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="mt-2 block w-full rounded-lg border border-border p-3 text-sm"
        />
      </label>
      {busy && (
        <p role="status" className="mt-2 text-sm">
          {tx("Checking model…")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {model && (
        <div className="mt-4 space-y-3">
          <p className="break-words text-sm">{model.name}</p>
          <Suspense fallback={<p role="status">{tx("Loading model…")}</p>}>
            <Model3DViewer modelUrl={model.url} />
          </Suspense>
          <Button
            variant="outline"
            onClick={() => {
              generation.current += 1;
              setModel(null);
              setError(null);
            }}
          >
            {tx("Close local model")}
          </Button>
        </div>
      )}
    </section>
  );
}
