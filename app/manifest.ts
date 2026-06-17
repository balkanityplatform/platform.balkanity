import type { MetadataRoute } from "next";

// app/manifest.ts — PWA install manifest (PLAT-02 / D-07 identity).
//
// Installed identity: "Balkanity Platform" (short_name "Balkanity"), teal #029B87
// theme on a white background, display standalone. Next serves this at
// /manifest.webmanifest and injects the <link rel="manifest"> automatically.
//
// ICONS are the REAL Balkanity mark (Task 2 / 01-05, D-09 / SC-5), derived with
// `sips` from the committed master `Branding/balkanity logo/Balkanity_Logo.png`
// (4000x4000, transparent alpha) into the normalized `public/icons/` set:
//   - icon-192.png / icon-512.png  → purpose "any" (transparent)
//   - icon-512-maskable.png        → purpose "maskable" (logo padded to the ~80%
//                                     safe zone on a white field so platform masks
//                                     never clip the mark)
// No placeholders remain — Success Criterion 5 is met with the real brand asset.
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
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
