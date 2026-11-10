import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  city_id: z.number().int().positive().nullable().optional(),
  preferred_language: z.enum(['en', 'hi', 'gu']).optional(),
})

/**
 * PATCH /api/auth/profile
 * Updates allowed profile fields. Role is NOT an accepted field.
 * Any attempt to include `role` in the body returns 400.
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Explicitly reject any attempt to change the role
  if (typeof body === 'object' && body !== null && 'role' in body) {
    return NextResponse.json(
      { error: 'Role changes are not permitted via this endpoint' },
      { status: 400 },
    )
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', user.id)
    .select('id, full_name, city_id, preferred_language, role')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
