import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// Montserrat — brand font (PLAT-03). Weights 400 + 600 for Phase 1; exposed as a
// CSS variable consumed by the @theme `--font-sans` token in globals.css.
const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Balkanity Platform",
  description: "Balkanity Platform — Welcome Pickup",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie-driven `lang` is wired in 01-04 Task 2 (getLang → no-flash SSR).
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="font-sans text-slate antialiased">{children}</body>
    </html>
  );
}
