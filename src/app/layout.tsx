import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import "./globals.css";

// Google Sans — used across the whole app (UI, notes, A4 print output).
// Variable font (wght 400–700); latin-ext covers Turkish characters.
const googleSans = Google_Sans({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-google-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memory Palace",
  applicationName: "Memory Palace",
  // Home-screen install on iOS (Android reads app/manifest.ts).
  // "black-translucent": the page draws under the iOS status bar, so the
  // bar takes the app header's colour instead of a white strip.
  appleWebApp: { capable: true, title: "Memory Palace", statusBarStyle: "black-translucent" },
  description:
    "Literatür takibi, bilimsel not alma ve kategorili bilgi yönetimi platformu",
};

export const viewport: Viewport = {
  // Lay out under the status bar / notch; headers pad by safe-area-inset-top.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#171716" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${googleSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
