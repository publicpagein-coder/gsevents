import { redirect } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/server'
import { safeStr, safeNum, safeRows } from '@/lib/db-utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProfileForm } from '@/components/profile/ProfileForm'

const VALID_LANGUAGES = ['en', 'hi', 'gu'] as const
type Language = (typeof VALID_LANGUAGES)[number]

function toLanguage(raw: string | null): Language {
  if (raw !== null && (VALID_LANGUAGES as readonly string[]).includes(raw)) return raw as Language
  return 'en'
}

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

  const [profileResult, citiesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, city_id, preferred_language')
      .eq('id', user.id)
      .single(),
    supabase.from('cities').select('id, name, state').eq('is_active', true).order('name'),
  ])

  // Extract only plain primitive values using the safe helpers —
  // never pass Supabase result objects directly across the Server→Client boundary.
  const profileData = profileResult.data
  const initialData = {
    fullName: safeStr(profileData, 'full_name'),
    phone: typeof user.phone === 'string' ? user.phone : null,
    cityId: safeNum(profileData, 'city_id'),
    preferredLanguage: toLanguage(safeStr(profileData, 'preferred_language')),
  }

  const cities = safeRows(citiesResult.data)
    .map((row) => ({
      id: safeNum(row, 'id'),
      name: safeStr(row, 'name'),
      state: safeStr(row, 'state'),
    }))
    .filter(
      (c): c is { id: number; name: string; state: string } =>
        c.id !== null && c.name !== null && c.state !== null,
    )

  return (
    <ProfilePageContent locale={locale} initialData={initialData} cities={cities} />
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
    preferredLanguage: Language
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
