import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "GSEvents — Event Sponsorship Marketplace",
    template: "%s | GSEvents",
  },
  description:
    "Connect event organizers with sponsors across India. Browse Navratri, Garba, Diwali fairs, and more.",
  keywords: ["events", "sponsorship", "navratri", "garba", "india", "organizer"],
  openGraph: {
    type: "website",
    locale: "en_IN",
    ...(process.env["NEXT_PUBLIC_APP_URL"] ? { url: process.env["NEXT_PUBLIC_APP_URL"] } : {}),
    siteName: "GSEvents",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
