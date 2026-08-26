import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://proud-cliff-05850990f.7.azurestaticapps.net"),
    title: "Emoji Daily — One puzzle for everyone",
    description: "Decode today’s globally shared emoji puzzle. One puzzle, once a day, no account needed.",
    openGraph: {
      title: "Emoji Daily",
      description: "One emoji puzzle. Every day. Everyone.",
      type: "website",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Emoji Daily — one puzzle every day" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Emoji Daily",
      description: "One emoji puzzle. Every day. Everyone.",
      images: ["/og.png"],
    },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f2e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
