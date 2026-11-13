import {
  AUTHORITY_LETTER_MAX_BYTES,
  AUTHORITY_LETTER_MIME,
} from "./schemas";

export type LetterValidation =
  | { ok: true; file: File }
  | { ok: false; error: string };

/** Validate an optional authority-letter File from FormData (FR-EVT-09). */
export function validateAuthorityLetterFile(
  entry: FormDataEntryValue | null,
): LetterValidation | { ok: true; file: null } {
  if (entry === null || entry === undefined) {
    return { ok: true, file: null };
  }
  if (!(entry instanceof File)) {
    return { ok: false, error: "Invalid authority letter upload" };
  }
  if (entry.size === 0) {
    return { ok: true, file: null };
  }
  if (entry.type !== AUTHORITY_LETTER_MIME) {
    return { ok: false, error: "Authority letter must be a PDF" };
  }
  if (entry.size > AUTHORITY_LETTER_MAX_BYTES) {
    return { ok: false, error: "Authority letter must be 5 MB or smaller" };
  }
  return { ok: true, file: entry };
}

/** Storage object path: {organizerId}/{eventId}/{safeName}.pdf */
export function authorityLetterObjectPath(
  organizerId: string,
  eventId: string,
  originalName: string,
): string {
  const base = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const safe = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  return `${organizerId}/${eventId}/${Date.now()}-${safe}`;
}
