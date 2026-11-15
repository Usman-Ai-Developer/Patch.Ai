"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "../../lib/api";
import { setTokens } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      setTokens(data.access, data.refresh);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm glass-card rounded-[28px] p-lg md:p-xl">
        {/* ─── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-lg">
          <Link
            href="/"
            className="text-on-surface-variant hover:text-secondary transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-headline-lg text-headline-lg font-extrabold tracking-tighter text-primary">Patch</span>
            <div className="w-2 h-2 rounded-full bg-secondary ai-pulse"></div>
          </div>
          <div className="w-16"></div>
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant text-center -mt-md mb-lg">sign in to continue</p>

        <form onSubmit={handleSubmit} className="space-y-md">
          <div>
            <label htmlFor="username" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-xs">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
          <div>
            <label htmlFor="password" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-xs">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>

          {error && (
            <div className="text-sm bg-error-container/10 border border-error/20 rounded-lg px-md py-sm text-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary text-on-secondary font-bold py-sm rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin"></span>
                signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="text-center mt-lg text-on-surface-variant font-body-md text-body-md">
          Don't have an account?{" "}
          <Link href="/signup" className="text-secondary hover:underline transition-colors font-semibold">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}