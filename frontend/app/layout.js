// frontend/app/layout.js
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "Patch — AI Powered Code Assistant",
  description: "Ship code faster with intelligent precision.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;450;500&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="antialiased relative">
        {/* ─── Global atmospheric background ─────────────────────── */}
        <div className="grid-overlay" />
        <div className="atmospheric-glow top-0 -left-64" />
        <div className="atmospheric-glow bottom-0 -right-64" />
        <div className="curved-line w-[1000px] h-[1000px] -top-1/2 -left-1/4" />
        <div className="curved-line w-[800px] h-[800px] -bottom-1/4 -right-1/4" />

        <div className="relative z-10">
          {children}
        </div>

        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "rgba(14, 21, 16, 0.92)",
              backdropFilter: "blur(20px)",
              color: "#dce5dc",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "14px 20px",
              fontFamily: "Geist, sans-serif",
              fontSize: "14px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            },
            success: {
              style: { borderLeft: "3px solid #4edf91" },
              iconTheme: { primary: "#4edf91", secondary: "#0e1510" },
            },
            error: {
              style: { borderLeft: "3px solid #ffb4ab" },
              iconTheme: { primary: "#ffb4ab", secondary: "#0e1510" },
            },
          }}
        />
      </body>
    </html>
  );
}