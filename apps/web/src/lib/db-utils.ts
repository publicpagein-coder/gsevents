/**
 * Safe helpers for extracting plain-primitive values from untyped Supabase query results.
 * Supabase returns JSON-parsed plain objects; these helpers narrow `unknown` → primitive
 * without ever using `any`, keeping the RSC serialisation boundary clean.
 */

export function safeStr(obj: unknown, key: string): string | null {
  if (typeof obj !== 'object' || obj === null) return null
  const val = (obj as Record<string, unknown>)[key]
  return typeof val === 'string' ? val : null
}

export function safeNum(obj: unknown, key: string): number | null {
  if (typeof obj !== 'object' || obj === null) return null
  const val = (obj as Record<string, unknown>)[key]
  return typeof val === 'number' ? val : null
}

export function safeRows(data: unknown): unknown[] {
  return Array.isArray(data) ? data : []
}
