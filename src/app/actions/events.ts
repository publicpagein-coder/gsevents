"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import {
  ChangeRequestSchema,
  CreateEventSchema,
  EventIdSchema,
  UpdateEventSchema,
  eventFieldsFromFormData,
  parsePackagesFromFormData,
  type PackageInput,
} from "@/lib/events/schemas";
import {
  authorityLetterObjectPath,
  validateAuthorityLetterFile,
} from "@/lib/events/letter";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type VerificationStatus = Database["public"]["Enums"]["verification_status"];
type EventStatus = Database["public"]["Enums"]["event_status"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
type PackageInsert = Database["public"]["Tables"]["sponsorship_packages"]["Insert"];
type Json = Database["public"]["Tables"]["event_change_requests"]["Insert"]["proposed_fields"];

export type ActionResult =
  | { success: true; eventId?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      eventId?: string;
    };

type OrganizerAuth =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * FR-EVT: require signed-in approved organizer. Never trust client role.
 */
async function requireApprovedOrganizer(): Promise<OrganizerAuth> {
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role, verification_status")
    .eq("id", user.id)
    .single();

  const profile = profileData as {
    role: UserRole;
    verification_status: VerificationStatus | null;
  } | null;

  if (profile?.role !== "organizer") {
    return { ok: false, error: "Only organizers can manage events" };
  }
  if (profile.verification_status !== "approved") {
    return { ok: false, error: "Organizer profile must be approved first" };
  }

  return { ok: true, userId: user.id };
}

async function loadOwnedEvent(
  eventId: string,
  organizerId: string,
): Promise<Pick<EventRow, "id" | "organizer_id" | "status" | "authority_letter_path"> | null> {
  // Service-role read after session authZ (same pattern as fees pay page).
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, organizer_id, status, authority_letter_path")
    .eq("id", eventId)
    .maybeSingle();

  const event = data as Pick<
    EventRow,
    "id" | "organizer_id" | "status" | "authority_letter_path"
  > | null;

  if (!event || event.organizer_id !== organizerId) return null;
  return event;
}

async function replacePackages(
  eventId: string,
  packages: PackageInput[],
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const { error: delErr } = await admin
    .from("sponsorship_packages")
    .delete()
    .eq("event_id", eventId);

  if (delErr) return { error: safeStr(delErr.message) };

  const rows: PackageInsert[] = packages.map((p) => ({
    event_id: eventId,
    name: p.name,
    price_paise: p.price_paise,
    deliverables: p.deliverables ?? null,
    slots_total: p.slots_total ?? null,
  }));

  const { error: insErr } = await admin.from("sponsorship_packages").insert(rows);
  if (insErr) return { error: safeStr(insErr.message) };
  return { error: null };
}

async function uploadLetterForEvent(
  organizerId: string,
  eventId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const admin = createAdminClient();
  const path = authorityLetterObjectPath(organizerId, eventId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from("event-documents").upload(path, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (error) return { path: null, error: safeStr(error.message) };
  return { path, error: null };
}

function fieldErrorsFromZod(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, issues] of Object.entries(error.flatten().fieldErrors)) {
    fieldErrors[key] = issues ?? [];
  }
  return fieldErrors;
}

/** FR-EVT-01 / FR-EVT-03: create draft event with packages. */
export async function createEvent(formData: FormData): Promise<ActionResult> {
  const auth = await requireApprovedOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  const packagesRaw = parsePackagesFromFormData(formData);
  const parsed = CreateEventSchema.safeParse({
    ...eventFieldsFromFormData(formData),
    packages: packagesRaw,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const letterCheck = validateAuthorityLetterFile(formData.get("authority_letter"));
  if (!letterCheck.ok) return { success: false, error: letterCheck.error };

  const admin = createAdminClient();
  const fields = parsed.data;

  const insertRow: EventInsert = {
    organizer_id: auth.userId,
    title: fields.title,
    description: fields.description ?? null,
    event_type_id: fields.event_type_id,
    city_id: fields.city_id,
    venue: fields.venue ?? null,
    season: fields.season ?? null,
    start_date: fields.start_date,
    end_date: fields.end_date,
    expected_audience: fields.expected_audience ?? null,
    audience_notes: fields.audience_notes ?? null,
    visibility: fields.visibility,
    ticketing: "none",
    status: "draft",
  };

  const { data: created, error: createErr } = await admin
    .from("events")
    .insert(insertRow)
    .select("id")
    .single();

  if (createErr || !created) {
    return { success: false, error: safeStr(createErr?.message) || "Could not create event" };
  }

  const eventId = (created as { id: string }).id;

  const pkgResult = await replacePackages(eventId, fields.packages);
  if (pkgResult.error) {
    await admin.from("events").delete().eq("id", eventId);
    return { success: false, error: pkgResult.error };
  }

  if (letterCheck.file) {
    const uploaded = await uploadLetterForEvent(auth.userId, eventId, letterCheck.file);
    if (uploaded.error || !uploaded.path) {
      return {
        success: false,
        error: uploaded.error ?? "Letter upload failed",
        eventId,
      };
    }
    const { error: pathErr } = await admin
      .from("events")
      .update({ authority_letter_path: uploaded.path } satisfies EventUpdate)
      .eq("id", eventId);
    if (pathErr) {
      return { success: false, error: safeStr(pathErr.message), eventId };
    }
  }

  return { success: true, eventId };
}

/** FR-EVT-04: edit draft or rejected event (+ packages). */
export async function updateDraftOrRejectedEvent(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireApprovedOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  const packagesRaw = parsePackagesFromFormData(formData);
  const parsed = UpdateEventSchema.safeParse({
    ...eventFieldsFromFormData(formData),
    eventId: formData.get("eventId"),
    packages: packagesRaw,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { eventId, packages, ...fields } = parsed.data;
  const event = await loadOwnedEvent(eventId, auth.userId);
  if (!event) return { success: false, error: "Event not found" };

  if (event.status !== "draft" && event.status !== "rejected") {
    return {
      success: false,
      error: "Only draft or rejected events can be edited directly",
    };
  }

  const letterCheck = validateAuthorityLetterFile(formData.get("authority_letter"));
  if (!letterCheck.ok) return { success: false, error: letterCheck.error };

  const updatePayload: EventUpdate = {
    title: fields.title,
    description: fields.description ?? null,
    event_type_id: fields.event_type_id,
    city_id: fields.city_id,
    venue: fields.venue ?? null,
    season: fields.season ?? null,
    start_date: fields.start_date,
    end_date: fields.end_date,
    expected_audience: fields.expected_audience ?? null,
    audience_notes: fields.audience_notes ?? null,
    visibility: fields.visibility,
    ticketing: "none",
  };

  if (letterCheck.file) {
    const uploaded = await uploadLetterForEvent(auth.userId, eventId, letterCheck.file);
    if (uploaded.error || !uploaded.path) {
      return { success: false, error: uploaded.error ?? "Letter upload failed" };
    }
    updatePayload.authority_letter_path = uploaded.path;
  }

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from("events")
    .update(updatePayload)
    .eq("id", eventId);

  if (updErr) return { success: false, error: safeStr(updErr.message) };

  const pkgResult = await replacePackages(eventId, packages);
  if (pkgResult.error) return { success: false, error: pkgResult.error };

  return { success: true, eventId };
}

/** FR-EVT-04: delete draft only. */
export async function deleteDraftEvent(formData: FormData): Promise<ActionResult> {
  const auth = await requireApprovedOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = EventIdSchema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const event = await loadOwnedEvent(parsed.data.eventId, auth.userId);
  if (!event) return { success: false, error: "Event not found" };
  if (event.status !== "draft") {
    return { success: false, error: "Only draft events can be deleted" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("events").delete().eq("id", event.id);
  if (error) return { success: false, error: safeStr(error.message) };
  return { success: true };
}

/** FR-EVT-06: cancel from draft | pending_review | published. */
export async function cancelEvent(formData: FormData): Promise<ActionResult> {
  const auth = await requireApprovedOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = EventIdSchema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const event = await loadOwnedEvent(parsed.data.eventId, auth.userId);
  if (!event) return { success: false, error: "Event not found" };

  const allowed: EventStatus[] = ["draft", "pending_review", "published"];
  if (!allowed.includes(event.status)) {
    return {
      success: false,
      error: `Cannot cancel event with status '${event.status}'`,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({ status: "cancelled" } satisfies EventUpdate)
    .eq("id", event.id);

  if (error) return { success: false, error: safeStr(error.message) };
  return { success: true, eventId: event.id };
}

/**
 * FR-EVT-05 / BR-14: rejected → pending_review without re-payment.
 * Draft submission is via listing fee payment + webhook.
 */
export async function resubmitRejectedEvent(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireApprovedOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = EventIdSchema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const event = await loadOwnedEvent(parsed.data.eventId, auth.userId);
  if (!event) return { success: false, error: "Event not found" };
  if (event.status !== "rejected") {
    return { success: false, error: "Only rejected events can be resubmitted" };
  }

  const admin = createAdminClient();
  const { data: packages, error: pkgErr } = await admin
    .from("sponsorship_packages")
    .select("id")
    .eq("event_id", event.id);

  if (pkgErr) return { success: false, error: safeStr(pkgErr.message) };
  if (!packages || packages.length === 0) {
    return {
      success: false,
      error: "Add at least one sponsorship package before resubmitting",
    };
  }

  const { error } = await admin
    .from("events")
    .update({ status: "pending_review" } satisfies EventUpdate)
    .eq("id", event.id);

  if (error) return { success: false, error: safeStr(error.message) };
  return { success: true, eventId: event.id };
}

/**
 * FR-EVT-10 / BR-15: published edits → event_change_requests.
 * Live event row stays unchanged until admin approves.
 */
export async function submitPublishedChangeRequest(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireApprovedOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  const packagesRaw = parsePackagesFromFormData(formData);
  const parsed = ChangeRequestSchema.safeParse({
    ...eventFieldsFromFormData(formData),
    eventId: formData.get("eventId"),
    packages: packagesRaw,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { eventId, packages, ...fields } = parsed.data;
  const event = await loadOwnedEvent(eventId, auth.userId);
  if (!event) return { success: false, error: "Event not found" };
  if (event.status !== "published") {
    return {
      success: false,
      error: "Change requests are only for published events",
    };
  }

  const letterCheck = validateAuthorityLetterFile(formData.get("authority_letter"));
  if (!letterCheck.ok) return { success: false, error: letterCheck.error };

  let newLetterPath: string | null = null;
  if (letterCheck.file) {
    const uploaded = await uploadLetterForEvent(auth.userId, eventId, letterCheck.file);
    if (uploaded.error || !uploaded.path) {
      return { success: false, error: uploaded.error ?? "Letter upload failed" };
    }
    newLetterPath = uploaded.path;
  }

  const proposed_fields: Record<string, unknown> = {
    title: fields.title,
    description: fields.description ?? null,
    event_type_id: fields.event_type_id,
    city_id: fields.city_id,
    venue: fields.venue ?? null,
    season: fields.season ?? null,
    start_date: fields.start_date,
    end_date: fields.end_date,
    expected_audience: fields.expected_audience ?? null,
    audience_notes: fields.audience_notes ?? null,
    visibility: fields.visibility,
  };
  if (newLetterPath) {
    proposed_fields["authority_letter_path"] = newLetterPath;
  }

  const proposed_packages = packages.map((p) => ({
    id: p.id ?? null,
    name: p.name,
    price_paise: p.price_paise,
    deliverables: p.deliverables ?? null,
    slots_total: p.slots_total ?? null,
  }));

  const admin = createAdminClient();
  const { error } = await admin.from("event_change_requests").insert({
    event_id: eventId,
    proposed_fields: proposed_fields as Json,
    proposed_packages: proposed_packages as Json,
    new_authority_letter_path: newLetterPath,
    status: "pending",
  });

  if (error) {
    const msg = safeStr(error.message);
    if (msg.toLowerCase().includes("event_change_requests_one_pending")) {
      return {
        success: false,
        error: "A change request is already pending for this event",
      };
    }
    return { success: false, error: msg };
  }

  return { success: true, eventId };
}

/** FR-EVT-09: upload / replace letter on draft or rejected event. */
export async function uploadAuthorityLetter(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireApprovedOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = EventIdSchema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const event = await loadOwnedEvent(parsed.data.eventId, auth.userId);
  if (!event) return { success: false, error: "Event not found" };
  if (event.status !== "draft" && event.status !== "rejected") {
    return {
      success: false,
      error:
        "Upload letter on draft/rejected events, or submit a change request when published",
    };
  }

  const letterCheck = validateAuthorityLetterFile(formData.get("authority_letter"));
  if (!letterCheck.ok) return { success: false, error: letterCheck.error };
  if (!letterCheck.file) {
    return { success: false, error: "Authority letter PDF is required" };
  }

  const uploaded = await uploadLetterForEvent(auth.userId, event.id, letterCheck.file);
  if (uploaded.error || !uploaded.path) {
    return { success: false, error: uploaded.error ?? "Letter upload failed" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({ authority_letter_path: uploaded.path } satisfies EventUpdate)
    .eq("id", event.id);

  if (error) return { success: false, error: safeStr(error.message) };
  return { success: true, eventId: event.id };
}

/**
 * Short-lived signed URL for authority letter (organizer owner or admin).
 * Never expose the private bucket publicly.
 */
export async function getAuthorityLetterSignedUrl(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = EventIdSchema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as { role: UserRole } | null)?.role;
  const isAdminUser = role === "admin" || role === "super_admin";

  const admin = createAdminClient();
  const { data: eventData } = await admin
    .from("events")
    .select("id, organizer_id, authority_letter_path")
    .eq("id", parsed.data.eventId)
    .maybeSingle();

  const event = eventData as Pick<
    EventRow,
    "id" | "organizer_id" | "authority_letter_path"
  > | null;

  if (!event) return { success: false, error: "Event not found" };
  if (!isAdminUser && event.organizer_id !== user.id) {
    return { success: false, error: "Forbidden" };
  }
  if (!event.authority_letter_path) {
    return { success: false, error: "No authority letter uploaded" };
  }

  const { data: signed, error } = await admin.storage
    .from("event-documents")
    .createSignedUrl(event.authority_letter_path, 60);

  if (error || !signed?.signedUrl) {
    return { success: false, error: safeStr(error?.message) || "Could not create link" };
  }

  return { success: true, url: signed.signedUrl };
}

export { requireApprovedOrganizer };
