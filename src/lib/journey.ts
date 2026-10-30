import { useSyncExternalStore } from "react";

/** Badge & journey computation from client-visible signals. */

export type Badge = {
  id: string;
  label: string;
  icon: string; // emoji glyph
  earned: boolean;
  hint: string;
};

export type JourneyStats = {
  level: number;
  levelName: string;
  xp: number;
  xpForNext: number;
  progressPct: number;
  streakDays: number;
  badges: Badge[];
  earnedCount: number;
};

const LEVELS = [
  { name: "Beginner", xp: 0 },
  { name: "Explorer", xp: 50 },
  { name: "Sketcher", xp: 150 },
  { name: "Curator", xp: 350 },
  { name: "Connoisseur", xp: 700 },
  { name: "InkSimulator", xp: 1200 },
];

/** Signals passed in from the app. */
export type JourneyInput = {
  projectCount: number;
  motifsOwned: number;
  postsShared: number;
  hasSubscription: boolean;
  usedAdvisor: boolean;
  usedCompare: boolean;
  usedAr: boolean;
  calibrated: boolean;
};

export function computeJourney(input: JourneyInput): JourneyStats {
  const xp =
    input.projectCount * 20 +
    input.motifsOwned * 30 +
    input.postsShared * 15 +
    (input.hasSubscription ? 40 : 0) +
    (input.usedAdvisor ? 25 : 0) +
    (input.usedCompare ? 20 : 0) +
    (input.usedAr ? 15 : 0) +
    (input.calibrated ? 10 : 0);

  let level = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      level = i;
      break;
    }
  }
  const current = LEVELS[level];
  const next = LEVELS[level + 1] ?? { name: current.name, xp: current.xp };
  const progressPct =
    level + 1 >= LEVELS.length
      ? 100
      : Math.round(((xp - current.xp) / (next.xp - current.xp)) * 100);

  const badges: Badge[] = [
    {
      id: "calibrated",
      label: "Sharp-eyed",
      icon: "🎯",
      earned: input.calibrated,
      hint: "Calibrate the camera",
    },
    {
      id: "first_ar",
      label: "AR debut",
      icon: "📷",
      earned: input.usedAr,
      hint: "Try AR mode",
    },
    {
      id: "first_project",
      label: "First sketch",
      icon: "✍️",
      earned: input.projectCount >= 1,
      hint: "Save your first project",
    },
    {
      id: "portfolio",
      label: "Portfolio",
      icon: "🖼️",
      earned: input.projectCount >= 5,
      hint: "Save 5 projects",
    },
    {
      id: "curator",
      label: "Curator",
      icon: "💎",
      earned: input.motifsOwned >= 1,
      hint: "Buy a motif",
    },
    {
      id: "advisor",
      label: "Advice seeker",
      icon: "🤖",
      earned: input.usedAdvisor,
      hint: "Ask the AI Advisor",
    },
    {
      id: "compare",
      label: "Perfectionist",
      icon: "⚖️",
      earned: input.usedCompare,
      hint: "Compare placements",
    },
    {
      id: "shared",
      label: "Sharer",
      icon: "🔥",
      earned: input.postsShared >= 1,
      hint: "Post in the community",
    },
    {
      id: "premium",
      label: "Premium",
      icon: "⚡",
      earned: input.hasSubscription,
      hint: "Activate premium",
    },
  ];

  const streakDays = readStreak();

  return {
    level: level + 1,
    levelName: current.name,
    xp,
    xpForNext: next.xp,
    progressPct: Math.max(0, Math.min(100, progressPct)),
    streakDays,
    badges,
    earnedCount: badges.filter((b) => b.earned).length,
  };
}

/* ---------- streak tracking + accessibility (localStorage) ---------- */

const STREAK_KEY = "inkvision.streak.v1";
const A11Y_KEY = "inkvision.a11y.v1";

type StreakState = { last: string; days: number };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function readStreakState(): StreakState {
  if (typeof window === "undefined") return { last: "", days: 0 };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { last: "", days: 0 };
    return JSON.parse(raw) as StreakState;
  } catch {
    return { last: "", days: 0 };
  }
}

function readStreak(): number {
  return readStreakState().days;
}

/** Call once on app boot (from a client-only effect). Updates streak counter. */
export function tickStreak() {
  if (typeof window === "undefined") return;
  const now = todayISO();
  const prev = readStreakState();
  if (prev.last === now) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  const next: StreakState =
    prev.last === yesterday
      ? { last: now, days: prev.days + 1 }
      : { last: now, days: 1 };
  localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  a11yListeners.forEach((l) => l()); // notify subscribers of any storage change
}

/* ---------- accessibility preferences ---------- */

export type A11yPrefs = {
  highContrast: boolean;
  largeText: boolean;
};

const a11yListeners = new Set<() => void>();
let a11yState: A11yPrefs = { highContrast: false, largeText: false };
let a11yBooted = false;

function readA11y(): A11yPrefs {
  if (typeof window === "undefined") return a11yState;
  try {
    const raw = localStorage.getItem(A11Y_KEY);
    if (!raw) return a11yState;
    const p = JSON.parse(raw) as Partial<A11yPrefs>;
    return { highContrast: !!p.highContrast, largeText: !!p.largeText };
  } catch {
    return a11yState;
  }
}

function applyA11y(p: A11yPrefs) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("a11y-contrast", p.highContrast);
  document.documentElement.classList.toggle("a11y-large", p.largeText);
}

function bootA11y() {
  if (a11yBooted || typeof window === "undefined") return;
  a11yBooted = true;
  a11yState = readA11y();
  applyA11y(a11yState);
}

export function useA11y(): A11yPrefs {
  bootA11y();
  return useSyncExternalStore(
    (fn) => {
      a11yListeners.add(fn);
      return () => a11yListeners.delete(fn);
    },
    () => a11yState,
    () => a11yState,
  );
}

export function setA11y(next: Partial<A11yPrefs>) {
  a11yState = { ...a11yState, ...next };
  if (typeof window !== "undefined") {
    localStorage.setItem(A11Y_KEY, JSON.stringify(a11yState));
    applyA11y(a11yState);
  }
  a11yListeners.forEach((l) => l());
}
