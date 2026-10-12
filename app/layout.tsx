import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: {
    default: "CareNow — see a doctor in minutes",
    template: "%s · CareNow",
  },
  description:
    "Book and attend a video consultation with a licensed doctor from your phone, without leaving home.",
  applicationName: "CareNow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CareNow",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled: patients need to zoom into a prescription.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#F3F8F7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {/* A single mobile column, centred when there is room for it. */}
          <div className="app-shell">{children}</div>
        </ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
