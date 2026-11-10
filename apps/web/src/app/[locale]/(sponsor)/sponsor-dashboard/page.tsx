import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SponsorDashboardPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  const fullName = typeof profile?.full_name === 'string' ? profile.full_name : ''
  return <DashboardContent locale={locale} name={fullName} />
}

function DashboardContent({ locale, name }: { locale: string; name: string }) {
  const t = useTranslations('dashboard.sponsor')
  const tn = useTranslations('nav')

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{t('title')}</h1>
      {name ? <p className="mb-6 text-gray-600">{t('welcome', { name })}</p> : null}
      <p className="mb-8 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
        {t('completeProfile')}
      </p>
      <nav className="flex gap-4">
        <Link
          href={`/${locale}/profile`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tn('profile')}
        </Link>
      </nav>
    </main>
  )
}
