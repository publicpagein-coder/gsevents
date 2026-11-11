import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Legacy organizer completion route.
 * Organizer fields now live on the unified /profile form.
 */
export default async function ProfileCompleteRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/profile`);
}
