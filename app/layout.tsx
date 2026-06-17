import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balkanity Platform",
  description: "Balkanity Platform — Welcome Pickup",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Montserrat font + cookie-driven `lang` are wired in plans 01-04 / 01-03.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
