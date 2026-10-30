import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { listMyMotifs, saveMyMotif, subscribeMyMotifs, type MyMotif } from "@/lib/myMotifs";

/**
 * Lets the client wrap their own artwork around a 3D scan instead of a fixed
 * demo design. Uploads are kept in "My designs" so the same sleeve can be
 * reused later in AR without re-uploading.
 */
export function SleeveDesignPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [motifs, setMotifs] = useState<MyMotif[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const sync = () => setMotifs(listMyMotifs());
    sync();
    return subscribeMyMotifs(sync);
  }, []);

  const onUpload = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pick an image file (PNG or JPG).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That image is larger than 15 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      // Saved so the design is available next time, in AR too.
      saveMyMotif({ name: file.name.replace(/\.[^.]+$/, "") || "Sleeve design", src, widthCm: 20 });
      onChange(src);
    };
    reader.onerror = () => setError("That image could not be read.");
    reader.readAsDataURL(file);
  };

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-slate p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Sleeve design</p>
          <p className="text-[11px] text-muted-foreground">
            Wrap your own artwork around the scan, then adjust it below.
          </p>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/15 px-3 text-[11px] font-bold"
          >
            <X className="size-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex size-16 flex-none flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-accent/40 text-accent"
        >
          <ImagePlus className="size-4" />
          <span className="text-[10px] font-bold uppercase">Upload</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onUpload(e.target.files?.[0])}
        />
        {motifs.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.src)}
            className={`size-16 flex-none overflow-hidden rounded-xl bg-artwork ${
              value === m.src ? "border-2 border-accent" : "border border-white/10"
            }`}
            title={m.name}
          >
            <img src={m.src} alt={m.name} className="size-full object-contain p-1" />
          </button>
        ))}
      </div>

      {motifs.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Nothing saved yet — upload a design to get started.
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </section>
  );
}
