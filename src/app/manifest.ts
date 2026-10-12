import type { MetadataRoute } from "next";

/** Web app manifest: lets the site be installed to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NOTE",
    short_name: "NOTE",
    description: "Literatür takibi, bilimsel not alma ve kategorili bilgi yönetimi platformu",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "tr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
