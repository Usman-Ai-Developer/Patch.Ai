"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAuthenticated } from "../lib/auth";
import Navbar from "../components/navbar";
import TiltCard from "../components/TiltCard";

const LogoPlaceholder = ({ label }) => (
  <div className="h-8 w-auto flex items-center justify-center bg-surface-container-high rounded px-3 text-xs text-on-surface-variant font-mono">
    {label}
  </div>
);

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <div className="relative min-h-screen text-on-surface selection:bg-primary-container selection:text-on-primary-container">
      <Navbar />

      <main className="relative z-10 pt-32 pb-3xl px-md lg:px-0">
        <div className="max-w-[1400px] mx-auto glass-card rounded-[36px] p-md lg:p-[80px]">
          {/* ─── Hero ──────────────────────────────────────────────── */}
          <section className="text-center mb-3xl">
            <div className="inline-flex items-center gap-2 px-md py-xs rounded-full bg-surface-container-high border border-white/10 mb-xl">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-label-caps font-label-caps uppercase tracking-widest text-secondary">
                New: GPT-4o Integration
              </span>
            </div>
            <h1 className="font-display-lg text-display-lg-mobile lg:text-display-lg max-w-4xl mx-auto mb-lg leading-[1.05]">
              Ship code <span className="text-secondary">faster</span> with intelligent precision.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-2xl">
              Patch is the next-generation AI code assistant that understands your entire repository,
              automates repetitive tasks, and ensures production-grade quality.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-md">
              <Link
                href="/signup"
                className="w-full sm:w-auto bg-secondary text-on-secondary font-bold px-3xl py-md rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all flex items-center justify-center gap-2"
              >
                Start Building Free
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              <button className="w-full sm:w-auto px-3xl py-md rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-bold flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">play_circle</span>
                Watch Demo
              </button>
            </div>
          </section>

          {/* ─── Trust ────────────────────────────────────────────── */}
          <section className="mb-3xl">
            <p className="text-center font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-xl">
              Trusted by 99,000+ developers
            </p>
            <div className="logo-cloud flex flex-wrap justify-center items-center gap-2xl opacity-80 grayscale">
              <LogoPlaceholder label="GitHub" />
              <LogoPlaceholder label="OpenAI" />
              <LogoPlaceholder label="Anthropic" />
              <LogoPlaceholder label="Vercel" />
              <LogoPlaceholder label="Figma" />
              <LogoPlaceholder label="Notion" />
              <LogoPlaceholder label="Linear" />
            </div>
          </section>

          {/* ─── Features Grid ────────────────────────────────────── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <TiltCard
              icon="auto_awesome"
              title="AI Code Generation"
              description="Convert natural language into production-ready code. Context-aware completions that adapt to your unique styling and architecture."
              cta="Learn more"
              ctaLink="#"
              image="/Ai code.png" // optional – you can use local images
            />
            <TiltCard
              icon="settings_suggest"
              title="Smart Automation"
              description="Automate your CI/CD pipelines, documentation, and unit tests with intelligent workflows that learn from your commits."
              cta="Explore workflows"
              ctaLink="#"
              image="/automation.jpg"
            />
            <TiltCard
              icon="speed"
              title="Dev Productivity"
              description="Real-time analytics and insights into your team's velocity and code quality metrics. Identify bottlenecks before they occur."
              cta="View analytics"
              ctaLink="#"
              image="/productivity.png"
            />
          </section>
        </div>

        {/* ─── CTA ────────────────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto mt-3xl text-center px-margin">
          <div className="relative py-3xl rounded-[36px] overflow-hidden">
            <div className="absolute inset-0 bg-secondary/5 backdrop-blur-xl border border-white/5" />
            <div className="relative z-10 px-md">
              <h2 className="font-display-sm text-display-sm mb-md">Ready to rewrite the future?</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl max-w-xl mx-auto">
                Join thousands of developers building the next generation of software with Patch.
              </p>
              <Link
                href="/signup"
                className="bg-primary text-on-primary font-bold px-3xl py-md rounded-xl active:scale-95 transition-all inline-block"
              >
                Get Started for Free
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <footer className="w-full py-2xl border-t border-white/5 bg-surface relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:justify-between px-margin max-w-7xl mx-auto gap-xl">
          <div className="col-span-2 lg:w-1/4">
            <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary mb-md block">
              Patch AI
            </span>
            <p className="text-on-surface-variant font-body-md text-body-md mb-lg">
              Built for the future of development. Precision code, infinite scale.
            </p>
            <p className="text-on-surface-variant font-body-md text-body-md opacity-60">
              © 2024 Patch AI. All rights reserved.
            </p>
          </div>
          <div>
            <h4 className="text-primary font-bold mb-md font-body-md">Product</h4>
            <ul className="space-y-sm">
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Documentation</Link></li>
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Changelog</Link></li>
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Security</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-primary font-bold mb-md font-body-md">Company</h4>
            <ul className="space-y-sm">
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Privacy</Link></li>
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Terms</Link></li>
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-primary font-bold mb-md font-body-md">Connect</h4>
            <ul className="space-y-sm">
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Twitter</Link></li>
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">GitHub</Link></li>
              <li><Link href="#" className="text-on-surface-variant hover:text-secondary transition-colors font-body-md text-body-md">Discord</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}