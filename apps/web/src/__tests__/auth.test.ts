import { describe, it, expect, vi } from 'vitest'
import { roleChoiceSchema, phoneSchema, otpSchema, getRedirectAfterVerify } from '@/lib/auth-utils'

// ---------------------------------------------------------------------------
// 1. Role-choice schema: organizer and sponsor allowed, admin blocked
// ---------------------------------------------------------------------------
describe('roleChoiceSchema', () => {
  it('allows the organizer role', () => {
    const result = roleChoiceSchema.safeParse({ role: 'organizer' })
    expect(result.success).toBe(true)
  })

  it('allows the sponsor role', () => {
    const result = roleChoiceSchema.safeParse({ role: 'sponsor' })
    expect(result.success).toBe(true)
  })

  it('rejects the admin role', () => {
    const result = roleChoiceSchema.safeParse({ role: 'admin' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBeTruthy()
  })

  it('rejects general role', () => {
    const result = roleChoiceSchema.safeParse({ role: 'general' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty role', () => {
    const result = roleChoiceSchema.safeParse({ role: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an arbitrary string', () => {
    const result = roleChoiceSchema.safeParse({ role: 'superadmin' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. Phone schema validation
// ---------------------------------------------------------------------------
describe('phoneSchema', () => {
  it('accepts a valid E.164 Indian number', () => {
    const result = phoneSchema.safeParse({ phone: '+919876543210' })
    expect(result.success).toBe(true)
  })

  it('rejects a number without country code', () => {
    const result = phoneSchema.safeParse({ phone: '9876543210' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty string', () => {
    const result = phoneSchema.safeParse({ phone: '' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. OTP schema validation
// ---------------------------------------------------------------------------
describe('otpSchema', () => {
  it('accepts a 6-digit numeric OTP', () => {
    expect(otpSchema.safeParse({ otp: '123456' }).success).toBe(true)
  })

  it('rejects fewer than 6 digits', () => {
    expect(otpSchema.safeParse({ otp: '12345' }).success).toBe(false)
  })

  it('rejects alphabetic characters', () => {
    expect(otpSchema.safeParse({ otp: '12345a' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. Redirect logic after OTP verification
// ---------------------------------------------------------------------------
describe('getRedirectAfterVerify', () => {
  const locale = 'en'

  it('sends users with no role metadata to role-choice', () => {
    expect(getRedirectAfterVerify(undefined, locale)).toBe('/en/role-choice')
    expect(getRedirectAfterVerify(null, locale)).toBe('/en/role-choice')
  })

  it('sends users whose role is "general" (DB default for new users) to role-choice', () => {
    expect(getRedirectAfterVerify('general', locale)).toBe('/en/role-choice')
  })

  it('sends organizers to the organizer dashboard', () => {
    expect(getRedirectAfterVerify('organizer', locale)).toBe('/en/organizer-dashboard')
  })

  it('sends sponsors to the sponsor dashboard', () => {
    expect(getRedirectAfterVerify('sponsor', locale)).toBe('/en/sponsor-dashboard')
  })

  it('sends unrecognised role to home', () => {
    expect(getRedirectAfterVerify('unknown_role', locale)).toBe('/en')
  })

  it('respects the locale prefix', () => {
    expect(getRedirectAfterVerify('organizer', 'hi')).toBe('/hi/organizer-dashboard')
    expect(getRedirectAfterVerify(undefined, 'gu')).toBe('/gu/role-choice')
  })
})

// ---------------------------------------------------------------------------
// 5. Profile API route: role change is rejected
// ---------------------------------------------------------------------------
describe('PATCH /api/auth/profile — role change protection', () => {
  it('returns 400 when the request body contains a role field', async () => {
    // Import the route handler dynamically to allow vi.mock to run first
    vi.mock('@/lib/supabase/server', () => ({
      createClient: vi.fn(() => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123', phone: '+919999999999' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: {}, error: null }),
              }),
            }),
          }),
        }),
      })),
    }))

    const { PATCH } = await import('@/app/api/auth/profile/route')

    const request = new Request('http://localhost/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    })

    // Cast because NextRequest extends Request; in test environment bare Request works
    const response = await PATCH(request as Parameters<typeof PATCH>[0])
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await response.json()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.status).toBe(400)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(json.error).toMatch(/role/i)
  })

  it('allows updating allowed fields without a role', async () => {
    vi.mock('@/lib/supabase/server', () => ({
      createClient: vi.fn(() => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123', phone: '+919999999999' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'user-123', full_name: 'Test User', preferred_language: 'en', role: 'organizer' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })),
    }))

    const { PATCH } = await import('@/app/api/auth/profile/route')

    const request = new Request('http://localhost/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Test User', preferred_language: 'en' }),
    })

    const response = await PATCH(request as Parameters<typeof PATCH>[0])
    expect(response.status).toBe(200)
  })
})
