'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { roleChoiceSchema } from '@/lib/auth-utils'

export type SetRoleResult =
  | { ok: true; role: 'organizer' | 'sponsor' }
  | { ok: false; error: string }

/**
 * Sets the user's role after initial signup.
 *
 * Security:
 * - Zod schema rejects 'admin' and 'general' — only 'organizer' or 'sponsor' are accepted.
 * - The service-role client updates the profiles row (bypassing RLS guard trigger which blocks
 *   regular users from changing role).
 * - The auth user metadata is also updated so subsequent logins bypass the role-choice screen.
 */
export async function setUserRole(formData: FormData): Promise<SetRoleResult> {
  const raw = formData.get('role')

  const parsed = roleChoiceSchema.safeParse({ role: raw })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid role' }
  }

  const { role } = parsed.data

  // Verify the user is authenticated
  const userClient = createClient()
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return { ok: false, error: 'Not authenticated' }
  }

  // Update the profile row using the service-role client so the guard trigger allows it
  const service = createServiceClient()

  const { error: profileError } = await service
    .from('profiles')
    .update({ role })
    .eq('id', user.id)

  if (profileError) {
    return { ok: false, error: profileError.message }
  }

  // Update auth user metadata so the role is visible on subsequent logins
  const { error: metaError } = await service.auth.admin.updateUserById(user.id, {
    user_metadata: { role },
  })

  if (metaError) {
    // Non-fatal: profile was updated; metadata update can be retried
    console.error('Failed to update user metadata role:', metaError.message)
  }

  return { ok: true, role }
}
