"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Read the caller's role from the server session.
 * Returns null if the user is not authenticated.
 */
async function getCallerRole(): Promise<UserRole | null> {
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) return null;

  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return (profileData as { role: UserRole } | null)?.role ?? null;
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: UserRole } | null;

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return { ok: false, error: "Forbidden: admin role required" };
  }
  return { ok: true, userId: user.id };
}

// ============================================================
// FR-ADM-02 / FR-ORG-03: Approve / reject an organizer
// ============================================================

const OrganizerIdSchema = z.object({
  organizerId: z.string().uuid(),
});

const RejectOrganizerSchema = z.object({
  organizerId: z.string().uuid(),
  reason: z.string().min(1, "Rejection reason is required").max(500),
});

export async function approveOrganizer(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = OrganizerIdSchema.safeParse({
    organizerId: formData.get("organizerId"),
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { organizerId } = parsed.data;
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("organizer_profiles")
    .update({
      verification_status: "approved",
      verified_at: new Date().toISOString(),
      verified_by: auth.userId,
      rejection_reason: null,
    })
    .eq("user_id", organizerId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "approve_organizer",
    entity: "organizer_profiles",
    entity_id: organizerId,
  });

  return { success: true };
}

export async function rejectOrganizer(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = RejectOrganizerSchema.safeParse({
    organizerId: formData.get("organizerId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { organizerId, reason } = parsed.data;
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("organizer_profiles")
    .update({
      verification_status: "rejected",
      rejection_reason: reason,
    })
    .eq("user_id", organizerId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "reject_organizer",
    entity: "organizer_profiles",
    entity_id: organizerId,
    details: { reason },
  });

  return { success: true };
}

// ============================================================
// FR-ADM-02 / FR-ADM-03: Approve / reject a pending event (→ published / rejected)
// ============================================================

const EventIdSchema = z.object({
  eventId: z.string().uuid(),
});

const RejectEventSchema = z.object({
  eventId: z.string().uuid(),
  reason: z.string().min(1, "Rejection reason is required").max(500),
});

export async function approveEvent(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = EventIdSchema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { eventId } = parsed.data;
  const adminClient = createAdminClient();

  // Verify the event is in pending_review before approving
  const { data: event } = await adminClient
    .from("events")
    .select("status")
    .eq("id", eventId)
    .single();

  if (event?.status !== "pending_review") {
    return {
      success: false,
      error: `Cannot approve event with status '${safeStr(event?.status)}'`,
    };
  }

  const { error } = await adminClient
    .from("events")
    .update({ status: "published", rejection_reason: null })
    .eq("id", eventId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "approve_event",
    entity: "events",
    entity_id: eventId,
  });

  return { success: true };
}

export async function rejectEvent(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = RejectEventSchema.safeParse({
    eventId: formData.get("eventId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { eventId, reason } = parsed.data;
  const adminClient = createAdminClient();

  const { data: event } = await adminClient
    .from("events")
    .select("status")
    .eq("id", eventId)
    .single();

  if (event?.status !== "pending_review") {
    return {
      success: false,
      error: `Cannot reject event with status '${safeStr(event?.status)}'`,
    };
  }

  const { error } = await adminClient
    .from("events")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", eventId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "reject_event",
    entity: "events",
    entity_id: eventId,
    details: { reason },
  });

  return { success: true };
}

// ============================================================
// FR-ADM-12: Approve / reject a change request for a published event
// ============================================================

const ChangeRequestIdSchema = z.object({
  changeRequestId: z.string().uuid(),
});

const RejectChangeRequestSchema = z.object({
  changeRequestId: z.string().uuid(),
  reason: z.string().min(1, "Rejection reason is required").max(500),
});

export async function approveChangeRequest(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = ChangeRequestIdSchema.safeParse({
    changeRequestId: formData.get("changeRequestId"),
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { changeRequestId } = parsed.data;
  const adminClient = createAdminClient();

  const { data: cr } = await adminClient
    .from("event_change_requests")
    .select("event_id, proposed_fields, proposed_packages, status")
    .eq("id", changeRequestId)
    .single();

  if (!cr) return { success: false, error: "Change request not found" };
  if (cr.status !== "pending") {
    return { success: false, error: "Change request is no longer pending" };
  }

  // Apply proposed_fields to the events row.
  // We build a typed partial update object matching Database events Update shape.
  const fields = cr.proposed_fields as Record<string, unknown>;

  type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
  const allowedFields: (keyof EventUpdate)[] = [
    "title", "description", "venue", "season",
    "start_date", "end_date", "expected_audience",
    "audience_notes", "visibility", "authority_letter_path",
  ];

  const eventUpdate: EventUpdate = {};
  for (const key of allowedFields) {
    if (key in fields) {
      // Use Object.assign to stay within the typed shape
      (eventUpdate as Record<string, unknown>)[key] = fields[key];
    }
  }

  if (Object.keys(eventUpdate).length > 0) {
    const { error: eventErr } = await adminClient
      .from("events")
      .update(eventUpdate)
      .eq("id", cr.event_id);

    if (eventErr) return { success: false, error: safeStr(eventErr.message) };
  }

  // Mark the change request as approved
  const { error: crErr } = await adminClient
    .from("event_change_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq("id", changeRequestId);

  if (crErr) return { success: false, error: safeStr(crErr.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "approve_change_request",
    entity: "event_change_requests",
    entity_id: changeRequestId,
    details: { event_id: cr.event_id },
  });

  return { success: true };
}

export async function rejectChangeRequest(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = RejectChangeRequestSchema.safeParse({
    changeRequestId: formData.get("changeRequestId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { changeRequestId, reason } = parsed.data;
  const adminClient = createAdminClient();

  const { data: cr } = await adminClient
    .from("event_change_requests")
    .select("event_id, status")
    .eq("id", changeRequestId)
    .single();

  if (!cr) return { success: false, error: "Change request not found" };
  if (cr.status !== "pending") {
    return { success: false, error: "Change request is no longer pending" };
  }

  const { error } = await adminClient
    .from("event_change_requests")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq("id", changeRequestId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "reject_change_request",
    entity: "event_change_requests",
    entity_id: changeRequestId,
    details: { event_id: cr.event_id, reason },
  });

  return { success: true };
}

// Export for test access
export { getCallerRole, requireAdmin };
