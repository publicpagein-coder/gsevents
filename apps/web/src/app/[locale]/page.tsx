import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  return <HomeContent locale={locale} />
}

function HomeContent({ locale }: { locale: string }) {
  const t = useTranslations('home')
  const tn = useTranslations('nav')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-24">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-brand-600">GSEvents</h1>
        <p className="mb-2 text-2xl font-semibold text-gray-800">{t('headline')}</p>
        <p className="mb-8 text-lg text-gray-500">{t('subheadline')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/${locale}/login`}
            className="rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {tn('login')}
          </Link>
          <Link
            href={`/${locale}/events`}
            className="rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {t('cta')}
          </Link>
        </div>
      </div>
    </main>
  )
}
