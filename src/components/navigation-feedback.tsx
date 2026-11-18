"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LogoLoader } from "./logo-loader";

/**
 * Immediate feedback for every in-app link click: a thin progress bar at the top straight away,
 * and the logo loading screen if the next page takes longer than a moment.
 * Clears itself when the URL changes (or after 15 s as a safety net).
 */
export function NavigationFeedback() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // a new URL means the navigation finished
  useEffect(() => {
    setNavigating(false);
    setShowOverlay(false);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname.startsWith("/api/")) return; // file downloads
      if (url.pathname === location.pathname && url.search === location.search) return;
      setNavigating(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!navigating) return;
    const overlay = setTimeout(() => setShowOverlay(true), 350);
    const safety = setTimeout(() => {
      setNavigating(false);
      setShowOverlay(false);
    }, 15000);
    return () => {
      clearTimeout(overlay);
      clearTimeout(safety);
    };
  }, [navigating]);

  if (!navigating) return null;
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-blue-100">
        <div className="nav-progress h-full w-1/3 bg-[#F5C400]" />
      </div>
      {showOverlay && <LogoLoader overlay />}
    </>
  );
}
