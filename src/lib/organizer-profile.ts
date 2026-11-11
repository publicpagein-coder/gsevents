/**
 * Required organizer fields on the unified profiles table (FR-ORG-01).
 * Missing any of these means the organizer profile is incomplete.
 */
export function isOrganizerProfileIncomplete(fields: {
  org_name: string | null;
  org_type: string | null;
  venue_name: string | null;
}): boolean {
  return (
    !fields.org_name?.trim() ||
    !fields.org_type ||
    !fields.venue_name?.trim()
  );
}
