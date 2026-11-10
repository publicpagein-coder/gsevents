import { useTranslations } from 'next-intl'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { RoleChoiceCard } from '@/components/auth/RoleChoiceCard'

export default async function RoleChoicePage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  // Must be authenticated to reach this page
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  // If the user already has a non-general role, they don't need to pick again
  const metadataRole = user.user_metadata?.['role'] as string | undefined
  if (metadataRole === 'organizer') redirect(`/${locale}/organizer-dashboard`)
  if (metadataRole === 'sponsor') redirect(`/${locale}/sponsor-dashboard`)

  return <RoleChoicePageContent locale={locale} />
}

function RoleChoicePageContent({ locale }: { locale: string }) {
  const t = useTranslations('auth.roleChoice')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <RoleChoiceCard locale={locale} />
      </CardContent>
    </Card>
  )
}
