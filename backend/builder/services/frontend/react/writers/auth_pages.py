# builder/services/frontend/react/writers/auth_pages.py

def write_login_page(pages_dir):
    content = """
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/token/', { username, password });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-body text-on-surface selection:bg-primary-container selection:text-on-primary-container relative min-h-screen flex items-center justify-center">
      <div className="grid-overlay"></div>
      <div className="atmospheric-glow top-0 -left-64"></div>
      <div className="atmospheric-glow bottom-0 -right-64"></div>
      <div className="curved-line w-[1000px] h-[1000px] -top-1/2 -left-1/4"></div>
      <div className="curved-line w-[800px] h-[800px] -bottom-1/4 -right-1/4"></div>

      <div className="w-full max-w-sm glass-card rounded-[28px] p-6 md:p-8 mx-4 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-on-surface-variant hover:text-secondary transition-colors flex items-center gap-1 text-sm font-medium">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-headline-lg text-headline-lg font-extrabold tracking-tighter text-primary">Patch</span>
            <div className="w-2 h-2 rounded-full bg-secondary ai-pulse"></div>
          </div>
          <div className="w-16"></div>
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant text-center -mt-2 mb-6">sign in to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-1.5">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
          <div>
            <label htmlFor="password" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-1.5">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>

          {error && (
            <div className="text-sm bg-error-container/10 border border-error/20 rounded-lg px-4 py-2.5 text-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary text-on-secondary font-bold py-2.5 rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        <div className="text-center mt-6 text-on-surface-variant font-body-md text-body-md">
          Don't have an account?{" "}
          <Link to="/signup" className="text-secondary hover:underline transition-colors font-semibold">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
"""
    (pages_dir / "Login.jsx").write_text(content, encoding='utf-8')


def write_signup_page(pages_dir, roles):
    # Build role options HTML
    role_options = ''
    for role in roles:
        role_options += f'<option value="{role}">{role}</option>\n'

    content = f"""
import React, {{ useState }} from 'react';
import {{ useNavigate, Link }} from 'react-router-dom';
import api from '../api/client';

export default function Signup() {{
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {{
    e.preventDefault();
    setError('');
    if (password !== password2) {{
      setError('Passwords do not match');
      return;
    }}
    setLoading(true);
    try {{
      const res = await api.post('/signup/', {{ username, email, password, password2, role }});
      const loginRes = await api.post('/token/', {{ username, password }});
      localStorage.setItem('access_token', loginRes.data.access);
      localStorage.setItem('refresh_token', loginRes.data.refresh);
      navigate('/dashboard');
    }} catch (err) {{
      setError(err.response?.data?.detail || err.response?.data?.error || 'Signup failed');
    }} finally {{
      setLoading(false);
    }}
  }};

  return (
    <div className="landing-body text-on-surface selection:bg-primary-container selection:text-on-primary-container relative min-h-screen flex items-center justify-center">
      <div className="grid-overlay"></div>
      <div className="atmospheric-glow top-0 -left-64"></div>
      <div className="atmospheric-glow bottom-0 -right-64"></div>
      <div className="curved-line w-[1000px] h-[1000px] -top-1/2 -left-1/4"></div>
      <div className="curved-line w-[800px] h-[800px] -bottom-1/4 -right-1/4"></div>

      <div className="w-full max-w-sm glass-card rounded-[28px] p-6 md:p-8 mx-4 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-on-surface-variant hover:text-secondary transition-colors flex items-center gap-1 text-sm font-medium">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-headline-lg text-headline-lg font-extrabold tracking-tighter text-primary">Patch</span>
            <div className="w-2 h-2 rounded-full bg-secondary ai-pulse"></div>
          </div>
          <div className="w-16"></div>
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant text-center -mt-2 mb-6">create your account</p>

        <form onSubmit={{handleSubmit}} className="space-y-4">
          <div>
            <label htmlFor="username" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-1.5">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={{username}}
              onChange={{e => setUsername(e.target.value)}}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
          <div>
            <label htmlFor="email" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-1.5">Email (optional)</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={{email}}
              onChange={{e => setEmail(e.target.value)}}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
          <div>
            <label htmlFor="password" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-1.5">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Create a password"
              value={{password}}
              onChange={{e => setPassword(e.target.value)}}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
          <div>
            <label htmlFor="password2" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-1.5">Confirm Password</label>
            <input
              id="password2"
              type="password"
              placeholder="Confirm your password"
              value={{password2}}
              onChange={{e => setPassword2(e.target.value)}}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
          <div>
            <label htmlFor="role" className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-1.5">Role</label>
            <select
              id="role"
              value={{role}}
              onChange={{e => setRole(e.target.value)}}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            >
              <option value="">Select role</option>
              {role_options}
            </select>
          </div>

          {{error && (
            <div className="text-sm bg-error-container/10 border border-error/20 rounded-lg px-4 py-2.5 text-error">
              {{error}}
            </div>
          )}}

          <button
            type="submit"
            disabled={{loading}}
            className="w-full bg-secondary text-on-secondary font-bold py-2.5 rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {{loading ? (
              <>
                <span className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin"></span>
                creating account…
              </>
            ) : (
              "Create Account"
            )}}
          </button>
        </form>

        <div className="text-center mt-6 text-on-surface-variant font-body-md text-body-md">
          Already have an account?{" "}
          <Link to="/login" className="text-secondary hover:underline transition-colors font-semibold">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}}
"""
    (pages_dir / "Signup.jsx").write_text(content, encoding='utf-8')


