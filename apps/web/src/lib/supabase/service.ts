import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client. Use ONLY in server-side code (route handlers, server actions, webhooks).
 * Never import this in any client component.
 */
export function createServiceClient() {
  return createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
