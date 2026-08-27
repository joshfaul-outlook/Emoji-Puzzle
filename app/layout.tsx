import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-brand", display: "swap", weight: ["800"] });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-editorial", display: "swap", weight: ["600"] });

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://emojizzle.com"),
    title: "Emojizzle — Looks obvious. Eventually.",
    description: "Decode today's shared emoji puzzle. One puzzle, every day, no account needed.",
    alternates: { canonical: "https://emojizzle.com/" },
    icons: {
      icon: "/brand/favicon.svg",
      apple: "/brand/apple-touch-icon.png",
    },
    openGraph: {
      title: "Emojizzle",
      description: "Looks obvious. Eventually.",
      type: "website",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Emojizzle — Looks obvious. Eventually." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Emojizzle",
      description: "Looks obvious. Eventually.",
      images: ["/og.png"],
    },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F4EF",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sora.variable} ${fraunces.variable}`}>{children}</body>
    </html>
  );
}
