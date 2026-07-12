"use client";

// The pixel curtain for entering someone's note: clicking a doc card sweeps
// a wavefront of chunky squares down the screen, then navigates while the
// viewport is covered. Real Motion+ curtains (vendored in lib/curtains —
// see VENDORED.md), pixels effect: size 100, direction 90 (down), noise 0.4.

import { useEffect } from "react";
import { curtains } from "@/lib/curtains";
import { pixels } from "@/lib/curtains/effects";

export function PixelCurtain() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const target = e.target as HTMLElement;
      // this runs in the capture phase, before the depth tag's own handler —
      // leave clicks on interactive things inside the card (the tag) alone
      if (target.closest?.('button, [role="button"]')) return;
      const anchor = target.closest?.('a[href^="/d/"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      e.preventDefault();

      curtains(
        // full-document navigation: never resolve — the browser swaps
        // documents while the cover is up, and the overlay leaves with
        // this page. (The reveal phase belongs to the next document.)
        () =>
          new Promise<void>(() => {
            window.location.href = anchor.href;
          }),
        {
          effect: pixels({ size: 100, direction: 90, noise: 0.4 }),
          transition: { duration: 0.5 },
        },
      );
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // theme the curtain tiles: sticky-note yellow over everything on the board
  return (
    <style>{`
      .motion-curtain { background: #FFD43B; }
      .motion-curtains { z-index: 200; }
    `}</style>
  );
}
