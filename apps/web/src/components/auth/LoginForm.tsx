'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestOtp } from '@/app/[locale]/(auth)/login/actions'

interface LoginFormProps {
  locale: string
}

export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations('auth.login')
  const tc = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const data = new FormData(e.currentTarget)
    startTransition(() => {
      void (async () => {
        const result = await requestOtp(data)
        if (result.ok) {
          sessionStorage.setItem('gsevents_otp_phone', result.phone)
          router.push(`/${locale}/verify`)
        } else {
          setError(result.error)
        }
      })()
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="phone" required>
          {t('phoneLabel')}
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder={t('phonePlaceholder')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          {...(error ? { error } : {})}
          aria-describedby={error ? 'phone-error' : 'phone-hint'}
          required
        />
        <p id="phone-hint" className="mt-1.5 text-xs text-gray-500">
          {t('phoneHint')}
        </p>
      </div>

      {error && !error ? null : null}

      <Button
        type="submit"
        isLoading={isPending}
        className="w-full"
        size="lg"
      >
        {isPending ? t('sending') : t('sendOtp')}
      </Button>

      {error ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {tc('error')}
        </p>
      ) : null}
    </form>
  )
}
