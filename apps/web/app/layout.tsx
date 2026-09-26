
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "LittleWatch — Notification visibility for parents",
  description: "A transparent parental notification-sharing service built around consent, security and control."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
