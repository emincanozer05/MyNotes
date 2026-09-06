import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Gravity — self-hosted brand font, used across the whole app (UI, notes,
// A4 print output). Weights map: 200 UltraLight, 300 Light, 350 Book,
// 400 Regular, 700 Bold. Bold is also registered for 800/900 so that
// `font-extrabold`/`font-black` render the real bold cut instead of a
// synthesized one.
const gravity = localFont({
  src: [
    { path: "./fonts/Gravity-UltraLight.woff2", weight: "200", style: "normal" },
    { path: "./fonts/Gravity-UltraLightItalic.woff2", weight: "200", style: "italic" },
    { path: "./fonts/Gravity-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/Gravity-LightItalic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/Gravity-Book.woff2", weight: "350", style: "normal" },
    { path: "./fonts/Gravity-BookItalic.woff2", weight: "350", style: "italic" },
    { path: "./fonts/Gravity-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Gravity-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/Gravity-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Gravity-BoldItalic.woff2", weight: "700", style: "italic" },
    { path: "./fonts/Gravity-Bold.woff2", weight: "800", style: "normal" },
    { path: "./fonts/Gravity-BoldItalic.woff2", weight: "800", style: "italic" },
    { path: "./fonts/Gravity-Bold.woff2", weight: "900", style: "normal" },
    { path: "./fonts/Gravity-BoldItalic.woff2", weight: "900", style: "italic" },
  ],
  variable: "--font-gravity",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NoteFlow",
  description:
    "Literatür takibi, bilimsel not alma ve kategorili bilgi yönetimi platformu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${gravity.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
