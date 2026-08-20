import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import StoreProvider from "./store/StoreProvider";
import Analytics from "./analytics";
import { UploadTray } from "./components/UploadTray";
import { AuthEvents } from "./components/AuthEvents";
import "./globals.css";

const butlerPro = localFont({
  src: [
    { path: "./fonts/ButlerPro-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/ButlerPro-Roman.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ButlerPro-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ButlerPro-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ButlerPro-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/ButlerPro-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "./fonts/ButlerPro-Black.woff2", weight: "900", style: "normal" },
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

const butlerProRoman = localFont({
  src: [
    { path: "./fonts/ButlerPro-Roman.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ButlerPro-Roman.ttf", weight: "400", style: "normal" },
  ],
  variable: "--font-butler-roman",
  display: "swap",
});

const butlerProRomanDisplay = localFont({
  src: [
    { path: "./fonts/ButlerPro-Roman-Ds.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-butler-roman-display",
  display: "swap",
});

const butlerProMedium = localFont({
  src: [{ path: "./fonts/ButlerPro-Medium.woff2", weight: "500", style: "normal" }],
  variable: "--font-butler-medium",
  display: "swap",
});

const butlerProSemiBold = localFont({
  src: [{ path: "./fonts/ButlerPro-SemiBold.woff2", weight: "600", style: "normal" }],
  variable: "--font-butler-semibold",
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
    <html
      lang="en"
      className={`${butlerPro.variable} ${butlerProRoman.variable} ${butlerProRomanDisplay.variable} ${butlerProMedium.variable} ${butlerProSemiBold.variable} ${satoshi.variable}`}
    >
      <body>
        <StoreProvider>
          <AuthEvents />
          <Suspense fallback={null}>
            <Analytics>
              {children}
            </Analytics>
          </Suspense>
          <Suspense fallback={null}>
            <UploadTray />
          </Suspense>
        </StoreProvider>
      </body>
    </html>
  );
}
