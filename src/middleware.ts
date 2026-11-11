import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import type { Database } from "./lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

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

  // Fetch the profile row to check role and organizer profile completion.
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profileData as { role: UserRole } | null)?.role;

  // Organizer profile-completion gate.
  // If the organizer has not yet created their organizer_profiles row, send them
  // to the completion screen (except if they are already on it or on pending/rejected).
  if (
    role === "organizer" &&
    !logicalPath.startsWith("/profile/complete") &&
    !logicalPath.startsWith("/pending") &&
    !logicalPath.startsWith("/rejected") &&
    !logicalPath.startsWith("/auth")
  ) {
    const { data: orgProfileData } = await supabase
      .from("organizer_profiles")
      .select("user_id, verification_status")
      .eq("user_id", user.id)
      .single();

    type OrgProfile = { user_id: string; verification_status: "pending" | "approved" | "rejected" };
    const orgProfile = orgProfileData as OrgProfile | null;

    if (!orgProfile) {
      return redirectTo("/profile/complete");
    }

    // Profile exists but is pending → hold on the pending page (unless already there)
    if (
      orgProfile.verification_status === "pending" &&
      !logicalPath.startsWith("/pending")
    ) {
      return redirectTo("/pending");
    }

    // Profile rejected → show the rejected screen
    if (
      orgProfile.verification_status === "rejected" &&
      !logicalPath.startsWith("/rejected")
    ) {
      return redirectTo("/rejected");
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
