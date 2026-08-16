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
        {/* Deliberately NOT "black-translucent", which is what caused a grey
            band under the tab bar on installed iOS home-screen apps.
            black-translucent draws the page across the entire screen and lets
            the status bar float over it, but iOS still sizes the viewport as
            though the status bar took up room — so the document is effectively
            shifted up under the status bar and comes up exactly one status-bar
            height short at the bottom, leaving a strip nothing paints into.
            No height rule fixes that; the viewport itself is the wrong size.
            "default" lays the page out below the status bar, so the viewport
            matches what's actually drawable and the tab bar reaches the bottom.
            Apple has also deprecated black-translucent and plans to drop it. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PawMap" />

        {/* Two different background colours, on purpose.

            `body` is the app surface — it's what shows during the moment
            before React has painted anything.

            `html` paints the canvas: anything outside the viewport, including
            whatever iOS reserves along the bottom edge for the home indicator.
            White matches the tab bar directly above it, so any such strip
            reads as part of the bar rather than as a gap. */}
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
