// frontend/components/LandingPage.js

"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-dark text-text">
      {/* ----- NAVBAR ----- */}
      <nav className="border-b border-line px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="patch/" className="h-8 w-auto" />
          <span className="text-xl font-semibold glow-text">patch/</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          
          <Link
            href="/login"
            className="px-4 py-2 border border-line rounded-sm hover:border-brand-200 hover:text-brand-100 transition-all"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-gradient-brand text-white rounded-sm font-semibold hover:bg-gradient-brand-hover transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ----- HERO ----- */}
      <section className="max-w-6xl mx-auto px-6 py-20 flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-brand-100/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-brand-300/10 rounded-full blur-3xl"></div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Get ready for the <br />
            <span className="glow-text">new era of AI</span>
          </h1>
          <p className="text-subtext text-lg max-w-2xl mx-auto mt-6">
            Upload a project, describe a change, and watch it get applied – 
            all through a chat interface that understands your codebase.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-3 bg-gradient-brand text-white rounded-md font-semibold hover:bg-gradient-brand-hover transition-all"
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="px-8 py-3 border border-line rounded-md hover:border-brand-200 hover:text-brand-100 transition-all"
            >
              Learn More →
            </a>
          </div>
          <div className="mt-8 text-sm text-subtext">
            No credit card required • Free to try
          </div>
        </div>
      </section>

      {/* ----- FEATURES ----- */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
        <h2 className="text-3xl font-bold text-center glow-text">Why patch/?</h2>
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          <div className="bg-panel/60 backdrop-blur-sm border border-line rounded-lg p-6 hover:border-brand-200 transition-all">
            <div className="text-4xl mb-4">🧠</div>
            <h3 className="text-xl font-semibold">AI‑Powered Edits</h3>
            <p className="text-subtext text-sm mt-2">
              Describe changes in natural language – the AI reads only what it needs and applies targeted edits with surgical precision.
            </p>
          </div>
          <div className="bg-panel/60 backdrop-blur-sm border border-line rounded-lg p-6 hover:border-brand-200 transition-all">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold">Safe &amp; Isolated</h3>
            <p className="text-subtext text-sm mt-2">
              Every operation is validated for safety – no accidental overwrites or path traversal. Your project is sandboxed per user.
            </p>
          </div>
          <div className="bg-panel/60 backdrop-blur-sm border border-line rounded-lg p-6 hover:border-brand-200 transition-all">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold">Blazing Fast</h3>
            <p className="text-subtext text-sm mt-2">
              Powered by Groq's LLaMA 3.3 70B – low‑latency, deterministic code suggestions that feel instant.
            </p>
          </div>
        </div>
      </section>

      {/* ----- HOW IT WORKS ----- */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
        <h2 className="text-3xl font-bold text-center glow-text">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-brand/20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-brand-100">1</div>
            <h3 className="text-xl font-semibold mt-4">Upload</h3>
            <p className="text-subtext text-sm mt-2">Upload a .zip or individual source files – patch/ will create a project.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-brand/20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-brand-100">2</div>
            <h3 className="text-xl font-semibold mt-4">Chat</h3>
            <p className="text-subtext text-sm mt-2">Describe what you want – the AI reads the context and proposes edits.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-brand/20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-brand-100">3</div>
            <h3 className="text-xl font-semibold mt-4">Apply</h3>
            <p className="text-subtext text-sm mt-2">Edits are applied directly to your files – you see the result instantly.</p>
          </div>
        </div>
      </section>

      {/* ----- CTA ----- */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center border-t border-line">
        <h2 className="text-3xl font-bold glow-text">Ready to start building?</h2>
        <p className="text-subtext text-lg mt-4 max-w-2xl mx-auto">
          Join the new era of AI‑assisted coding. Upload your first project today.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-8 px-10 py-4 bg-gradient-brand text-white rounded-md font-semibold hover:bg-gradient-brand-hover transition-all"
        >
          Get Started for Free
        </Link>
      </section>

      {/* ----- FOOTER ----- */}
      <footer className="border-t border-line py-8 px-6 text-center text-subtext text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="patch/" className="h-6 w-auto" />
            <span className="font-semibold glow-text">patch/</span>
            <span className="text-xs ml-2">© 2026</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-text transition-colors">Privacy</a>
            <a href="#" className="hover:text-text transition-colors">Terms</a>
            <a href="#" className="hover:text-text transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}