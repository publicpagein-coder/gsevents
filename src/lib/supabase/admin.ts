import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role client — bypasses RLS.
 *
 * ONLY import this in:
 *  - Route Handlers (src/app/api/**)
 *  - Server Actions
 *  - Webhook handlers
 *
 * NEVER import this in client components, browser code, or any
 * file that could be bundled into the client bundle.
 * The service-role key must never appear in the browser.
 */
export function createAdminClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the admin client.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
