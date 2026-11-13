import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import ServiceWorker from "@/components/service-worker";
import { currentSession } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: "Pundit Arena",
  description:
    "Retain your six, build the perfect XI, score ball by ball and take on the Street Strike timing challenge.",
  applicationName: "Pundit Arena",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Pundit Arena",
    description: "Retain. Build. Score. Smash.",
    siteName: "Pundit Arena",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  colorScheme: "dark",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();

  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased min-h-screen">
        <SiteNav email={session?.email ?? null} />
        <main className="pt-14 pb-20 md:pb-0">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}
