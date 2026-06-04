"use client";

import React, { useState, useEffect } from "react";
import { Film, Eye, EyeOff, Loader2, User, Mail, Lock, AtSign, Sparkles, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

type Mode = "signin" | "signup" | "forgot" | "reset";

export default function AuthPage() {
  const { signIn, signUp, authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);

  useEffect(() => {
    // Check URL parameters for verification status or reset token on mount
    const params = new URLSearchParams(window.location.search);
    
    // 1. Password Reset Token check
    const rToken = params.get("reset_token");
    if (rToken) {
      setMode("reset");
      setResetToken(rToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 2. Email verification checks
    if (params.get("verified") === "true") {
      setSuccessMessage("Your email has been verified successfully! You can now sign in.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const err = params.get("verify_error");
      if (err) {
        if (err === "invalid_or_expired_token") {
          setError("The verification link is invalid or has expired.");
        } else if (err === "missing_token") {
          setError("Verification token is missing.");
        } else {
          setError("An error occurred during email verification.");
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const reset = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const switchMode = (m: Mode) => {
    reset();
    setMode(m);
    // Clear passwords
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    const isSubmitting = authLoading || isLoadingLocal;
    if (isSubmitting) return;

    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else if (mode === "signup") {
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
      
      const { error, verificationSent: sent } = await signUp(email, password, username, displayName || username);
      if (error) {
        setError(error);
      } else if (sent) {
        setSignUpEmail(email);
        setVerificationSent(true);
      }
    } else if (mode === "forgot") {
      setIsLoadingLocal(true);
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to process request.");
        setSuccessMessage("If an account exists with this email, a reset link has been sent. Please check your inbox (and check your Spam/Junk folder if you don't see it)!");
        setEmail("");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingLocal(false);
      }
    } else if (mode === "reset") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setIsLoadingLocal(true);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reset password.");
        setSuccessMessage("Password reset successful! You can now log in.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingLocal(false);
      }
    }
  };

  const isFormLoading = authLoading || isLoadingLocal;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="fixed -top-60 -left-60 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/3 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
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
          {verificationSent ? (
            <div className="text-center py-4 space-y-4 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Mail className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white">Check your email</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We sent a verification link to <span className="text-indigo-400 font-semibold">{signUpEmail}</span>.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed px-2">
                  Please click the link in the email to verify and activate your account. The link expires in 24 hours. <strong>If you don&apos;t see the email, please check your Spam or Junk folder!</strong>
                </p>
              </div>

              <button
                onClick={() => {
                  setVerificationSent(false);
                  switchMode("signin");
                }}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Tab Switcher - only visible during normal Login/Signup */}
              {(mode === "signin" || mode === "signup") && (
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
              )}

              {/* Forgot password header info */}
              {mode === "forgot" && (
                <div className="mb-5 text-center space-y-1">
                  <h2 className="text-lg font-black text-white tracking-tight">Reset Password</h2>
                  <p className="text-xs text-zinc-400">
                    Enter your email to receive a password reset link.
                  </p>
                </div>
              )}

              {/* Reset password header info */}
              {mode === "reset" && (
                <div className="mb-5 text-center space-y-1">
                  <h2 className="text-lg font-black text-white tracking-tight">Set New Password</h2>
                  <p className="text-xs text-zinc-400">
                    Choose a new secure password for your account.
                  </p>
                </div>
              )}

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

                {/* Email (only for signin, signup, forgot) */}
                {mode !== "reset" && (
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
                )}

                {/* Password (for signin, signup, reset) */}
                {mode !== "forgot" && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {mode === "reset" ? "New Password" : "Password"} <span className="text-red-400">*</span>
                      </label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === "signup" ? "Min. 6 characters" : mode === "reset" ? "Min. 6 characters" : "Your password"}
                        required
                        className="w-full pl-9 pr-10 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirm Password (only for reset mode) */}
                {mode === "reset" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      Confirm New Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        className="w-full pl-9 pr-10 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 transition-colors cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[11px] font-semibold flex items-start gap-1.5 animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="px-3 py-2.5 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-[11px] font-semibold flex items-start gap-1.5 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isFormLoading}
                  className="w-full py-2.5 mt-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isFormLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {mode === "signin" ? "Signing in..." : mode === "signup" ? "Creating account..." : mode === "forgot" ? "Sending link..." : "Updating password..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : mode === "forgot" ? "Send Reset Link" : "Update Password"}
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer note */}
        {!verificationSent && (
          <div className="text-center text-[10px] text-zinc-650 mt-5 select-none flex flex-col gap-2">
            {(mode === "forgot" || mode === "reset") && (
              <button
                onClick={() => switchMode("signin")}
                className="text-zinc-500 hover:text-indigo-400 font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 self-center"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to Sign In</span>
              </button>
            )}

            {mode === "signin" && (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer transition-colors"
                >
                  Sign up free
                </button>
              </p>
            )}

            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("signin")}
                  className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
