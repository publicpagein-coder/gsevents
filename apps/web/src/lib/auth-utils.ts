import { z } from 'zod'

export const ALLOWED_SIGNUP_ROLES = ['organizer', 'sponsor'] as const
export type SignupRole = (typeof ALLOWED_SIGNUP_ROLES)[number]

/** Allowed roles at signup — admin is explicitly excluded. */
export const roleChoiceSchema = z.object({
  role: z.enum(ALLOWED_SIGNUP_ROLES, {
    errorMap: () => ({ message: 'Role must be organizer or sponsor' }),
  }),
})

export type RoleChoiceInput = z.infer<typeof roleChoiceSchema>

export const phoneSchema = z.object({
  phone: z
    .string()
    .min(8, 'Enter a valid phone number with country code')
    .regex(/^\+[1-9]\d{6,14}$/, 'Enter a valid phone number with country code (e.g. +91...)'),
})

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'Enter the 6-digit code sent to your phone')
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
})

/**
 * Determine where to redirect after a successful OTP verification.
 * - New users (no role or role = 'general' from default trigger) → role-choice
 * - Returning organizers → organizer-dashboard
 * - Returning sponsors → sponsor-dashboard
 * - Anyone else → home
 */
export function getRedirectAfterVerify(
  metadataRole: string | undefined | null,
  locale: string,
): string {
  if (!metadataRole || metadataRole === 'general') {
    return `/${locale}/role-choice`
  }
  if (metadataRole === 'organizer') return `/${locale}/organizer-dashboard`
  if (metadataRole === 'sponsor') return `/${locale}/sponsor-dashboard`
  return `/${locale}`
}
