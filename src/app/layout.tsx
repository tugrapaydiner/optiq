import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/manrope";

import { SiteFooter, SiteHeader } from "@/components/app-shell";
import { RouteTransitionController } from "@/components/route-transition-controller";

import "./globals.css";

export const metadata: Metadata = {
  title: "Optiq | Make visual lessons accessible",
  description:
    "Turn charts and process diagrams into accessible experiences reviewed by educators.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <RouteTransitionController />
        <Link className="skip-link" href="#main-content">
          Skip to main content
        </Link>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
