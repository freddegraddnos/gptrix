const KEY = "inkvision.hidden-motifs.v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage full or unavailable */
  }
  listeners.forEach((fn) => fn());
}

export function listHiddenMotifs(): string[] {
  return read();
}

export function isMotifHidden(id: string): boolean {
  return read().includes(id);
}

export function hideMotif(id: string) {
  const ids = read();
  if (ids.includes(id)) return;
  write([...ids, id]);
}

export function unhideMotif(id: string) {
  write(read().filter((x) => x !== id));
}

export function clearHiddenMotifs() {
  write([]);
}

export function subscribeHiddenMotifs(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
