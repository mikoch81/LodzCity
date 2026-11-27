import type { MetadataRoute } from "next";

// "Add to home screen" on Android/iOS opens the game full screen, without browser bars
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fabrykant",
    short_name: "Fabrykant",
    description: "Gra o budowie przemysłowej Łodzi 1820–1914",
    lang: "pl",
    start_url: "/",
    display: "fullscreen",
    background_color: "#1d1714",
    theme_color: "#1d1714",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
