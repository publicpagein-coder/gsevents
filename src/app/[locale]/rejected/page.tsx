import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { isOrganizerProfileIncomplete } from "@/lib/organizer-profile";
import type { Database } from "@/lib/supabase/types";

type ProfileRejection = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "org_name" | "org_type" | "venue_name" | "verification_status" | "rejection_reason"
>;

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * FR-ORG-05: Screen shown to an organizer whose application was rejected.
 * Shows the rejection reason and a link to update their profile.
 */
export default async function RejectedPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const t = await getTranslations("org.rejected");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/sign-in`);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("org_name, org_type, venue_name, verification_status, rejection_reason")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as ProfileRejection | null;

  if (!profile || isOrganizerProfileIncomplete(profile)) {
    redirect(`/${locale}/profile`);
  }
  if (profile.verification_status === "approved") redirect(`/${locale}/`);
  if (profile.verification_status === "pending") redirect(`/${locale}/pending`);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-7 w-7 text-red-600" />
          </div>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t("message")}</p>
          <Alert variant="destructive">
            <AlertTitle>{t("reasonLabel")}</AlertTitle>
            <AlertDescription>
              {profile.rejection_reason ?? t("noReason")}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">{t("contactSupport")}</p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href={`/${locale}/profile`}>{t("updateProfile")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
