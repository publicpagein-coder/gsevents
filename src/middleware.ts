import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import type { Database } from "./lib/supabase/types";
import { isOrganizerProfileIncomplete } from "./lib/organizer-profile";

type UserRole = Database["public"]["Enums"]["user_role"];
type VerificationStatus = Database["public"]["Enums"]["verification_status"];

const intlMiddleware = createMiddleware(routing);

/** Paths (after stripping the locale prefix) that require no authentication. */
const PUBLIC_PATH_PREFIXES = [
  "/",
  "/auth",
  "/events",
];

function isPublicPath(pathname: string): boolean {
  // Strip locale prefix — e.g. /en/auth/... → /auth/...
  const withoutLocale = pathname.replace(/^\/(?:en|hi|gu)/, "") || "/";
  return PUBLIC_PATH_PREFIXES.some((p) =>
    withoutLocale === p || withoutLocale.startsWith(p + "/"),
  );
}

export async function middleware(request: NextRequest) {
  // Run intl middleware first so the locale cookie and headers are set.
  const intlResponse = intlMiddleware(request);

  const { pathname } = request.nextUrl;

  // Skip auth checks for truly public paths and Next.js internals.
  if (isPublicPath(pathname)) {
    return intlResponse;
  }

  // Build a Supabase server client that reads the session from cookies.
  let response = intlResponse ?? NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Strip locale to get the logical path for routing decisions.
  const logicalPath = pathname.replace(/^\/(?:en|hi|gu)/, "") || "/";
  const locale = pathname.match(/^\/(en|hi|gu)/)?.[1] ?? "en";

  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${path}`;
    return NextResponse.redirect(url);
  }

  // FR-AUTH-05: Unauthenticated users hitting any non-public route → sign-in.
  // isPublicPath() already returned above for public paths, so any route
  // reaching here requires authentication.
  if (!user) {
    return redirectTo("/auth/sign-in");
  }

  // Fetch the profile row (role + organizer fields live on profiles).
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, org_name, org_type, venue_name, verification_status")
    .eq("id", user.id)
    .single();

  type ProfileGate = {
    role: UserRole;
    org_name: string | null;
    org_type: string | null;
    venue_name: string | null;
    verification_status: VerificationStatus | null;
  };

  const profile = profileData as ProfileGate | null;
  const role = profile?.role;

  // Organizer profile-completion gate (unified profiles table).
  // Incomplete = missing required org fields on profiles (not a missing row).
  // /profile is allowed so organizers can fill or resubmit the unified form.
  if (
    role === "organizer" &&
    profile &&
    !logicalPath.startsWith("/auth")
  ) {
    const incomplete = isOrganizerProfileIncomplete({
      org_name: profile.org_name,
      org_type: profile.org_type,
      venue_name: profile.venue_name,
    });

    if (incomplete) {
      if (!logicalPath.startsWith("/profile")) {
        return redirectTo("/profile");
      }
    } else if (profile.verification_status === "pending") {
      if (!logicalPath.startsWith("/pending")) {
        return redirectTo("/pending");
      }
    } else if (profile.verification_status === "rejected") {
      if (
        !logicalPath.startsWith("/rejected") &&
        !logicalPath.startsWith("/profile")
      ) {
        return redirectTo("/rejected");
      }
    }
  }

  // Admin route guard — requires admin or super_admin
  if (logicalPath.startsWith("/admin")) {
    if (role !== "admin" && role !== "super_admin") {
      return redirectTo("/");
    }

    // Super-admin-only sub-routes
    if (logicalPath.startsWith("/admin/super") && role !== "super_admin") {
      return redirectTo("/admin");
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
