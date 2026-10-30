import { useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchDafont, downloadDafontFont, type DafontHit } from "@/lib/paint/dafont.functions";
import { addCustomFontData } from "@/lib/paint/customFonts";

/**
 * Built-in font catalogue: search dafont.com and install a face with one tap.
 * The zip handling happens server side, so nothing is unpacked by hand.
 */
export function FontCatalogDialog({
  open,
  onOpenChange,
  onInstalled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: (fontId: string) => void;
}) {
  const runSearch = useServerFn(searchDafont);
  const runDownload = useServerFn(downloadDafontFont);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DafontHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await runSearch({ data: { query: q, page: 1 } });
      setHits(res.hits);
      if (res.hits.length === 0) setError("No fonts found.");
    } catch {
      setError("Could not reach the font catalogue right now.");
    } finally {
      setLoading(false);
    }
  };

  // Show the popular fonts as soon as the catalogue opens.
  useEffect(() => {
    if (open && hits.length === 0 && !loading) void search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const install = async (hit: DafontHit) => {
    setInstalling(hit.slug);
    try {
      const file = await runDownload({ data: { slug: hit.slug } });
      const font = await addCustomFontData(hit.name, file.fileName, file.base64);
      onInstalled(font.id);
      toast.success(`${hit.name} installed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not fetch the font");
    } finally {
      setInstalling(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Font Catalogue</DialogTitle>
          <DialogDescription>
            Search fonts on dafont.com and install them directly into the text tool. Check
            the license before commercial use.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search(query.trim());
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. tattoo, script, blackletter"
            aria-label="Search fonts"
          />
          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </Button>
        </form>

        {error && <p className="text-[12px] text-muted-foreground">{error}</p>}

        <ScrollArea className="h-[52vh] pr-2">
          <ul className="space-y-2">
            {hits.map((hit) => (
              <li
                key={hit.slug}
                className="flex items-center gap-3 rounded-xl border border-panel-border bg-background/40 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  {hit.preview ? (
                    <img
                      src={hit.preview}
                      alt={`Preview of ${hit.name}`}
                      loading="lazy"
                      className="mb-1 h-8 max-w-full object-contain object-left invert-0 dark:invert"
                    />
                  ) : null}
                  <p className="truncate text-sm text-foreground">{hit.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {hit.author ? `${hit.author} · ` : ""}
                    {hit.license}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={installing !== null}
                  onClick={() => void install(hit)}
                >
                  {installing === hit.slug ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  Install
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
