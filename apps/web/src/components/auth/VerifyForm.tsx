'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyOtp, resendOtp } from '@/app/[locale]/(auth)/verify/actions'

interface VerifyFormProps {
  locale: string
}

export function VerifyForm({ locale }: VerifyFormProps) {
  const t = useTranslations('auth.verify')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isResending, startResend] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState<string>('')

  useEffect(() => {
    const stored = sessionStorage.getItem('gsevents_otp_phone')
    if (!stored) {
      router.replace(`/${locale}/login`)
      return
    }
    setPhone(stored)
  }, [locale, router])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const data = new FormData(e.currentTarget)
    startTransition(() => {
      void (async () => {
        const result = await verifyOtp(phone, data, locale)
        if (result.ok) {
          sessionStorage.removeItem('gsevents_otp_phone')
          router.push(result.redirectTo)
        } else {
          setError(result.error)
        }
      })()
    })
  }

  function handleResend() {
    setError(null)
    startResend(() => {
      void (async () => {
        const result = await resendOtp(phone)
        if (!result.ok) setError(result.error)
      })()
    })
  }

  return (
    <div className="space-y-5">
      {phone ? (
        <p className="text-sm text-gray-600">
          {t('subtitle', { phone })}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <Label htmlFor="otp" required>
            {t('otpLabel')}
          </Label>
          <Input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('otpPlaceholder')}
            maxLength={6}
            pattern="[0-9]{6}"
            {...(error ? { error } : {})}
            required
          />
        </div>

        <Button type="submit" isLoading={isPending} className="w-full" size="lg">
          {isPending ? t('verifying') : t('verify')}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/login`)}
          className="text-gray-500 hover:text-gray-700 underline"
        >
          {t('wrongNumber')}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="text-brand-600 hover:text-brand-700 font-medium disabled:opacity-60"
        >
          {isResending ? t('resending') : t('resend')}
        </button>
      </div>
    </div>
  )
}
