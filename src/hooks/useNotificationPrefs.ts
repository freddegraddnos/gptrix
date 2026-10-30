import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotificationPrefs = {
  email_enabled: boolean;
  push_enabled: boolean;
  inapp_enabled: boolean;
  extra_emails: string[];
  on_confirmation: boolean;
  on_reminder: boolean;
  on_change: boolean;
  on_scan: boolean;
  on_message: boolean;
  reminder_hours: number;
  quiet_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  quiet_tz: string;
  quiet_scope: "push" | "inapp" | "both";
};

export const DEFAULT_PREFS: NotificationPrefs = {
  email_enabled: true,
  push_enabled: true,
  inapp_enabled: true,
  extra_emails: [],
  on_confirmation: true,
  on_reminder: true,
  on_change: true,
  on_scan: true,
  on_message: true,
  reminder_hours: 24,
  quiet_enabled: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
  quiet_tz:
    typeof Intl !== "undefined"
      ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC")
      : "UTC",
  quiet_scope: "push",
};

export function useNotificationPrefs(userId: string | undefined) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPrefs(DEFAULT_PREFS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setPrefs({
        email_enabled: data.email_enabled,
        push_enabled: data.push_enabled,
        inapp_enabled: data.inapp_enabled ?? true,
        extra_emails: (data.extra_emails ?? []) as string[],
        on_confirmation: data.on_confirmation,
        on_reminder: data.on_reminder,
        on_change: data.on_change,
        on_scan: data.on_scan ?? true,
        on_message: data.on_message ?? true,
        reminder_hours: data.reminder_hours,
        quiet_enabled: data.quiet_enabled ?? false,
        quiet_start: ((data.quiet_start as string | null) ?? "22:00").slice(0, 5),
        quiet_end: ((data.quiet_end as string | null) ?? "07:00").slice(0, 5),
        quiet_tz: data.quiet_tz ?? DEFAULT_PREFS.quiet_tz,
        quiet_scope: (data.quiet_scope ?? "push") as NotificationPrefs["quiet_scope"],
      });
    } else {
      setPrefs(DEFAULT_PREFS);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      if (!userId) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      setSaving(true);
      const { error } = await supabase
        .from("notification_prefs")
        .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
      setSaving(false);
      if (error) throw error;
    },
    [prefs, userId],
  );

  return { prefs, loading, saving, save, refresh };
}
