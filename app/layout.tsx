import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import StoreProvider from "./store/StoreProvider";
import AnalyticsTracker from "./components/AnalyticsTracker";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const butlerPro = localFont({
  src: [
    { path: "./fonts/ButlerPro-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ButlerPro-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-butler",
  display: "swap",
});

const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/Satoshi-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-Bold.otf", weight: "700", style: "normal" },
    { path: "./fonts/Satoshi-Black.otf", weight: "800", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian",
  description: "Meridian login",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable} ${butlerPro.variable} ${satoshi.variable}`}>
      <body>
        <StoreProvider>
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
