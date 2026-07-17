import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Roca One — self-hosted brand font, used across the whole app (UI, notes,
// A4 print output). Weights map: 300 Light, 400 Regular, 700 Bold, 900 Black.
const roca = localFont({
  src: [
    { path: "./fonts/RocaOne-Lt.woff2", weight: "300", style: "normal" },
    { path: "./fonts/RocaOne-Rg.woff2", weight: "400", style: "normal" },
    { path: "./fonts/RocaOne-It.woff2", weight: "400", style: "italic" },
    { path: "./fonts/RocaOne-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/RocaOne-BdIt.woff2", weight: "700", style: "italic" },
    { path: "./fonts/RocaOne-Bl.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-roca",
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
      className={`${roca.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
