"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { setRouteTransitionDirection } from "./transition-link";

export function RouteTransitionController() {
  const pathname = usePathname() ?? "/";
  const previousPath = useRef(pathname);

  useEffect(() => {
    const handleHistoryNavigation = () => {
      setRouteTransitionDirection(previousPath.current, window.location.pathname);
    };

    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  useEffect(() => {
    previousPath.current = pathname;
  }, [pathname]);

  return null;
}
