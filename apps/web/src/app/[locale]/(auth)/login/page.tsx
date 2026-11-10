import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  return <LoginPageContent locale={locale} />
}

function LoginPageContent({ locale }: { locale: string }) {
  const t = useTranslations('auth.login')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm locale={locale} />
      </CardContent>
    </Card>
  )
}
