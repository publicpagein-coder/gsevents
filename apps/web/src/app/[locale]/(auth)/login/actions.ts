'use server'

import { createClient } from '@/lib/supabase/server'
import { phoneSchema } from '@/lib/auth-utils'

export type RequestOtpResult =
  | { ok: true; phone: string }
  | { ok: false; error: string }

export async function requestOtp(formData: FormData): Promise<RequestOtpResult> {
  const raw = formData.get('phone')

  const parsed = phoneSchema.safeParse({ phone: typeof raw === 'string' ? raw.trim() : '' })
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid phone number'
    return { ok: false, error: msg }
  }

  const { phone } = parsed.data
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, phone }
}
