export function i18nName(value: unknown, fallback = ""): string {
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  return (
    (typeof v.es === "string" && v.es) ||
    (typeof v.en === "string" && v.en) ||
    fallback
  );
}
