"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAuthenticated } from "../../lib/auth";
import Navbar from "../../components/navbar";
import TiltCard from "../../components/TiltCard";

export default function FeaturesPage() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

  const features = [
    {
      icon: "auto_awesome",
      title: "AI Code Generation",
      description: "Convert natural language into production-ready code. Context-aware completions that adapt to your unique styling and architecture.",
      cta: "Learn more",
    },
    {
      icon: "settings_suggest",
      title: "Smart Automation",
      description: "Automate your CI/CD pipelines, documentation, and unit tests with intelligent workflows that learn from your commits.",
      cta: "Explore workflows",
    },
    {
      icon: "speed",
      title: "Dev Productivity",
      description: "Real-time analytics and insights into your team's velocity and code quality metrics. Identify bottlenecks before they occur.",
      cta: "View analytics",
    },
    {
      icon: "security",
      title: "Enterprise-grade Security",
      description: "SOC2 compliant, end-to-end encryption, and comprehensive audit logs for enterprise compliance.",
      cta: "Learn about security",
    },
    {
      icon: "integration_instructions",
      title: "Seamless Integrations",
      description: "Connect with GitHub, GitLab, Slack, Jira, and hundreds of other tools out of the box.",
      cta: "Explore integrations",
    },
    {
      icon: "groups",
      title: "Team Collaboration",
      description: "Share prompts, templates, and workflows across your team. Built-in code review and pair programming features.",
      cta: "Learn about teams",
    },
  ];

  return (
    <div className="relative min-h-screen text-on-surface">
      <Navbar />

      <main className="relative z-10 pt-32 pb-3xl px-md lg:px-0">
        <div className="max-w-[1400px] mx-auto glass-card rounded-[36px] p-md lg:p-[80px]">
          <section className="text-center mb-3xl">
            <h1 className="font-display-lg text-display-lg-mobile lg:text-display-lg max-w-4xl mx-auto mb-lg leading-[1.05]">
              Everything you need to <span className="text-secondary">ship faster</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              Patch combines AI, automation, and insights to supercharge your development workflow.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {features.map((feature) => (
              <TiltCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                cta={feature.cta}
              />
            ))}
          </section>
        </div>

        {/* CTA */}
        <section className="max-w-7xl mx-auto mt-3xl text-center px-margin">
          <div className="relative py-3xl rounded-[36px] overflow-hidden">
            <div className="absolute inset-0 bg-secondary/5 backdrop-blur-xl border border-white/5"></div>
            <div className="relative z-10 px-md">
              <h2 className="font-display-sm text-display-sm mb-md">Ready to try Patch?</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl max-w-xl mx-auto">
                Start building with AI today – free for 14 days.
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

      {/* Footer */}
      <footer className="w-full py-2xl border-t border-white/5 bg-surface relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:justify-between px-margin max-w-7xl mx-auto gap-xl">
          <div className="col-span-2 lg:w-1/4">
            <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary mb-md block">Patch AI</span>
            <p className="text-on-surface-variant font-body-md text-body-md mb-lg">Built for the future of development. Precision code, infinite scale.</p>
            <p className="text-on-surface-variant font-body-md text-body-md opacity-60">© 2024 Patch AI. All rights reserved.</p>
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