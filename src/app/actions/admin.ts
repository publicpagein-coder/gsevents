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

  const { data: targetData } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", organizerId)
    .single();

  const target = targetData as { id: string; role: UserRole } | null;
  if (!target || target.role !== "organizer") {
    return { success: false, error: "Organizer profile not found" };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({
      verification_status: "approved",
      verified_at: new Date().toISOString(),
      verified_by: auth.userId,
      rejection_reason: null,
    })
    .eq("id", organizerId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "approve_organizer",
    entity: "profiles",
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

  const { data: targetData } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", organizerId)
    .single();

  const target = targetData as { id: string; role: UserRole } | null;
  if (!target || target.role !== "organizer") {
    return { success: false, error: "Organizer profile not found" };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({
      verification_status: "rejected",
      rejection_reason: reason,
    })
    .eq("id", organizerId);

  if (error) return { success: false, error: safeStr(error.message) };

  await adminClient.from("audit_log").insert({
    actor_id: auth.userId,
    action: "reject_organizer",
    entity: "profiles",
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
    .select(
      "event_id, proposed_fields, proposed_packages, new_authority_letter_path, status",
    )
    .eq("id", changeRequestId)
    .single();

  if (!cr) return { success: false, error: "Change request not found" };
  if (cr.status !== "pending") {
    return { success: false, error: "Change request is no longer pending" };
  }

  // Apply proposed_fields to the events row (FR-ADM-12 / FR-EVT-10).
  const fields = cr.proposed_fields as Record<string, unknown>;

  type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
  const allowedFields: (keyof EventUpdate)[] = [
    "title",
    "description",
    "event_type_id",
    "city_id",
    "venue",
    "season",
    "start_date",
    "end_date",
    "expected_audience",
    "audience_notes",
    "visibility",
    "authority_letter_path",
  ];

  const eventUpdate: EventUpdate = {};
  for (const key of allowedFields) {
    if (key in fields) {
      (eventUpdate as Record<string, unknown>)[key] = fields[key];
    }
  }

  // Prefer explicit new_authority_letter_path column when present (FR-EVT-09).
  if (cr.new_authority_letter_path) {
    eventUpdate.authority_letter_path = cr.new_authority_letter_path;
  }

  if (Object.keys(eventUpdate).length > 0) {
    const { error: eventErr } = await adminClient
      .from("events")
      .update(eventUpdate)
      .eq("id", cr.event_id);

    if (eventErr) return { success: false, error: safeStr(eventErr.message) };
  }

  // Apply proposed_packages: full replace when non-null (BR-15).
  if (cr.proposed_packages !== null && cr.proposed_packages !== undefined) {
    const rawPackages = cr.proposed_packages;
    if (!Array.isArray(rawPackages)) {
      return { success: false, error: "Invalid proposed packages payload" };
    }

    const { error: delErr } = await adminClient
      .from("sponsorship_packages")
      .delete()
      .eq("event_id", cr.event_id);
    if (delErr) return { success: false, error: safeStr(delErr.message) };

    if (rawPackages.length > 0) {
      type PackageInsert = Database["public"]["Tables"]["sponsorship_packages"]["Insert"];
      const rows: PackageInsert[] = [];
      for (const item of rawPackages) {
        if (!item || typeof item !== "object") {
          return { success: false, error: "Invalid proposed package row" };
        }
        const row = item as Record<string, unknown>;
        const name = typeof row["name"] === "string" ? row["name"] : null;
        const price = row["price_paise"];
        if (!name || typeof price !== "number" || price < 0) {
          return { success: false, error: "Invalid proposed package row" };
        }
        rows.push({
          event_id: cr.event_id,
          name,
          price_paise: price,
          deliverables:
            typeof row["deliverables"] === "string" ? row["deliverables"] : null,
          slots_total:
            typeof row["slots_total"] === "number" ? row["slots_total"] : null,
        });
      }

      const { error: insErr } = await adminClient
        .from("sponsorship_packages")
        .insert(rows);
      if (insErr) return { success: false, error: safeStr(insErr.message) };
    }
  }

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
