import { useCallback, useEffect, useState } from "react";
import { Clock, FolderOpen, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deleteProject,
  deleteVersion,
  listProjects,
  listVersions,
  type ProjectRecord,
  type VersionMeta,
} from "@/lib/paint/projectStore";
import { formatMm } from "@/lib/paint/document";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the project currently open, used to prefill the save field. */
  currentName: string;
  currentProjectId: string | null;
  /** Saves a new version; resolves once the write is done. */
  onSave: (name: string) => Promise<void>;
  /** Loads a saved version into the canvas. */
  onLoadVersion: (versionId: string) => Promise<void>;
}

function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ts).toLocaleDateString();
}

export function ProjectsDialog({
  open,
  onOpenChange,
  currentName,
  currentProjectId,
  onSave,
  onLoadVersion,
}: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(currentProjectId);
  const [versions, setVersions] = useState<Record<string, VersionMeta[]>>({});
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      toast.error("The saved sketches could not be read");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    setExpandedId(currentProjectId);
    void refresh();
  }, [open, currentName, currentProjectId, refresh]);

  const loadVersionList = useCallback(async (projectId: string) => {
    try {
      const list = await listVersions(projectId);
      setVersions((prev) => ({ ...prev, [projectId]: list }));
    } catch {
      toast.error("The versions could not be read");
    }
  }, []);

  useEffect(() => {
    if (open && expandedId) void loadVersionList(expandedId);
  }, [open, expandedId, loadVersionList]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(name);
      await refresh();
      if (expandedId) await loadVersionList(expandedId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Sketches</DialogTitle>
          <DialogDescription className="text-xs">
            Save the drawing to this device and go back to any earlier version whenever you want.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sketch name"
            aria-label="Sketch name"
            className="h-10 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save size={15} /> Save version
          </button>
        </div>

        <div className="space-y-2">
          {projects.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No saved sketches yet — save one above to start a version history.
            </p>
          )}

          {projects.map((project) => {
            const isOpen = expandedId === project.id;
            const list = versions[project.id] ?? [];
            return (
              <div
                key={project.id}
                className="rounded-xl border border-panel-border bg-panel/60 p-2"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={project.thumb}
                    alt={`Preview of ${project.name}`}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : project.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm">
                      {project.name}
                      {project.id === currentProjectId && (
                        <span className="ml-2 text-[10px] text-muted-foreground">open</span>
                      )}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatMm(project.widthMm)} × {formatMm(project.heightMm)} ·{" "}
                      {timeAgo(project.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${project.name}`}
                    onClick={async () => {
                      await deleteProject(project.id);
                      await refresh();
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {isOpen && (
                  <ul className="mt-2 space-y-1 border-t border-panel-border pt-2">
                    {list.length === 0 && (
                      <li className="px-1 py-2 text-[11px] text-muted-foreground">
                        No versions saved.
                      </li>
                    )}
                    {list.map((version, index) => (
                      <li key={version.id} className="flex items-center gap-2">
                        <img
                          src={version.thumb}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                          <Clock size={11} className="mr-1 inline" />
                          {version.label}
                          {index === 0 && " · latest"}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await onLoadVersion(version.id);
                              onOpenChange(false);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                        >
                          <FolderOpen size={14} /> Open
                        </button>
                        <button
                          type="button"
                          aria-label="Delete version"
                          onClick={async () => {
                            await deleteVersion(version.id);
                            await loadVersionList(project.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-accent hover:text-destructive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
