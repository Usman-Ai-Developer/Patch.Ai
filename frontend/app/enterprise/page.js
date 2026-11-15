"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAuthenticated } from "../../lib/auth";
import Navbar from "../../components/navbar";
import TiltCard from "../../components/TiltCard";

export default function EnterprisePage() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

  const enterpriseFeatures = [
    {
      icon: "private_connectivity",
      title: "Private AI Models",
      description: "Run Patch with your own fine-tuned models on your infrastructure. Complete data privacy and control.",
      cta: "Learn more",
    },
    {
      icon: "verified",
      title: "Single Sign‑On (SSO)",
      description: "Integrate seamlessly with Okta, Google Workspace, Azure AD, and any SAML-based identity provider.",
      cta: "Learn about SSO",
    },
    {
      icon: "support_agent",
      title: "Dedicated Support",
      description: "24/7 enterprise-grade support with guaranteed SLAs. Your dedicated success manager and solution architect.",
      cta: "View support plans",
    },
    {
      icon: "analytics",
      title: "Audit Logs & Compliance",
      description: "Full audit trails, SOC2 Type II, GDPR, and HIPAA compliance. Complete visibility into every action.",
      cta: "Learn about compliance",
    },
    {
      icon: "api",
      title: "Custom Integrations",
      description: "Build custom integrations with our enterprise API. Connect Patch to your internal tools and data sources.",
      cta: "Explore API",
    },
    {
      icon: "security",
      title: "Advanced Security",
      description: "End-to-end encryption, data loss prevention, and advanced threat detection built for enterprise environments.",
      cta: "Read security white paper",
    },
  ];

  return (
    <div className="relative min-h-screen text-on-surface">
      <Navbar />

      <main className="relative z-10 pt-32 pb-3xl px-md lg:px-0">
        <div className="max-w-[1400px] mx-auto glass-card rounded-[36px] p-md lg:p-[80px]">
          <section className="text-center mb-3xl">
            <h1 className="font-display-lg text-display-lg-mobile lg:text-display-lg max-w-4xl mx-auto mb-lg leading-[1.05]">
              Enterprise‑grade <span className="text-secondary">AI at scale</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              Patch Enterprise delivers security, control, and performance for organisations of any size.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {enterpriseFeatures.map((feature) => (
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
              <h2 className="font-display-sm text-display-sm mb-md">Ready to take your team to the next level?</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl max-w-xl mx-auto">
                Talk to our sales team to get a custom enterprise quote.
              </p>
              <Link
                href="/contact"
                className="bg-secondary text-on-secondary font-bold px-3xl py-md rounded-xl inline-block hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all"
              >
                Contact Sales
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