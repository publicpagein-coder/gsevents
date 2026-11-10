import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { VerifyForm } from '@/components/auth/VerifyForm'

export default function VerifyPage({ params: { locale } }: { params: { locale: string } }) {
  return <VerifyPageContent locale={locale} />
}

function VerifyPageContent({ locale }: { locale: string }) {
  const t = useTranslations('auth.verify')

  return (
    <Card>
      <CardHeader>
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
      </CardHeader>
      <CardContent>
        <VerifyForm locale={locale} />
      </CardContent>
    </Card>
  )
}
