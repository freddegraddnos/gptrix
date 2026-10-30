export function clientRelationLabel(project: { client_user_id?: string | null; client_handle?: string | null; client_name?: string | null }, t: (s: string) => string) {
  const name = project.client_handle ? `@${project.client_handle}` : project.client_name?.trim();
  if (project.client_user_id) return `${name || t("Customer")} · ${t("linked")}`;
  return name ? `${name} · ${t("awaiting invite")}` : t("No client linked");
}