// frontend/tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e14",          // darkest background
        panel: "#111820",        // panels, cards
        line: "#1e2a36",         // borders
        text: "#e8edf2",         // primary text
        subtext: "#8899aa",      // secondary text
        // New accent gradient colours
        brand: {
          100: "#3b82f6",        // blue
          200: "#6366f1",        // indigo
          300: "#8b5cf6",        // purple
        },
        // Keep the old amber as a fallback (optional)
        amber: "#e8a33d",
        mint: "#7fd9a8",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(circle at 30% 50%, rgba(59,130,246,0.15) 0%, transparent 60%)',
        'gradient-brand': 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        'gradient-brand-hover': 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
        'gradient-dark': 'linear-gradient(145deg, #0a0e14 0%, #111820 100%)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};