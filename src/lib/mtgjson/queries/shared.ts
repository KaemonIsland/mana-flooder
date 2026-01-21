type JsonValue = string | number | boolean | object | null;

export function parseJson<T extends JsonValue>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeStringArray(value: unknown): string[] {
  const parsed = parseJson<JsonValue>(value, null);
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean).map((entry) => String(entry));
  }
  if (typeof parsed === "string") {
    return parsed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
