import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales, defaultLocale, type Locale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is the value of the `[locale]` path segment (a Promise in next-intl 3.22+)
  const rawLocale = await requestLocale

  // Redirect to 404 for unknown locales; the middleware should catch these first
  if (!rawLocale || !(locales as readonly string[]).includes(rawLocale)) {
    notFound()
  }

  const locale = rawLocale as Locale

  // Import returns plain JSON data (webpack parses JSON; `.default` is a plain object)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const messages: Record<string, any> = (await import(`../../messages/${locale}.json`)).default

  return { locale, messages }
})

export { defaultLocale }
