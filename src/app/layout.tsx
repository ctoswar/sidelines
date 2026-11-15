import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import { NavProgress } from "@/components/ui/nav-progress";
import { CustomCursor } from "@/components/ui/custom-cursor";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const score = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-score",
});

// The public origin .env declares; metadata (canonical, OG, sitemap) resolves
// against it so share previews and crawlers see absolute URLs.
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sidelines – Pickleball events, live scores and results",
  description:
    "Find pickleball tournaments and leagues, register, and follow live scores, courts and standings from your phone.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Sidelines",
    title: "Sidelines – Pickleball events, live scores and results",
    description:
      "Find pickleball tournaments and leagues, register, and follow live scores, courts and standings from your phone.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Sidelines – Pickleball events, live scores and results",
    description:
      "Find pickleball tournaments and leagues, register, and follow live scores, courts and standings from your phone.",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${score.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <NavProgress />
        <CustomCursor />
      </body>
    </html>
  );
}
