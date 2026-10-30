import { useEffect, useState } from "react";

export type StudioTheme = "dark" | "bright";
const KEY = "inksimulator.studio-theme";
const EVT = "inksimulator:studio-theme";

export function useStudioTheme(): [StudioTheme, (next: StudioTheme) => void] {
  const [theme, setTheme] = useState<StudioTheme>("dark");
  useEffect(() => {
    const read = () => setTheme(localStorage.getItem(KEY) === "bright" ? "bright" : "dark");
    try { read(); } catch { /* storage unavailable */ }
    window.addEventListener("storage", read);
    window.addEventListener(EVT, read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener(EVT, read); };
  }, []);
  return [theme, next => {
    setTheme(next);
    try { localStorage.setItem(KEY, next); window.dispatchEvent(new Event(EVT)); } catch { /* storage unavailable */ }
  }];
}
