"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export const routeSequence = [
  "/",
  "/product",
  "/how-it-works",
  "/accessibility",
  "/examples",
  "/create",
] as const;

function routePath(href: string) {
  const path = href.split("#", 1)[0];
  return path || "/";
}

export function setRouteTransitionDirection(currentPath: string, href: string) {
  const currentIndex = routeSequence.indexOf(
    routePath(currentPath) as (typeof routeSequence)[number],
  );
  const targetIndex = routeSequence.indexOf(
    routePath(href) as (typeof routeSequence)[number],
  );

  document.documentElement.dataset.routeDirection =
    currentIndex >= 0 && targetIndex >= 0 && targetIndex < currentIndex
      ? "backward"
      : "forward";
}

type TransitionLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onNavigate"
> & {
  href: string;
  onNavigate?: ComponentProps<typeof Link>["onNavigate"];
};

export function TransitionLink({
  href,
  onNavigate,
  ...props
}: TransitionLinkProps) {
  const pathname = usePathname() ?? "/";

  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        setRouteTransitionDirection(pathname, href);
        onNavigate?.(event);
      }}
    />
  );
}
