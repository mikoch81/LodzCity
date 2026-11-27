import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin", "latin-ext"], weight: ["500", "700"] });
const body = Inter({ variable: "--font-body", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Fabrykant",
  description: "Gra o budowie przemysłowej Łodzi 1820–1914",
  appleWebApp: { capable: true, title: "Fabrykant", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// cover: draw under the notch/home bar; the layout pads with env(safe-area-inset-*)
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1d1714" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
