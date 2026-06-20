import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "../providers/ThemeProvider";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";

import "./globals.css";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nestdesk.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NestDesk – PG & Hostel Management Software",
    template: "%s | NestDesk",
  },
  description:
    "NestDesk is a modern property management platform for PGs, co-living spaces, hostels, and rentals. Manage tenants, rent, notices, and maintenance from one dashboard.",
  keywords: [
    "PG management software",
    "hostel management system",
    "co-living property management",
    "rental management software",
    "tenant management",
    "property management India",
  ],
  authors: [{ name: "NestDesk", url: siteUrl }],
  creator: "NestDesk",
  publisher: "NestDesk",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "NestDesk",
    title: "NestDesk – PG & Hostel Management Software",
    description:
      "Manage tenants, rent, notices, and maintenance for your PG, hostel, or co-living space with NestDesk.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "NestDesk property management dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NestDesk – PG & Hostel Management Software",
    description:
      "Manage tenants, rent, notices, and maintenance for your PG, hostel, or co-living space with NestDesk.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton position="top-right" />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
