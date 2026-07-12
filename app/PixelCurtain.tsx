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
    // Resolver for the in-flight navigation callback. It must resolve when we
    // leave the page: the curtains coordinator is module state and survives a
    // bfcache freeze — left unresolved, its drain loop stays stuck awaiting
    // this callback forever, and every curtains() call after Back would queue
    // behind it (cards would preventDefault and then never navigate).
    let pendingNav: (() => void) | null = null;

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
        // full-document navigation: resolve only on pagehide (see above) —
        // the browser swaps documents while the cover is up, and the reveal
        // half plays on the destination, driven by the ?curtain param.
        () =>
          new Promise<void>((resolve) => {
            pendingNav = resolve;
            window.location.href = dest.toString();
          }),
        {
          effect: pixels({ size: 100, direction: 90, noise: 0.4 }),
          transition: { duration: 0.5 },
        },
      ).catch(() => {});
    }

    // Leaving the page (real navigation or bfcache freeze): settle the
    // navigation callback so the coordinator can finish its cycle. On a
    // bfcache restore it resumes here — drains, plays the pixel reveal of
    // the board, and goes idle, ready for the next click.
    function onPageHide() {
      pendingNav?.();
      pendingNav = null;
    }

    // Back button after the wipe: the restored page comes back covered in
    // tiles. The resumed coordinator normally plays the pixel reveal itself
    // (pagehide resolved its callback) — this is the safety net for anything
    // that slips through: if a curtain is still up a beat later, fade it.
    function onPageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      setTimeout(() => {
        document.querySelectorAll<HTMLElement>(".motion-curtains").forEach((c) => {
          c.style.transition = "opacity 250ms ease";
          c.style.opacity = "0";
          setTimeout(() => c.remove(), 300);
        });
      }, 1200);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // curtain tiles wear the clicked author's color (set above per click)
  return (
    <style>{`
      .motion-curtain { background: var(--curtain, ${FALLBACK_TINT}); }
      .motion-curtains { z-index: 200; }
    `}</style>
  );
}
