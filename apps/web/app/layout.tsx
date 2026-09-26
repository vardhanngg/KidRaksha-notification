import type { ReactNode } from "react";
import type { Viewport } from "next";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(
    process.env.PUBLIC_WEB_ORIGIN || "http://localhost:3000"
  ),
  title: "KidRaksha — Notification visibility for parents",
  description:
    "A transparent parental notification-sharing service built around consent, security and control.",
};

export const viewport: Viewport = {
  themeColor: "#0d1017",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}