import type { MetadataRoute } from "next";

// app/manifest.ts — PWA install manifest (PLAT-02 / D-07 identity).
//
// Installed identity: "Balkanity Platform" (short_name "Balkanity"), teal #029B87
// theme on a white background, display standalone. Next serves this at
// /manifest.webmanifest and injects the <link rel="manifest"> automatically.
//
// ICONS ARE TEMPORARY PLACEHOLDERS (monochrome teal #029B87) — see
// public/icons/README.md. Task 2 of 01-05 replaces them with the real D-09 marks.
// Placeholders satisfy the build/SW only; they DO NOT meet Success Criterion 5.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Balkanity Platform",
    short_name: "Balkanity",
    description: "Balkanity Platform — Welcome Pickup",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#029B87",
    icons: [
      {
        // TEMPORARY placeholder — replace with real mark in Task 2.
        src: "/icons/placeholder-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        // TEMPORARY placeholder — replace with real mark in Task 2.
        src: "/icons/placeholder-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // TEMPORARY placeholder — replace with real maskable mark in Task 2.
        src: "/icons/placeholder-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
