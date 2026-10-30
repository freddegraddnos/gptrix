import { useBlocker } from "@tanstack/react-router";
import { useStudioLang } from "@/lib/studioLang";

/** Blocks route changes and reloads only while a studio form has unsaved work. */
export function useUnsavedChangesGuard(dirty: boolean) {
  const [lang] = useStudioLang();

  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: dirty,
    shouldBlockFn: () => {
      if (!dirty) return false;
      const message = lang === "sv"
        ? "Du har osparade ändringar. Vill du lämna sidan utan att spara?"
        : "You have unsaved changes. Leave without saving?";
      return !window.confirm(message);
    },
  });
}