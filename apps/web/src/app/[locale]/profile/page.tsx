import { redirect } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProfileForm } from '@/components/profile/ProfileForm'

export default async function ProfilePage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const [profileResult, citiesResult] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, city_id, preferred_language').eq('id', user.id).single(),
    supabase.from('cities').select('id, name, state').eq('is_active', true).order('name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const profile = profileResult.data as { full_name?: string | null; city_id?: number | null; preferred_language?: string | null } | null
  const cities = (citiesResult.data ?? []) as Array<{ id: number; name: string; state: string }>

  return (
    <ProfilePageContent
      locale={locale}
      initialData={{
        fullName: profile?.full_name ?? null,
        phone: user.phone ?? null,
        cityId: profile?.city_id ?? null,
        preferredLanguage: (profile?.preferred_language as 'en' | 'hi' | 'gu' | null | undefined) ?? 'en',
      }}
      cities={cities}
    />
  )
}

function ProfilePageContent({
  locale,
  initialData,
  cities,
}: {
  locale: string
  initialData: {
    fullName: string | null
    phone: string | null
    cityId: number | null
    preferredLanguage: 'en' | 'hi' | 'gu'
  }
  cities: Array<{ id: number; name: string; state: string }>
}) {
  const t = useTranslations('profile')

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm locale={locale} initialData={initialData} cities={cities} />
        </CardContent>
      </Card>
    </main>
  )
}
