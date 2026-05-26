import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import localFont from "next/font/local";
import StoreProvider from "./store/StoreProvider";
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
    { path: "./fonts/ButlerPro-Roman.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ButlerPro-Bold.woff2", weight: "700", style: "normal" },
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
      <body><StoreProvider>{children}</StoreProvider></body>
    </html>
  );
}
