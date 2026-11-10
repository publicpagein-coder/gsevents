'use server'

import { createClient } from '@/lib/supabase/server'
import { otpSchema, getRedirectAfterVerify } from '@/lib/auth-utils'

export type VerifyOtpResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; expired?: boolean }

export async function verifyOtp(
  phone: string,
  formData: FormData,
  locale: string,
): Promise<VerifyOtpResult> {
  const raw = formData.get('otp')

  const parsed = otpSchema.safeParse({ otp: typeof raw === 'string' ? raw.trim() : '' })
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid OTP'
    return { ok: false, error: msg }
  }

  const { otp } = parsed.data
  const supabase = createClient()

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'sms',
  })

  if (error) {
    const expired = error.message.toLowerCase().includes('expired')
    return { ok: false, error: error.message, expired }
  }

  if (!data.user) {
    return { ok: false, error: 'Verification failed. Please try again.' }
  }

  const metadataRole = data.user.user_metadata?.['role'] as string | undefined
  const redirectTo = getRedirectAfterVerify(metadataRole, locale)

  return { ok: true, redirectTo }
}

export type ResendOtpResult = { ok: true } | { ok: false; error: string }

export async function resendOtp(phone: string): Promise<ResendOtpResult> {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
