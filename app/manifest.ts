import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 *
 * v1 ships as a Progressive Web App (no native store builds), so the manifest is
 * the install surface: standalone display, portrait lock, and a maskable icon
 * on the teal brand colour so the home-screen tile looks intentional on Android.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CareNow — see a doctor in minutes",
    short_name: "CareNow",
    description:
      "Book and attend a video consultation with a licensed doctor from your phone, without leaving home.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F8F7",
    theme_color: "#F3F8F7",
    lang: "en",
    dir: "ltr",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Find a doctor", url: "/find" },
      { name: "My bookings", url: "/bookings" },
      { name: "My prescriptions", url: "/profile/prescriptions" },
    ],
  };
}
