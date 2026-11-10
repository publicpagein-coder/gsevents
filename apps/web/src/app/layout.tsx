// Root layout: the [locale]/layout.tsx below provides <html> and <body>.
// This wrapper exists because Next.js App Router requires a root layout file.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
