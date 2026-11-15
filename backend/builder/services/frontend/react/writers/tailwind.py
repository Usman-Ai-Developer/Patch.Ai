def write_tailwind_config(frontend_dir):
    content = '''/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0a0e14',
        panel: '#111820',
        line: '#1e2a36',
        text: '#e8edf2',
        subtext: '#8899aa',
        brand: { 100: '#3b82f6', 200: '#6366f1', 300: '#8b5cf6' },
        mint: '#7fd9a8',
      },
    },
  },
  plugins: [],
}
'''
    (frontend_dir / "tailwind.config.js").write_text(content, encoding='utf-8')