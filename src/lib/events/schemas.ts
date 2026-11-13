import { z } from "zod";

/** FR-EVT package row as submitted from the form (price in paise). */
export const PackageInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  price_paise: z.number().int().min(0),
  deliverables: z.string().trim().max(4000).optional().nullable(),
  slots_total: z.number().int().positive().optional().nullable(),
});

export type PackageInput = z.infer<typeof PackageInputSchema>;

export const PackagesArraySchema = z
  .array(PackageInputSchema)
  .min(1, "At least one sponsorship package is required");

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** Shared event field schema (FR-EVT-01, 02, 07, 08). ticketing is never accepted from client. */
export const EventFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    event_type_id: z.number().int().positive(),
    city_id: z.number().int().positive(),
    venue: z.string().trim().max(300).optional().nullable(),
    season: z.string().trim().max(100).optional().nullable(),
    start_date: dateString,
    end_date: dateString,
    expected_audience: z.number().int().min(0).optional().nullable(),
    audience_notes: z.string().trim().max(1000).optional().nullable(),
    visibility: z.enum(["public", "private"]),
  })
  .superRefine((val, ctx) => {
    if (val.end_date < val.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be before start date",
        path: ["end_date"],
      });
    }
  });

export type EventFields = z.infer<typeof EventFieldsSchema>;

export const CreateEventSchema = EventFieldsSchema.and(
  z.object({
    packages: PackagesArraySchema,
  }),
);

export const UpdateEventSchema = EventFieldsSchema.and(
  z.object({
    eventId: z.string().uuid(),
    packages: PackagesArraySchema,
  }),
);

export const EventIdSchema = z.object({
  eventId: z.string().uuid(),
});

export const ChangeRequestSchema = EventFieldsSchema.and(
  z.object({
    eventId: z.string().uuid(),
    packages: PackagesArraySchema,
  }),
);

/** Max authority letter size: 5 MB (FR-EVT-09). */
export const AUTHORITY_LETTER_MAX_BYTES = 5 * 1024 * 1024;
export const AUTHORITY_LETTER_MIME = "application/pdf";

/**
 * Convert rupee string/number from the UI to integer paise.
 * Accepts "1000", "1,000", "1000.50" (paisa rounded).
 */
export function rupeesToPaise(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw * 100);
  }
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function parsePackagesFromFormData(formData: FormData): unknown {
  const raw = formData.get("packages");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function eventFieldsFromFormData(formData: FormData): Record<string, unknown> {
  const expectedRaw = formData.get("expected_audience");
  let expected_audience: number | null = null;
  if (typeof expectedRaw === "string" && expectedRaw.trim() !== "") {
    const n = Number(expectedRaw);
    expected_audience = Number.isFinite(n) ? n : null;
  }

  return {
    title: formData.get("title"),
    description: emptyToNull(formData.get("description")),
    event_type_id: Number(formData.get("event_type_id")),
    city_id: Number(formData.get("city_id")),
    venue: emptyToNull(formData.get("venue")),
    season: emptyToNull(formData.get("season")),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    expected_audience,
    audience_notes: emptyToNull(formData.get("audience_notes")),
    visibility: formData.get("visibility"),
  };
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
