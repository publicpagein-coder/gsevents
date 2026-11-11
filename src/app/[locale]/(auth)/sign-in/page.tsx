import { SignInClient } from "./SignInClient";

interface SignInPageProps {
  params: Promise<{ locale: string }>;
}

/** FR-AUTH-01, FR-AUTH-02 — Phone OTP sign-in / sign-up page. */
export default async function SignInPage({ params }: SignInPageProps) {
  const { locale } = await params;
  return <SignInClient locale={locale} />;
}
