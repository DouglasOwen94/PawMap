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

        {/* Two different background colours, on purpose.

            `body` is the app surface — it's what shows during the moment
            before React has painted anything.

            `html` paints the *canvas*: the area outside the layout viewport,
            which on an installed iOS PWA includes the band reserved for the
            home indicator along the bottom edge. iOS does not extend the
            layout viewport into that band, and reports
            env(safe-area-inset-bottom) as 0 there, so React Navigation's tab
            bar adds no padding and never paints into it — leaving a strip of
            bare canvas under the tab bar. We can't lay content into it, but
            we can colour it: white matches the tab bar sitting directly above,
            so the strip reads as part of the bar instead of a grey gap. */}
        <style
          id="pawmap-bg"
          dangerouslySetInnerHTML={{
            __html: `html{background-color:#FFFFFF}body{background-color:#F7F7F5}`,
          }}
        />

        {/* expo-router's ScrollViewStyleReset (above) sets html,body,#root to
            height:100%, a percentage of the *initial* viewport. In a browser
            tab, iOS Safari keeps that pinned to the viewport as it was on
            first paint rather than tracking the collapsing address bar, so
            the app ends up slightly too short or too tall. `dvh` tracks the
            dynamic viewport instead. It deliberately ignores the on-screen
            keyboard, which is what we want — the venue sheet runs its own
            keyboard offset animation and would fight a shrinking root. */}
        <style
          id="pawmap-viewport-fix"
          dangerouslySetInnerHTML={{ __html: `html,body,#root{height:100dvh}` }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
