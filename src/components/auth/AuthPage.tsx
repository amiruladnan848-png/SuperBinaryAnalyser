import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, Zap,
  ArrowRight, KeyRound, CheckCircle, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ownerPhoto from "@/assets/owner-photo.jpg";
import logoIcon from "@/assets/logo-icon.png";

type Step = "email" | "otp" | "set_password" | "login_password";
type Mode = "login" | "signup";

// Static particles — computed once
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 2,
  delay: Math.random() * 12,
  dur: 10 + Math.random() * 10,
}));

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const TC = "#00ff88"; // theme color

  const clearError = () => setError("");

  const resetToMode = useCallback((m: Mode) => {
    setMode(m);
    setStep("email");
    setEmail("");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setShowPw(false);
    setLoading(false);
    setError("");
  }, []);

  // ── OTP box auto-focus ───────────────────────────────────────────────────
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    }
  }, [step]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = otp.split("");
    while (next.length < 6) next.push("");
    next[idx] = digit;
    const newOtp = next.join("").slice(0, 6);
    setOtp(newOtp);
    clearError();
    if (digit && idx < 5) {
      setTimeout(() => otpRefs.current[idx + 1]?.focus(), 30);
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (!otp[idx] && idx > 0) {
        otpRefs.current[idx - 1]?.focus();
        const next = otp.split("");
        next[idx - 1] = "";
        setOtp(next.join(""));
      } else {
        const next = otp.split("");
        next[idx] = "";
        setOtp(next.join(""));
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  // ── SIGNUP FLOW ──────────────────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    clearError();
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (err) throw err;
      setEmail(trimmed);
      setStep("otp");
      toast.success("✅ Verification code sent — check your email");
    } catch (err: any) {
      const msg = err?.message || "Failed to send code";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleVerifyOtp = useCallback(async () => {
    const code = otp.replace(/\D/g, "");
    if (code.length < 4) {
      setError("Enter the full verification code");
      return;
    }
    setLoading(true);
    clearError();
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (err) throw err;
      toast.success("✅ Email verified!");
      setStep("set_password");
    } catch (err: any) {
      const msg = err?.message || "Invalid or expired code";
      setError(msg);
      toast.error(msg);
      setOtp("");
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } finally {
      setLoading(false);
    }
  }, [email, otp]);

  const handleSetPassword = useCallback(async () => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    clearError();
    try {
      const username = email.split("@")[0];
      const { error: err } = await supabase.auth.updateUser({
        password,
        data: { username },
      });
      if (err) throw err;
      toast.success("🎉 Account created! Welcome to Super-Binary-Analyser.");
      // Auth state change fires automatically — no manual redirect needed
    } catch (err: any) {
      const msg = err?.message || "Failed to set password";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  }, [email, password, confirmPassword]);

  // ── LOGIN FLOW ───────────────────────────────────────────────────────────
  const handleLoginEmailNext = useCallback(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    setEmail(trimmed);
    clearError();
    setStep("login_password");
  }, [email]);

  const handleLoginSubmit = useCallback(async () => {
    if (!password) {
      setError("Enter your password");
      return;
    }
    setLoading(true);
    clearError();
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) throw err;
      toast.success("✅ Signed in successfully!");
      // Auth state change fires automatically
    } catch (err: any) {
      let msg = err?.message || "Sign in failed";
      if (msg.includes("Invalid login credentials")) msg = "Incorrect email or password";
      if (msg.includes("Email not confirmed")) msg = "Please verify your email first";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  }, [email, password]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const stepOrder: Step[] = ["email", "otp", "set_password"];
  const currentStepIdx = stepOrder.indexOf(step as any);

  const handleMainAction = () => {
    if (mode === "signup") {
      if (step === "email") handleSendOtp();
      else if (step === "otp") handleVerifyOtp();
      else handleSetPassword();
    } else {
      if (step === "email") handleLoginEmailNext();
      else handleLoginSubmit();
    }
  };

  const btnLabel = () => {
    if (mode === "login") return step === "email" ? "Continue →" : "Sign In";
    if (step === "email") return "Send Verification Code";
    if (step === "otp") return "Verify Code";
    return "Create Account";
  };

  const otpDigits = Array.from({ length: 6 }).map((_, i) => otp[i] || "");

  return (
    <div className="min-h-screen bg-[#020c15] flex items-center justify-center relative overflow-hidden px-4 py-8">
      {/* ── Background ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0"
          style={{ backgroundImage: `url(${ownerPhoto})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.04, filter: "blur(22px) saturate(1.8)" }} />
        <div className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse 70% 55% at 15% -10%, ${TC}0a 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 110%, #00d4ff07 0%, transparent 60%)` }} />
        <div className="absolute inset-0 opacity-[0.016]"
          style={{ backgroundImage: `linear-gradient(${TC} 1px, transparent 1px), linear-gradient(90deg, ${TC} 1px, transparent 1px)`, backgroundSize: "56px 56px" }} />
        <div className="absolute top-1/4 left-1/6 w-80 h-80 rounded-full blur-[120px] opacity-[0.05]" style={{ background: TC }} />
        <div className="absolute bottom-1/4 right-1/6 w-64 h-64 rounded-full blur-[100px] opacity-[0.04]" style={{ background: "#00d4ff" }} />
        {PARTICLES.map(p => (
          <div key={p.id} className="absolute rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, background: TC, opacity: 0.06, animation: `authFloat ${p.dur}s ease-in-out infinite`, animationDelay: `${p.delay}s` }} />
        ))}
      </div>

      <div className="relative w-full max-w-[420px] z-10">
        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div className="text-center mb-7">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl opacity-40" style={{ background: TC }} />
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 shadow-2xl" style={{ borderColor: TC, boxShadow: `0 0 24px ${TC}50` }}>
                <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-lg font-black tracking-wide" style={{
                background: `linear-gradient(90deg, ${TC}, #ffffff 50%, ${TC})`,
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "authShimmer 3s linear infinite",
              }}>
                SUPER-BINARY-ANALYSER
              </h1>
              <p className="text-[10px] text-gray-600 tracking-widest">SESSION-ADAPTIVE SIGNAL ENGINE • 2026</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-gray-600">19 Indicators Active • BB Primary</span>
          </div>
        </div>

        {/* ── Card ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-800/60 overflow-hidden backdrop-blur-2xl"
          style={{ background: "rgba(2,12,21,0.92)", boxShadow: `0 0 60px ${TC}0e, 0 24px 80px rgba(0,0,0,0.7)` }}>

          {/* Tab switcher */}
          <div className="p-4 pb-0">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {(["login", "signup"] as Mode[]).map(m => (
                <button key={m} onClick={() => resetToMode(m)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-200"
                  style={mode === m
                    ? { background: `${TC}1a`, color: TC, boxShadow: `0 0 14px ${TC}18` }
                    : { color: "#4b5563" }}>
                  {m === "login" ? "🔐 Sign In" : "✨ Sign Up"}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Signup step progress */}
            {mode === "signup" && (
              <div className="flex items-center gap-1.5 pt-1">
                {[
                  { key: "email", label: "Email" },
                  { key: "otp", label: "Verify" },
                  { key: "set_password", label: "Password" },
                ].map((s, idx, arr) => {
                  const sIdx = stepOrder.indexOf(s.key as Step);
                  const done = sIdx < currentStepIdx;
                  const active = sIdx === currentStepIdx;
                  return (
                    <React.Fragment key={s.key}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-black transition-all duration-300"
                          style={done
                            ? { background: "#00d084", borderColor: "#00d084", color: "#000" }
                            : active
                            ? { background: `${TC}20`, borderColor: TC, color: TC }
                            : { background: "transparent", borderColor: "#374151", color: "#6b7280" }}>
                          {done ? "✓" : idx + 1}
                        </div>
                        <span className="text-[10px] font-semibold hidden sm:inline"
                          style={{ color: done ? "#00d084" : active ? TC : "#4b5563" }}>{s.label}</span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div className="flex-1 h-px mx-0.5" style={{ background: done ? "#00d08435" : "#1f2937" }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* ── Email field ─────────────────────────────────────────── */}
            {(step === "email" || step === "login_password") && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-semibold tracking-wide">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearError(); }}
                    placeholder="your@email.com"
                    disabled={step === "login_password"}
                    autoComplete="email"
                    autoFocus={step === "email"}
                    className="w-full rounded-xl pl-10 pr-10 py-3 text-sm text-gray-200 placeholder-gray-600 transition-all focus:outline-none disabled:opacity-55"
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${error && step === "email" ? "#ff446660" : "rgba(255,255,255,0.09)"}`, boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)" }}
                    onKeyDown={e => e.key === "Enter" && handleMainAction()}
                  />
                  {step === "login_password" && (
                    <button onClick={() => { setStep("email"); clearError(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-emerald-400 transition-colors font-medium">
                      change
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── OTP boxes ───────────────────────────────────────────── */}
            {step === "otp" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold tracking-wide">Verification Code</label>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Sent to <span className="text-emerald-400 font-medium">{email}</span>
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otpDigits[i]}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={e => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                        setOtp(pasted);
                        const focusIdx = Math.min(pasted.length, 5);
                        setTimeout(() => otpRefs.current[focusIdx]?.focus(), 30);
                      }}
                      className="w-11 h-12 text-center text-lg font-black text-gray-100 rounded-xl transition-all duration-200 focus:outline-none focus:scale-105"
                      style={{
                        background: otpDigits[i] ? `${TC}18` : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${error ? "#ff446660" : otpDigits[i] ? `${TC}60` : "rgba(255,255,255,0.09)"}`,
                        boxShadow: otpDigits[i] && !error ? `0 0 10px ${TC}25` : "inset 0 1px 3px rgba(0,0,0,0.3)",
                        color: error ? "#ff4466" : TC,
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => { setStep("email"); setOtp(""); clearError(); }}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors underline">
                    ← Change email
                  </button>
                  <button onClick={handleSendOtp} disabled={loading}
                    className="text-[10px] text-emerald-600 hover:text-emerald-400 transition-colors font-medium disabled:opacity-50">
                    Resend code
                  </button>
                </div>
              </div>
            )}

            {/* ── Set password (signup) ────────────────────────────────── */}
            {step === "set_password" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-semibold tracking-wide">Create Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); clearError(); }}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      autoFocus
                      className="w-full rounded-xl pl-10 pr-10 py-3 text-sm text-gray-200 placeholder-gray-600 transition-all focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#ff446660" : "rgba(255,255,255,0.09)"}`, boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)" }}
                    />
                    <button onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-semibold tracking-wide">Confirm Password</label>
                  <div className="relative">
                    <CheckCircle size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); clearError(); }}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 transition-all focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#ff446660" : confirmPassword && confirmPassword === password ? "#00d08440" : "rgba(255,255,255,0.09)"}`, boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)" }}
                      onKeyDown={e => e.key === "Enter" && handleMainAction()}
                    />
                    {confirmPassword && confirmPassword === password && (
                      <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                    )}
                  </div>
                </div>
                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (password.length / 12) * 100)}%`,
                          background: password.length < 6 ? "#ff4466" : password.length < 10 ? "#FFD700" : "#00d084",
                        }} />
                    </div>
                    <p className="text-[10px]" style={{ color: password.length < 6 ? "#ff4466" : password.length < 10 ? "#FFD700" : "#00d084" }}>
                      {password.length < 6 ? "Too short" : password.length < 10 ? "Good" : "Strong password"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Login password ───────────────────────────────────────── */}
            {step === "login_password" && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-semibold tracking-wide">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError(); }}
                    placeholder="Your password"
                    autoComplete="current-password"
                    autoFocus
                    className="w-full rounded-xl pl-10 pr-10 py-3 text-sm text-gray-200 placeholder-gray-600 transition-all focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#ff446660" : "rgba(255,255,255,0.09)"}`, boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)" }}
                    onKeyDown={e => e.key === "Enter" && handleMainAction()}
                  />
                  <button onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* ── Error message ────────────────────────────────────────── */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-700/40 bg-red-950/20">
                <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* ── Primary action button ────────────────────────────────── */}
            <button
              onClick={handleMainAction}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(135deg, ${TC}, ${TC}bb)`,
                boxShadow: loading ? "none" : `0 4px 24px ${TC}45, 0 0 0 1px ${TC}20`,
              }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === "login" ? (
                step === "email" ? <><ArrowRight size={15} /> Continue</> : <><ShieldCheck size={15} /> Sign In</>
              ) : step === "email" ? (
                <><Mail size={15} /> Send Verification Code</>
              ) : step === "otp" ? (
                <><KeyRound size={15} /> Verify Code</>
              ) : (
                <><Zap size={15} /> Create Account</>
              )}
            </button>

            {/* ── Footer note ──────────────────────────────────────────── */}
            <p className="text-[10px] text-gray-700 text-center pt-1">
              🔒 Secure authentication • Access controlled by admin
            </p>
          </div>
        </div>

        {/* ── Owner badge ─────────────────────────────────────────────── */}
        <div className="text-center mt-5 flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: `${TC}40` }}>
            <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
          </div>
          <span className="text-[10px] text-gray-700">
            Built by <span className="text-gray-500 font-medium">Amirul_Adnan</span> •{" "}
            <a href="https://t.me/amirul_adnan_trader" target="_blank" rel="noopener noreferrer"
              className="text-cyan-700 hover:text-cyan-500 transition-colors">
              @amirul_adnan_trader
            </a>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes authShimmer { 0%{background-position:0% center} 100%{background-position:200% center} }
        @keyframes authFloat { 0%,100%{transform:translateY(0) scale(1);opacity:.05} 50%{transform:translateY(-18px) scale(1.2);opacity:.14} }
      `}</style>
    </div>
  );
};

export default AuthPage;
