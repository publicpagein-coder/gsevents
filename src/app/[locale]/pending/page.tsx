import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type OrgProfileStatus = Pick<
  Database["public"]["Tables"]["organizer_profiles"]["Row"],
  "verification_status"
>;

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * FR-ORG-02: Holding page shown to an organizer whose profile is pending review.
 * The middleware also redirects here automatically; this page is the explicit route.
 */
export default async function PendingPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const t = await getTranslations("org.pending");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/sign-in`);

  const { data: orgProfileData } = await supabase
    .from("organizer_profiles")
    .select("verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const orgProfile = orgProfileData as OrgProfileStatus | null;

  if (!orgProfile) redirect(`/${locale}/profile/complete`);
  if (orgProfile.verification_status === "approved") redirect(`/${locale}/`);
  if (orgProfile.verification_status === "rejected") redirect(`/${locale}/rejected`);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-7 w-7 text-yellow-600" />
          </div>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t("message")}</p>
          <Alert variant="warning">
            <AlertDescription>{t("contactSupport")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
