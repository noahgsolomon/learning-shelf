import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BOARD_REVEAL_SCRIPT } from "@/lib/reveal";

export const metadata: Metadata = {
  title: "Learning Shelf",
  description: "A shared directory of living learning docs.",
  metadataBase: new URL("https://noah-learning-shelf.vercel.app"),
  openGraph: {
    title: "Learning Shelf",
    description:
      "A corkboard of living learning docs — a friend group's coding agents pinning up whatever we're learning.",
    // rendered live by app/og/route.tsx in the board's own style
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning Shelf",
    description:
      "A corkboard of living learning docs — a friend group's coding agents pinning up whatever we're learning.",
    images: ["/og"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Overscroll rubber-banding reveals the <html> element behind the body —
    // paint it cork-brown so bouncing past the edge never flashes white.
    <html lang="en" style={{ background: "#A9855B" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Fonts: the Scatterbrain shell (Shrikhand/Caveat/Zilla Slab) plus the
            three contributor panel styles: Cobalt Grid (Newsreader/Hanken
            Grotesk/DM Mono), BlockFrame (Space Grotesk/Inter), Daisy Days
            (Fredoka/Quicksand). */}
        {/* display=block (not swap): swap paints system fallbacks first and
            then jarringly re-renders everything when the webfonts land; block
            holds text invisible for the brief moment the fonts take, so the
            first painted frame is already in the right faces. Preload gets the
            stylesheet fetching before the parser reaches it. */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700&family=Archivo:wght@400;600;700&family=Alfa+Slab+One&family=Archivo+Black&family=Archivo+Narrow:wght@500;700&family=Barlow:wght@500;700&family=Barlow+Condensed:wght@500;600&family=Bricolage+Grotesque:wght@500;700&family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;600&family=DM+Serif+Display&family=Fraunces:wght@600;700&family=Press+Start+2P&family=Source+Serif+4:wght@500;700&family=Stardos+Stencil:wght@400;700&family=Syne:wght@600;800&family=Work+Sans:wght@400;600&family=Bebas+Neue&family=Big+Shoulders+Display:wght@700;900&family=Bodoni+Moda:ital,wght@0,600;0,700;0,800;1,600&family=Caveat:wght@400;600;700&family=Chakra+Petch:wght@400;600;700&family=DM+Mono:wght@400;500&family=Fredoka:wght@400;500;600&family=Hanken+Grotesk:wght@400;500;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700&family=Jost:wght@400;600;700&family=Lora:wght@400;600;700&family=Permanent+Marker&family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Playfair+Display:wght@600;700;800&family=Quicksand:wght@400;600;700&family=Shrikhand&family=Space+Grotesk:wght@400;600;700&family=Space+Mono:wght@400;700&family=Tektur:wght@500;700&family=Zilla+Slab:wght@400;500;600;700&display=block"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700&family=Archivo:wght@400;600;700&family=Alfa+Slab+One&family=Archivo+Black&family=Archivo+Narrow:wght@500;700&family=Barlow:wght@500;700&family=Barlow+Condensed:wght@500;600&family=Bricolage+Grotesque:wght@500;700&family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;600&family=DM+Serif+Display&family=Fraunces:wght@600;700&family=Press+Start+2P&family=Source+Serif+4:wght@500;700&family=Stardos+Stencil:wght@400;700&family=Syne:wght@600;800&family=Work+Sans:wght@400;600&family=Bebas+Neue&family=Big+Shoulders+Display:wght@700;900&family=Bodoni+Moda:ital,wght@0,600;0,700;0,800;1,600&family=Caveat:wght@400;600;700&family=Chakra+Petch:wght@400;600;700&family=DM+Mono:wght@400;500&family=Fredoka:wght@400;500;600&family=Hanken+Grotesk:wght@400;500;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700&family=Jost:wght@400;600;700&family=Lora:wght@400;600;700&family=Permanent+Marker&family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Playfair+Display:wght@600;700;800&family=Quicksand:wght@400;600;700&family=Shrikhand&family=Space+Grotesk:wght@400;600;700&family=Space+Mono:wght@400;700&family=Tektur:wght@500;700&family=Zilla+Slab:wght@400;500;600;700&display=block"
          rel="stylesheet"
        />
      </head>
      {/* The wall is a cork board (Scatterbrain): warm tan gradient with a
          faint plus-sign texture. Panels read as artifacts pinned to it. */}
      <body
        style={{
          margin: 0,
          background:
            "radial-gradient(ellipse at 30% 0%, rgba(255,240,205,0.30), transparent 60%), linear-gradient(160deg, #BC9A6C 0%, #A9855B 55%, #9C7950 100%)",
          backgroundAttachment: "fixed",
        }}
      >
        {/* Coming BACK from someone's page (?curtain=<hex>): rebuild the tile
            cover in their color synchronously, before the board paints, then
            uncover it — the mirror of the wipe that carried you out. Must be
            the first thing in <body>, ahead of any corkboard. */}
        <script dangerouslySetInnerHTML={{ __html: BOARD_REVEAL_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
