"use client";

import { useEffect } from "react";

/**
 * Registers the service worker after the page is interactive.
 *
 * Registration is deliberately delayed until `load` so it never competes with
 * the first render on a slow 4G connection — video consultations are the point
 * of the app, and the shell has to be usable first.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration must never break the app.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