def write_landing_page(pages_dir):
    content = """
import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="landing-body text-on-surface selection:bg-primary-container selection:text-on-primary-container relative min-h-screen overflow-x-hidden">
      <div className="grid-overlay"></div>
      <div className="atmospheric-glow top-0 -left-64"></div>
      <div className="atmospheric-glow bottom-0 -right-64"></div>
      <div className="curved-line w-[1000px] h-[1000px] -top-1/2 -left-1/4"></div>
      <div className="curved-line w-[800px] h-[800px] -bottom-1/4 -right-1/4"></div>

      <header className="fixed top-0 w-full z-50 glass-header shadow-2xl">
        <div className="grid grid-cols-3 items-center h-20 px-4 md:px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 justify-start">
            <span className="font-headline-lg text-headline-lg font-extrabold tracking-tighter text-primary">Patch</span>
            <div className="w-2 h-2 rounded-full bg-secondary ai-pulse"></div>
          </div>
          <div className="flex items-center justify-center gap-6">
            <Link to="/login" className="text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md">Sign In</Link>
            <Link to="/signup" className="bg-primary text-on-primary font-body-md text-body-md font-bold px-5 py-2 rounded-full active:scale-95 transition-all">
              Get Started
            </Link>
          </div>
          <div className="flex justify-end">
            {/* Spacer for alignment */}
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-high border border-white/10 mb-6">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span className="text-label-caps font-label-caps uppercase tracking-widest text-secondary">New: GPT-4o Integration</span>
          </div>
          <h1 className="font-display-lg text-display-lg-mobile lg:text-display-lg leading-[1.05] mb-6">
            AI-powered <span className="text-secondary">development</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10">
            Upload a project, describe a change, and watch it get applied – all through a chat interface that understands your codebase.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="w-full sm:w-auto bg-secondary text-on-secondary font-bold px-10 py-3 rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all flex items-center justify-center gap-2">
              Start Building Free
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <button className="w-full sm:w-auto px-10 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-bold flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">play_circle</span>
              Watch Demo
            </button>
          </div>
        </div>
      </main>

      <footer className="w-full py-8 border-t border-white/5 bg-surface relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-on-surface-variant">
          <span className="text-xs opacity-60">© 2024 Patch AI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="#" className="hover:text-primary transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
"""
    (pages_dir / "Landing.jsx").write_text(content, encoding='utf-8')


def write_auth_layout(src_dir):
    content = """
import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Outlet />
    </div>
  );
}
"""
    (src_dir / "AuthLayout.jsx").write_text(content, encoding='utf-8')