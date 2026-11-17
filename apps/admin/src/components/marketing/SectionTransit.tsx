"use client";

import { useEffect } from "react";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

export default function SectionTransit() {
  useEffect(() => {
    const root = document.querySelector(".mkt");
    if (!root) return;

    const onClick = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || !href.includes("#")) return;

      const hash = href.slice(href.indexOf("#"));
      if (hash.length < 2) return;

      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.pathname !== window.location.pathname) return;

      const target = document.getElementById(hash.slice(1));
      if (!target) return;

      event.preventDefault();
      const menu = link.closest("details");
      if (menu) menu.open = false;

      const markArrival = () => {
        target.classList.remove("is-arriving");
        void target.offsetWidth;
        target.classList.add("is-arriving");
        window.setTimeout(() => target.classList.remove("is-arriving"), 800);
      };

      if (prefersReducedMotion()) {
        target.scrollIntoView();
        history.pushState(null, "", hash);
        return;
      }

      const start = window.scrollY;
      const top = target.getBoundingClientRect().top + start - 72;
      const distance = top - start;
      const duration = Math.min(980, Math.max(520, Math.abs(distance) * 0.42));
      const started = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        window.scrollTo(0, start + distance * easeInOutCubic(progress));
        if (progress < 1) {
          requestAnimationFrame(step);
          return;
        }
        history.pushState(null, "", hash);
        markArrival();
      };

      requestAnimationFrame(step);
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  return null;
}
