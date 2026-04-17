import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto Image - 画像加工 & Discord送信",
  description: "写真をアップロードして自動加工し、Discordに送信",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-900 text-white min-h-screen">{children}</body>
    </html>
  );
}
