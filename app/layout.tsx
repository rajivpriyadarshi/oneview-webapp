import type { Metadata } from "next";
import { AuthEvents } from "./components/AuthEvents";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oneview",
  description: "Oneview login",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthEvents />
        {children}
      </body>
    </html>
  );
}
