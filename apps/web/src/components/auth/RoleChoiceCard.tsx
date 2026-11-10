'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setUserRole } from '@/app/[locale]/(auth)/role-choice/actions'
import type { SignupRole } from '@/lib/auth-utils'

interface RoleChoiceCardProps {
  locale: string
}

export function RoleChoiceCard({ locale }: RoleChoiceCardProps) {
  const t = useTranslations('auth.roleChoice')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<SignupRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return
    setError(null)

    const data = new FormData()
    data.set('role', selected)

    startTransition(() => {
      void (async () => {
        const result = await setUserRole(data)
        if (result.ok) {
          router.push(result.role === 'organizer' ? `/${locale}/organizer-dashboard` : `/${locale}/sponsor-dashboard`)
        } else {
          setError(result.error)
        }
      })()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="role" value={selected ?? ''} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RoleOption
          id="role-organizer"
          value="organizer"
          title={t('organizerTitle')}
          description={t('organizerDesc')}
          icon="🎪"
          isSelected={selected === 'organizer'}
          onSelect={() => setSelected('organizer')}
        />
        <RoleOption
          id="role-sponsor"
          value="sponsor"
          title={t('sponsorTitle')}
          description={t('sponsorDesc')}
          icon="🤝"
          isSelected={selected === 'sponsor'}
          onSelect={() => setSelected('sponsor')}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        isLoading={isPending}
        disabled={!selected}
        className="w-full"
        size="lg"
      >
        {isPending ? t('continuing') : t('continue')}
      </Button>
    </form>
  )
}

interface RoleOptionProps {
  id: string
  value: SignupRole
  title: string
  description: string
  icon: string
  isSelected: boolean
  onSelect: () => void
}

function RoleOption({ id, title, description, icon, isSelected, onSelect }: RoleOptionProps) {
  return (
    <button
      type="button"
      id={id}
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
        isSelected
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-300'
          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50',
      )}
    >
      <span className="text-4xl" aria-hidden="true">{icon}</span>
      <span className="text-base font-semibold text-gray-900">{title}</span>
      <span className="text-sm text-gray-500">{description}</span>
    </button>
  )
}
