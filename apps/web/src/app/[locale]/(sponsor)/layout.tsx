import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeStr } from '@/lib/db-utils'

export default async function SponsorLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = safeStr(profileResult.data, 'role')

  if (role !== 'sponsor') {
    if (role === 'organizer') redirect(`/${locale}/organizer-dashboard`)
    else redirect(`/${locale}/role-choice`)
  }

  return <div className="min-h-screen bg-gray-50">{children}</div>
}
