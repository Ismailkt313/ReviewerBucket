import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
  title: "Reviewer Bucket | Find Brocamp Reviewer Experiences",
  description:
    "Find honest interview experiences shared by students for Brocamp reviewers. Search reviewers by name, reviewer code or technology stack.",
  keywords: [
    "Brocamp",
    "Reviewer",
    "Interview Experience",
    "MERN",
    "Flutter",
    "AI ML",
    "Python",
    "QA",
    "Media",
    "Unity",
    "Unreal",
    "Data Science",
    "Brototype",
    "Reviewer Bucket",
    "Brocamp Reviewer Finder",
    "Reviewer Code Search",
    "Technical Assessment",
    "Reviewer Rating",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
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
    title: "Reviewer Bucket | Find Brocamp Reviewer Experiences",
    description:
      "Find honest interview experiences shared by students for Brocamp reviewers. Search reviewers by name, reviewer code or technology stack.",
    siteName: "Reviewer Bucket",
    url: "/",
    images: [
      {
        url: `${siteConfig.url}/reviwerbucketLogo.png`,
        width: 1536,
        height: 1024,
        alt: "Reviewer Bucket Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reviewer Bucket | Find Brocamp Reviewer Experiences",
    description:
      "Find honest interview experiences shared by students for Brocamp reviewers. Search reviewers by name, reviewer code or technology stack.",
    images: [`${siteConfig.url}/reviwerbucketLogo.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    "name": "Reviewer Bucket",
    "url": siteConfig.url,
    "logo": {
      "@type": "ImageObject",
      "url": `${siteConfig.url}/reviwerbucketLogo.png`,
      "width": "1536",
      "height": "1024"
    },
    "description": "Honest community-driven Brocamp and Brototype reviewer directory and interview experiences.",
  };

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
