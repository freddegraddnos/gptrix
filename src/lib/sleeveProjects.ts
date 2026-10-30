export type SleeveProjectItem = {
  key: string;
  src: string;
  name: string;
  x: number;
  y: number;
  size: number;
  rot: number;
};

export type SleeveProject = {
  id: string;
  name: string;
  areaId: string;
  items: SleeveProjectItem[];
  preview: string;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "inksimulator.sleeve-projects.v1";

export function listSleeveProjects(): SleeveProject[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as SleeveProject[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveSleeveProject(input: {
  id?: string;
  name: string;
  areaId: string;
  items: SleeveProjectItem[];
  preview: string;
}): SleeveProject {
  const projects = listSleeveProjects();
  const existing = input.id ? projects.find((project) => project.id === input.id) : undefined;
  const now = Date.now();
  const saved: SleeveProject = {
    id: existing?.id ?? `sleeve-${crypto.randomUUID()}`,
    name: input.name.trim() || "Untitled sleeve",
    areaId: input.areaId,
    items: input.items,
    preview: input.preview,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [saved, ...projects.filter((project) => project.id !== saved.id)].slice(0, 20);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return saved;
}

export function deleteSleeveProject(id: string) {
  const next = listSleeveProjects().filter((project) => project.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
