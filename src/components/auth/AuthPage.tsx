import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, Zap, ArrowRight, KeyRound, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ownerPhoto from "@/assets/owner-photo.jpg";

type Step = "email" | "otp" | "password" | "login_password";
type Mode = "signup" | "login";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = (newMode: Mode) => {
    setMode(newMode);
    setStep("email");
    setEmail("");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
  };

  // ── SIGNUP FLOW ─────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes("@")) { toast.error("Enter a valid email address"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      toast.success("✅ Verification code sent! Check your email.");
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 4) { toast.error("Enter the 4-digit verification code"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "email" });
      if (error) throw error;
      toast.success("✅ Email verified!");
      setStep("password");
    } catch (err: any) {
      toast.error(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      const username = email.split("@")[0];
      const { error } = await supabase.auth.updateUser({ password, data: { username } });
      if (error) throw error;
      toast.success("🎉 Account created! Welcome to Super-Binary-Analyser.");
      onAuthSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to set password");
      setLoading(false);
    }
  };

  // ── LOGIN FLOW ──────────────────────────────────────────────────────────────
  const handleLoginSubmit = async () => {
    if (step === "email") {
      if (!email.trim() || !email.includes("@")) { toast.error("Enter a valid email"); return; }
      setStep("login_password");
      return;
    }
    if (!password) { toast.error("Enter your password"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success("✅ Logged in successfully!");
      onAuthSuccess();
    } catch (err: any) {
      toast.error(err.message || "Login failed — check your credentials");
      setLoading(false);
    }
  };

  const themeColor = "#00ff88";

  return (
    <div className="min-h-screen bg-[#020c15] flex items-center justify-center relative overflow-hidden px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${ownerPhoto})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.05,
          filter: "blur(20px) saturate(1.5)",
        }} />
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 60% at 20% -5%, #00ff8809 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, #00d4ff06 0%, transparent 60%)",
        }} />
        <div className="absolute inset-0 opacity-[0.018]" style={{
          backgroundImage: `linear-gradient(${themeColor} 1px, transparent 1px), linear-gradient(90deg, ${themeColor} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/5 w-96 h-96 rounded-full blur-3xl opacity-[0.04]" style={{ background: themeColor }} />
        <div className="absolute bottom-1/4 right-1/5 w-80 h-80 rounded-full blur-3xl opacity-[0.03]" style={{ background: "#00d4ff" }} />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 shadow-xl" style={{ borderColor: themeColor, boxShadow: `0 0 20px ${themeColor}40` }}>
              <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-black" style={{
                background: `linear-gradient(90deg, ${themeColor}, #ffffff, ${themeColor})`,
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "shimmer 3s linear infinite",
              }}>
                SUPER-BINARY-ANALYSER
              </h1>
              <p className="text-[10px] text-gray-500 tracking-widest">HIGH ACCURACY SIGNAL ENGINE • 2026</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-800/60 bg-black/70 backdrop-blur-2xl overflow-hidden"
          style={{ boxShadow: `0 0 60px ${themeColor}10, 0 20px 60px rgba(0,0,0,0.6)` }}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-800/40">
            <div className="flex gap-1 p-1 rounded-xl bg-gray-900/60 border border-gray-800/40">
              {(["login", "signup"] as Mode[]).map(m => (
                <button key={m} onClick={() => resetForm(m)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200"
                  style={mode === m
                    ? { background: `${themeColor}18`, color: themeColor, boxShadow: `0 0 12px ${themeColor}15` }
                    : { color: "#6b7280" }}>
                  {m === "login" ? "🔐 Sign In" : "✨ Sign Up"}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Progress indicator for signup */}
            {mode === "signup" && (
              <div className="flex items-center gap-2 mb-5">
                {[
                  { key: "email", label: "Email" },
                  { key: "otp", label: "Verify" },
                  { key: "password", label: "Password" },
                ].map((s, idx, arr) => {
                  const stepOrder = ["email", "otp", "password"];
                  const currentIdx = stepOrder.indexOf(step);
                  const sIdx = stepOrder.indexOf(s.key);
                  const done = sIdx < currentIdx;
                  const active = sIdx === currentIdx;
                  return (
                    <React.Fragment key={s.key}>
                      <div className={`flex items-center gap-1.5 text-[10px] font-bold transition-all ${done ? "text-emerald-400" : active ? "" : "text-gray-600"}`}
                        style={active ? { color: themeColor } : {}}>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-black transition-all`}
                          style={done
                            ? { background: "#00d084", borderColor: "#00d084", color: "#000" }
                            : active
                            ? { background: `${themeColor}20`, borderColor: themeColor, color: themeColor }
                            : { background: "transparent", borderColor: "#374151", color: "#6b7280" }}>
                          {done ? "✓" : idx + 1}
                        </div>
                        {s.label}
                      </div>
                      {idx < arr.length - 1 && <div className="flex-1 h-px" style={{ background: done ? "#00d08440" : "#1f2937" }} />}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Email field */}
            {(step === "email" || step === "login_password") && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={step === "login_password"}
                    className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-700/70 focus:ring-1 focus:ring-emerald-700/30 transition-all disabled:opacity-60"
                    onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLoginSubmit() : handleSendOtp())}
                  />
                  {step === "login_password" && (
                    <button onClick={() => setStep("email")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-gray-300">change</button>
                  )}
                </div>
              </div>
            )}

            {/* OTP field */}
            {step === "otp" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">Verification Code</label>
                <p className="text-[11px] text-gray-600">Enter the 4-digit code sent to <span className="text-emerald-400">{email}</span></p>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter code"
                    className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-700/70 focus:ring-1 focus:ring-emerald-700/30 transition-all text-center text-lg tracking-widest font-mono"
                    onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                    autoFocus
                  />
                </div>
                <button onClick={() => setStep("email")} className="text-[10px] text-gray-600 hover:text-gray-400 underline transition-colors">← Change email</button>
              </div>
            )}

            {/* Password field (signup set) */}
            {step === "password" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 font-medium">Create Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl pl-9 pr-10 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-700/70 transition-all"
                      autoFocus
                    />
                    <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 font-medium">Confirm Password</label>
                  <div className="relative">
                    <CheckCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-700/70 transition-all"
                      onKeyDown={e => e.key === "Enter" && handleSetPassword()}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Password field (login) */}
            {step === "login_password" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl pl-9 pr-10 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-700/70 transition-all"
                    onKeyDown={e => e.key === "Enter" && handleLoginSubmit()}
                    autoFocus
                  />
                  <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={mode === "login" ? handleLoginSubmit : step === "email" ? handleSendOtp : step === "otp" ? handleVerifyOtp : handleSetPassword}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`, boxShadow: `0 4px 20px ${themeColor}40` }}
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

            {/* Footer note */}
            <p className="text-[10px] text-gray-700 text-center">
              🔒 Secure sign-in • Your data is protected
            </p>
          </div>
        </div>

        {/* Owner badge */}
        <div className="text-center mt-6 flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden border border-emerald-700/40">
            <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
          </div>
          <span className="text-[10px] text-gray-700">Built by <span className="text-gray-500">Amirul_Adnan</span> • <a href="https://t.me/amirul_adnan_trader" className="text-cyan-700 hover:text-cyan-500" target="_blank" rel="noopener noreferrer">@amirul_adnan_trader</a></span>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
      `}</style>
    </div>
  );
};

export default AuthPage;
