import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StickyClipDef } from "@/lib/Sticky";

export const metadata: Metadata = {
  title: "Learning Shelf",
  description: "A shared directory of living learning docs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Fonts: the Scatterbrain shell (Shrikhand/Caveat/Zilla Slab) plus the
            three contributor panel styles: Cobalt Grid (Newsreader/Hanken
            Grotesk/DM Mono), BlockFrame (Space Grotesk/Inter), Daisy Days
            (Fredoka/Quicksand). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700&family=Archivo:wght@400;600;700&family=Bebas+Neue&family=Big+Shoulders+Display:wght@700;900&family=Bodoni+Moda:ital,wght@0,600;0,700;0,800;1,600&family=Caveat:wght@400;600;700&family=Chakra+Petch:wght@400;600;700&family=DM+Mono:wght@400;500&family=Fredoka:wght@400;500;600&family=Hanken+Grotesk:wght@400;500;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700&family=Jost:wght@400;600;700&family=Lora:wght@400;600;700&family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Playfair+Display:wght@600;700;800&family=Quicksand:wght@400;600;700&family=Shrikhand&family=Space+Grotesk:wght@400;600;700&family=Space+Mono:wght@400;700&family=Tektur:wght@500;700&family=Zilla+Slab:wght@400;500;600;700&display=swap"
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
        <StickyClipDef />
        {children}
      </body>
    </html>
  );
}
