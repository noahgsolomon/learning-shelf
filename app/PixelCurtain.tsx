"use client";

// The pixel curtain for entering someone's note: clicking a doc card sweeps
// a wavefront of chunky squares down the screen — tinted with THAT author's
// dominant color (their style token's accent, read from the paper's
// data-curtain-tint) — then navigates with ?curtain=<tint> so the doc page
// plays the matching pixel REVEAL on arrival. Real Motion+ curtains
// (vendored in lib/curtains — see VENDORED.md): size 100, direction 90
// (down), noise 0.4.

import { useEffect } from "react";
import { curtains } from "@/lib/curtains";
import { pixels } from "@/lib/curtains/effects";

const FALLBACK_TINT = "#FFD43B";

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

      const tint =
        anchor.closest("[data-curtain-tint]")?.getAttribute("data-curtain-tint") ||
        FALLBACK_TINT;
      document.documentElement.style.setProperty("--curtain", tint);

      const dest = new URL(anchor.href);
      dest.searchParams.set("curtain", tint);

      curtains(
        // full-document navigation: never resolve — the browser swaps
        // documents while the cover is up. The reveal half plays on the
        // destination, driven by the ?curtain param.
        () =>
          new Promise<void>(() => {
            window.location.href = dest.toString();
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

  // curtain tiles wear the clicked author's color (set above per click)
  return (
    <style>{`
      .motion-curtain { background: var(--curtain, ${FALLBACK_TINT}); }
      .motion-curtains { z-index: 200; }
    `}</style>
  );
}
