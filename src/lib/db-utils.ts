/**
 * Safe narrowing helpers for Supabase query results.
 *
 * Supabase typed clients return well-typed rows, but when working with
 * joined queries or `select('*')` results we sometimes get `unknown`
 * fields. Use these helpers instead of casting to `any`.
 */

/** Return the value as a string, or an empty string if it is not a non-empty string. */
export function safeStr(val: unknown): string {
  if (typeof val === "string") return val;
  return "";
}

/**
 * Return the value as a string, or null if it is null/undefined/not a string.
 * Useful for nullable text columns.
 */
export function safeStrNullable(val: unknown): string | null {
  if (typeof val === "string") return val;
  if (val === null || val === undefined) return null;
  return null;
}

/** Return the value as a number, or 0 if it is not a finite number. */
export function safeNum(val: unknown): number {
  if (typeof val === "number" && isFinite(val)) return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (isFinite(n)) return n;
  }
  return 0;
}

/**
 * Return the value as a number, or null if it is null/undefined/not a number.
 * Useful for nullable numeric columns.
 */
export function safeNumNullable(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number" && isFinite(val)) return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (isFinite(n)) return n;
  }
  return null;
}

/** Return the value as a boolean, or false if it is not a boolean. */
export function safeBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  return false;
}
