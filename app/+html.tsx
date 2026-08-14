import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Root HTML document for the static web export. Only web builds go through
 * this file — native ignores it entirely. Extends expo-router's default
 * <Html> (see node_modules/expo-router/build/static/html.js) with the PWA
 * manifest, home-screen icons, and a background colour that matches the app
 * instead of the browser's default white, so the very first paint — before
 * any JS has run — already looks like PawMap rather than a blank flash.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <ScrollViewStyleReset />

        {/* PWA: lets a phone browser "install" the site as a standalone,
            full-screen app icon instead of just bookmarking a browser tab.
            manifest.json lives in public/, copied verbatim into the export —
            see public/manifest.json for the paths this depends on. */}
        <link rel="manifest" href="/PawMap/manifest.json" />
        <meta name="theme-color" content="#0A0A0A" />

        {/* iOS Safari ignores most of manifest.json (standalone display,
            icons) — these Apple-specific tags are what actually get a
            full-screen, no-browser-chrome launch and a home-screen icon
            on iPhone/iPad. */}
        <link rel="apple-touch-icon" href="/PawMap/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PawMap" />

        <style
          id="pawmap-bg"
          dangerouslySetInnerHTML={{ __html: `html,body{background-color:#F7F7F5}` }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
