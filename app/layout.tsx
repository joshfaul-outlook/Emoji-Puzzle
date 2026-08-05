import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: "Emoji Daily — One puzzle for everyone",
    description: "Decode today’s globally shared emoji puzzle. One puzzle, once a day, no account needed.",
    openGraph: {
      title: "Emoji Daily",
      description: "One emoji puzzle. Every day. Everyone.",
      type: "website",
      images: [{ url: image, width: 1536, height: 1024, alt: "Emoji Daily — one puzzle every day" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Emoji Daily",
      description: "One emoji puzzle. Every day. Everyone.",
      images: [image],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f2e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
