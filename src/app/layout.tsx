import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto Image",
  description: "写真をアップロードして自動加工し、Discordに送信",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Cormorant+Garamond:wght@700&family=Bebas+Neue&family=Josefin+Sans:wght@600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-900 text-white min-h-screen">{children}</body>
    </html>
  );
}
