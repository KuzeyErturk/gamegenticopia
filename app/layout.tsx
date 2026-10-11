import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "Patchwork Valley — Understand every change",
  description: "A playful code-comprehension village for developers working with AI agents.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Patchwork Valley",
    description: "Understand every change. Grow your codebase.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Patchwork Valley code village" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Patchwork Valley",
    description: "Understand every change. Grow your codebase.",
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
