// frontend/app/signup/page.js

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signup } from "../../lib/api";
import { setTokens } from "../../lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await signup(username, email, password, password2);
      setTokens(data.access, data.refresh);
      router.push("/");
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark px-6">
      <div className="w-full max-w-sm bg-panel/80 backdrop-blur-sm border border-line rounded-lg p-8 shadow-xl">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="patch/" className="h-12 w-auto mx-auto" />
          <div className="text-2xl font-semibold mt-3 glow-text">patch/</div>
          <p className="text-subtext text-sm mt-2">create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full bg-ink border border-line rounded-sm px-4 py-2 text-text placeholder:text-subtext outline-none focus:border-brand-100 transition-colors"
          />
          <input
            type="email"
            placeholder="email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-ink border border-line rounded-sm px-4 py-2 text-text placeholder:text-subtext outline-none focus:border-brand-100 transition-colors"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-ink border border-line rounded-sm px-4 py-2 text-text placeholder:text-subtext outline-none focus:border-brand-100 transition-colors"
          />
          <input
            type="password"
            placeholder="confirm password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            className="w-full bg-ink border border-line rounded-sm px-4 py-2 text-text placeholder:text-subtext outline-none focus:border-brand-100 transition-colors"
          />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-brand text-white font-semibold py-2 rounded-sm hover:bg-gradient-brand-hover transition-all disabled:opacity-40"
          >
            {loading ? "creating account…" : "sign up"}
          </button>
        </form>
        <div className="text-center mt-6 text-sm text-subtext">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-100 hover:text-brand-300 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}