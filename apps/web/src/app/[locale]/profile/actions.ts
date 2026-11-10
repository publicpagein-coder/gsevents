'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const profileUpdateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(200),
  city_id: z.coerce.number().int().positive().nullable().optional(),
  preferred_language: z.enum(['en', 'hi', 'gu']),
})

export type ProfileUpdateResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export async function updateProfile(formData: FormData): Promise<ProfileUpdateResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not authenticated' }

  const rawCityId = formData.get('city_id')
  const parsed = profileUpdateSchema.safeParse({
    full_name: formData.get('full_name'),
    city_id: rawCityId && rawCityId !== '' ? rawCityId : null,
    preferred_language: formData.get('preferred_language'),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    parsed.error.errors.forEach((err) => {
      const field = err.path[0]?.toString()
      if (field) fieldErrors[field] = err.message
    })
    return { ok: false, error: 'Validation failed', fieldErrors }
  }

  const { full_name, city_id, preferred_language } = parsed.data

  // NOTE: The guard_profile_role trigger prevents role changes from RLS-scoped sessions.
  // We deliberately do NOT accept a `role` field here.
  const { error } = await supabase
    .from('profiles')
    .update({ full_name, city_id: city_id ?? null, preferred_language })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  return { ok: true }
}

export async function signOut(locale: string): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect(`/${locale}/login`)
}

export async function signOutAll(locale: string): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut({ scope: 'global' })
  redirect(`/${locale}/login`)
}
