import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import localFont from "next/font/local";
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
    <html lang="en" className={`${geist.variable} ${inter.variable} ${butlerPro.variable}`}>
      <body>
        <StoreProvider>
          <AnalyticsTracker />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
