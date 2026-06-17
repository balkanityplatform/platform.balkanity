import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { getLang } from "@/platform/i18n/dictionary";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the lang cookie server-side so SSR output is already in the chosen
  // language — no client-side flash on reload (PLAT-04, D-04/D-05).
  const lang = await getLang();

  return (
    <html lang={lang} className={montserrat.variable}>
      <body className="font-sans text-slate antialiased">{children}</body>
    </html>
  );
}
