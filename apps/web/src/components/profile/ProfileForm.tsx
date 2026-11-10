'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { updateProfile, signOut, signOutAll } from '@/app/[locale]/profile/actions'

interface City {
  id: number
  name: string
  state: string
}

interface ProfileFormProps {
  locale: string
  initialData: {
    fullName: string | null
    phone: string | null
    cityId: number | null
    preferredLanguage: 'en' | 'hi' | 'gu'
  }
  cities: City[]
}

export function ProfileForm({ locale, initialData, cities }: ProfileFormProps) {
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const router = useRouter()
  const [isSaving, startSave] = useTransition()
  const [isSigningOut, startSignOut] = useTransition()
  const [isSigningOutAll, startSignOutAll] = useTransition()
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const cityOptions = cities.map((c) => ({
    value: String(c.id),
    label: `${c.name}, ${c.state}`,
  }))

  const languageOptions = [
    { value: 'en', label: t('languages.en') },
    { value: 'hi', label: t('languages.hi') },
    { value: 'gu', label: t('languages.gu') },
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setSavedMessage(null)

    const data = new FormData(e.currentTarget)
    startSave(() => {
      void (async () => {
        const result = await updateProfile(data)
        if (result.ok) {
          setSavedMessage(t('saved'))
          const newLang = data.get('preferred_language') as string
          if (newLang && newLang !== locale) {
            router.push(`/${newLang}/profile`)
          }
        } else {
          setError(result.error)
          if ('fieldErrors' in result) setFieldErrors(result.fieldErrors ?? {})
        }
      })()
    })
  }

  const fullNameError = fieldErrors['full_name']
  const cityError = fieldErrors['city_id']
  const langError = fieldErrors['preferred_language']

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Full name */}
        <div>
          <Label htmlFor="full_name" required>
            {t('fullName')}
          </Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder={t('fullNamePlaceholder')}
            defaultValue={initialData.fullName ?? ''}
            {...(fullNameError ? { error: fullNameError } : {})}
            required
          />
        </div>

        {/* Phone — read-only */}
        <div>
          <Label htmlFor="phone">{t('phone')}</Label>
          <Input
            id="phone"
            name="phone_display"
            type="tel"
            value={initialData.phone ?? ''}
            readOnly
            disabled
            className="cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">{t('phoneReadOnly')}</p>
        </div>

        {/* City */}
        <div>
          <Label htmlFor="city_id">{t('city')}</Label>
          <Select
            id="city_id"
            name="city_id"
            placeholder={t('cityPlaceholder')}
            options={cityOptions}
            defaultValue={initialData.cityId ? String(initialData.cityId) : ''}
            {...(cityError ? { error: cityError } : {})}
          />
        </div>

        {/* Language */}
        <div>
          <Label htmlFor="preferred_language">{t('language')}</Label>
          <Select
            id="preferred_language"
            name="preferred_language"
            options={languageOptions}
            defaultValue={initialData.preferredLanguage}
            {...(langError ? { error: langError } : {})}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {savedMessage ? (
          <p className="text-sm text-green-600" role="status">
            {savedMessage}
          </p>
        ) : null}

        <Button type="submit" isLoading={isSaving} className="w-full" size="lg">
          {isSaving ? t('saving') : tc('save')}
        </Button>
      </form>

      {/* Sign out section */}
      <section aria-labelledby="logout-heading" className="border-t border-gray-200 pt-6">
        <h2
          id="logout-heading"
          className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500"
        >
          {t('logoutSection')}
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{t('logoutCurrentSession')}</p>
              <p className="text-xs text-gray-500">{t('logoutCurrentSessionDesc')}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isSigningOut}
              onClick={() =>
                startSignOut(() => {
                  void (async () => {
                    await signOut(locale)
                  })()
                })
              }
            >
              {t('logoutCurrentSession')}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{t('logoutAllSessions')}</p>
              <p className="text-xs text-gray-500">{t('logoutAllSessionsDesc')}</p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              isLoading={isSigningOutAll}
              onClick={() =>
                startSignOutAll(() => {
                  void (async () => {
                    await signOutAll(locale)
                  })()
                })
              }
            >
              {t('logoutAllSessions')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
