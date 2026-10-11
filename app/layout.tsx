import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "Vibe Control District — Understand every change",
  description: "A playful code-comprehension district for developers working with AI agents.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Vibe Control District",
    description: "Build fast. Understand everything.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vibe Control District coding game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vibe Control District",
    description: "Build fast. Understand everything.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
