// frontend/components/Navbar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Platform" },
    { href: "/features", label: "Features" },
    { href: "/enterprise", label: "Enterprise" },
    { href: "#", label: "Pricing" }, // placeholder
  ];

  return (
    <header className="fixed top-0 w-full z-50 glass-header shadow-2xl">
      <div className="flex justify-between items-center h-20 px-margin max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="font-headline-lg text-headline-lg font-extrabold tracking-tighter text-primary"
          >
            Patch
          </Link>
          <div className="w-2 h-2 rounded-full bg-secondary ai-pulse" />
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-xl">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-body-md text-body-md transition-colors ${
                  isActive
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Auth buttons */}
        <div className="flex items-center gap-md">
          <Link
            href="/login"
            className="text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md active:scale-95 px-md py-sm"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="bg-primary text-on-primary font-body-md text-body-md font-bold px-lg py-sm rounded-full active:scale-95 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}