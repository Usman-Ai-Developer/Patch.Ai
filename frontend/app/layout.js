// frontend/app/layout.js

import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "patch/ — code assistant",
  description: "Upload a project, describe a change, watch it get applied.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-mono">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#111820",
              color: "#dce5df",
              border: "1px solid #1e2a36",
              borderRadius: "4px",
              padding: "12px 16px",
            },
            success: {
              iconTheme: {
                primary: "#3b82f6",
                secondary: "#0a0e14",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#0a0e14",
              },
            },
          }}
        />
      </body>
    </html>
  );
}