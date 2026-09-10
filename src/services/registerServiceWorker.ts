import { Capacitor } from '@capacitor/core';

/**
 * Registers the PWA service worker so the site is installable ("Add to Home
 * Screen") on both Android Chrome and iOS Safari. Skipped entirely inside
 * the Capacitor native apps — they already have a real home-screen icon via
 * the OS, and a service worker has no purpose wrapped in a native WebView.
 */
export function registerServiceWorker(): void {
  if (Capacitor.isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    // Resolved relative to the current document, not the domain root — the
    // app is deployed both at a root (Cloudflare) and under a subpath
    // (GitHub Pages, /emb_app/), and an absolute '/sw.js' would 404 there.
    const scope = new URL('.', document.baseURI).toString();
    const swUrl = new URL('sw.js', document.baseURI).toString();
    navigator.serviceWorker.register(swUrl, { scope }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
