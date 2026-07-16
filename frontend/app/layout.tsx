import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StructuredData from "./components/StructuredData";
import { siteConfig } from "./config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: "Reviewer Bucket | Find Brocamp & Brototype Reviewers",
  description:
    "Reviewer Bucket helps Brocamp and Brototype students find reviewers by reviewer code or name. Search codes such as BR 64 and quickly identify the matching reviewer.",
  keywords: [
    "Reviewer Bucket",
    "reviewer finder",
    "reviewer directory",
    "reviewer code",
    "reviewer code lookup",
    "reviewer code search",
    "find reviewer by code",
    "search reviewer by code",
    "Brocamp reviewer",
    "Brocamp review",
    "Brototype reviewer",
    "Brototype review",
  ],
  icons: {
    icon: "/reviwerbucketLogo.png",
    apple: "/reviwerbucketLogo.png",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    title: "Reviewer Bucket | Find Brocamp & Brototype Reviewers",
    description:
      "Reviewer Bucket helps Brocamp and Brototype students find reviewers by reviewer code or name. Search codes such as BR 64 and quickly identify the matching reviewer.",
    siteName: "Reviewer Bucket",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Reviewer Bucket | Find Brocamp & Brototype Reviewers",
    description:
      "Reviewer Bucket helps Brocamp and Brototype students find reviewers by reviewer code or name. Search codes such as BR 64 and quickly identify the matching reviewer.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme');
                  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && systemDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })()
            `
          }}
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground antialiased">
        {children}
        <StructuredData />
      </body>
    </html>
  );
}
