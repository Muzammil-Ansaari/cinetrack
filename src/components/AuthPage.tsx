"use client";

import React, { useState } from "react";
import { Film, Eye, EyeOff, Loader2, User, Mail, Lock, AtSign, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const { signIn, signUp, authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setError(null);
  };

  const switchMode = (m: Mode) => {
    reset();
    setMode(m);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (username.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }
      if (!/^[a-z0-9_]+$/.test(username)) {
        setError("Username can only contain lowercase letters, numbers, and underscores.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      // signUp now auto-signs in — on success the auth state updates and dashboard renders
      const { error } = await signUp(email, password, username, displayName || username);
      if (error) setError(error);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="fixed -top-60 -left-60 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/3 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 mb-4">
            <Film className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            CineTrack
          </h1>
          <p className="text-[11px] text-zinc-500 font-semibold mt-1 tracking-wider uppercase">
            Social Movie Tracker
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 shadow-2xl">
          {/* Tab Switcher */}
          <div className="flex bg-zinc-950/70 rounded-xl p-1 mb-6 border border-zinc-800/40">
            <button
              onClick={() => switchMode("signin")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                mode === "signin"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                mode === "signup"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Sign Up extras */}
            {mode === "signup" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your full name (optional)"
                      className="w-full pl-9 pr-4 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Username <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="your_username"
                      required
                      className="w-full pl-9 pr-4 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
                    />
                  </div>
                  <p className="text-[9px] text-zinc-600 px-1">
                    Friends find you by @username — lowercase letters, numbers, underscores only.
                  </p>
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-3 py-2.5 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-[11px] font-semibold animate-fade-in">
                ⚠ {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 mt-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === "signin" ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-zinc-600 mt-5 select-none">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => switchMode("signup")}
                className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer transition-colors"
              >
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => switchMode("signin")}
                className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
