import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function OrganizerLayout({
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

  // Fetch actual DB role (authoritative source — metadata can be stale)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'organizer') {
    if (profile?.role === 'sponsor') redirect(`/${locale}/sponsor-dashboard`)
    else redirect(`/${locale}/role-choice`)
  }

  return <div className="min-h-screen bg-gray-50">{children}</div>
}
