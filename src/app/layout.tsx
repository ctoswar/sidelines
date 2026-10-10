import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import { NavProgress } from "@/components/ui/nav-progress";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const score = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-score",
});

export const metadata: Metadata = {
  title: "Sidelines – Tournament scoring for ultimate",
  description: "Score games, share live results and keep standings up to date.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${score.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <NavProgress />
      </body>
    </html>
  );
}
