def write_main_jsx(src_dir):
    content = """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
"""
    (src_dir / "main.jsx").write_text(content, encoding='utf-8')

    css_content = """@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: radial-gradient(circle at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 60%),
              linear-gradient(145deg, #0a0e14 0%, #111820 100%);
  color: #e8edf2;
  min-height: 100vh;
}

/* ─── Custom scrollbar ───────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: #1e2a36;
  border-radius: 4px;
}

.blink-cursor::after {
  content: "▍";
  animation: blink 1s step-start infinite;
  color: #3b82f6;
}
@keyframes blink {
  50% { opacity: 0; }
}

.glow-text {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─── Landing Page Specific ──────────────────────────────────────── */

.landing-body {
  background: radial-gradient(circle at center, #07141B 0%, #123C34 100%);
  min-height: 100vh;
  overflow-x: hidden;
  font-family: 'Geist', sans-serif;
}

.atmospheric-glow {
  position: fixed;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(78, 223, 145, 0.08) 0%, transparent 70%);
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}

.grid-overlay {
  position: fixed;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 1;
}

.curved-line {
  position: fixed;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 100%;
  pointer-events: none;
}

.glass-card {
  background: rgba(7, 15, 25, 0.92);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 40px 120px rgba(0, 0, 0, 0.55);
}

.glass-header {
  background: rgba(14, 21, 16, 0.7);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
}

/* ─── Feature cards ───────────────────────────────────────────────── */
.feature-card {
  background: linear-gradient(180deg, rgba(22, 35, 50, 0.95), rgba(11, 19, 30, 0.98));
  border: 1px solid rgba(102, 255, 179, 0.12);
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.feature-card:hover {
  transform: translateY(-8px) scale(1.02);
  border-color: rgba(102, 255, 179, 0.4);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(78, 223, 145, 0.1);
}

@keyframes pulse-ai {
  0% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 0.8; }
  100% { transform: scale(1); opacity: 0.5; }
}

.ai-pulse {
  animation: pulse-ai 3s infinite ease-in-out;
}

/* ─── Prototype overlay transitions ───────────────────────────────── */
@keyframes vb-dissolve { from { opacity: 0; } to { opacity: 1; } }
@keyframes vb-slide { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes vb-push { from { transform: translateX(40px); } to { transform: none; } }

[data-transition="instant"] { animation: none; }
[data-transition="dissolve"] { animation: vb-dissolve 240ms ease-out; }
[data-transition="slide"] { animation: vb-slide 260ms cubic-bezier(0.2, 0.8, 0.2, 1); }
[data-transition="push"] { animation: vb-push 260ms cubic-bezier(0.2, 0.8, 0.2, 1); }
"""
    (src_dir / "index.css").write_text(css_content, encoding='utf-8')


def write_theme_css(src_dir, design_tokens=None):
    """Write the design-variable stylesheet: light on :root, dark under
    [data-theme="dark"] and prefers-color-scheme."""
    from .visual_pages import build_theme_css

    css = build_theme_css(design_tokens)
    (src_dir / "theme.css").write_text(css or "/* No design tokens defined. */\n", encoding="utf-8")