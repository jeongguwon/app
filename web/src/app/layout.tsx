import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "분실물/습득물 웹앱",
  description: "분실물/습득물 등록, 매칭, 알림과 운영 기능을 제공하는 모바일 친화 웹앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col pb-20 sm:pb-0">
          {children}
        </div>
        <MobileBottomNav />
      </body>
    </html>
  );
}
