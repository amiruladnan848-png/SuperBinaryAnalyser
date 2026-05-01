import React, { useState, useEffect } from "react";
import { Zap, ChevronDown, Sun, Moon, Crown, LogOut, Shield } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import ownerPhoto from "@/assets/owner-photo.jpg";
import { AppTheme } from "@/types";
import { AuthUser, useAuth } from "@/lib/auth.tsx";

interface HeaderProps {
  theme: AppTheme;
  onThemeChange: (t: AppTheme) => void;
  isDark: boolean;
  onToggleDark: () => void;
  showAdmin: boolean;
  onAdminToggle: () => void;
  isAdminOpen: boolean;
  user: AuthUser | null;
}

const themes: { value: AppTheme; label: string; color: string; dark: boolean }[] = [
  { value: "emerald", label: "Emerald", color: "#00ff88", dark: true },
  { value: "gold", label: "Gold", color: "#FFD700", dark: true },
  { value: "cyber", label: "Cyber", color: "#00d4ff", dark: true },
  { value: "ocean", label: "Ocean", color: "#0080ff", dark: true },
  { value: "ruby", label: "Ruby", color: "#ff3366", dark: true },
  { value: "violet", label: "Violet", color: "#a855f7", dark: true },
  { value: "light", label: "Clean Light", color: "#2563eb", dark: false },
  { value: "rose", label: "Rose Light", color: "#e11d48", dark: false },
];

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange, isDark, onToggleDark, showAdmin, onAdminToggle, isAdminOpen, user }) => {
  const { logout } = useAuth();
  const [logoGlow, setLogoGlow] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const currentTheme = themes.find(t => t.value === theme) || themes[0];

  useEffect(() => {
    const interval = setInterval(() => setLogoGlow(g => !g), 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => setShowThemes(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const headerBg = isDark ? "bg-black/85 border-gray-800/60" : "bg-white/92 border-gray-200";

  return (
    <header className={`relative z-50 border-b ${headerBg} backdrop-blur-2xl`}>
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent 0%, ${currentTheme.color}60 30%, ${currentTheme.color} 50%, ${currentTheme.color}60 70%, transparent 100%)`, animation: "shimmer 3s linear infinite", backgroundSize: "200% auto" }} />

      <div className="relative max-w-[1800px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full blur-lg transition-all duration-[1500ms]" style={{ background: currentTheme.color, opacity: logoGlow ? 0.55 : 0.14, transform: logoGlow ? "scale(1.6)" : "scale(1)" }} />
              <img src={logoIcon} alt="Super Binary Analyser" className="w-10 h-10 relative z-10 transition-transform duration-300 hover:scale-110 hover:rotate-6" style={{ filter: `drop-shadow(0 0 10px ${currentTheme.color})` }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wide" style={{ background: `linear-gradient(90deg, ${currentTheme.color}, ${isDark ? "#ffffff" : "#1f2937"}, ${currentTheme.color})`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 3s linear infinite" }}>
                  SUPER-BINARY-ANALYSER
                </h1>
                <span className="hidden sm:flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border" style={{ color: currentTheme.color, background: `${currentTheme.color}12`, borderColor: `${currentTheme.color}35` }}>
                  <Zap size={8} /> v6.0
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Shield size={10} style={{ color: currentTheme.color }} />
                <span className={`text-[10px] tracking-widest ${isDark ? "text-gray-500" : "text-gray-400"}`}>BB POWERED • MANUAL SIGNAL ENGINE • 2026</span>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* User info */}
            <div className="hidden md:flex items-center gap-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: currentTheme.color, boxShadow: `0 0 10px ${currentTheme.color}40` }}>
                  <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
                </div>
                {user?.isAdmin && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center border border-black">
                    <Crown size={8} className="text-black" />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800"}`}>{user?.username || "User"}</span>
                <span className={`text-[9px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>{user?.isAdmin ? "Admin" : "Member"}</span>
              </div>
            </div>

            {user?.isAdmin && (
              <button onClick={onAdminToggle}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 ${isAdminOpen
                  ? "border-yellow-600/60 bg-yellow-950/30 text-yellow-400"
                  : isDark ? "border-gray-700/50 bg-gray-900/30 text-gray-400 hover:text-yellow-400 hover:border-yellow-700/50" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                <Crown size={12} />{isAdminOpen ? "Close Admin" : "Admin Panel"}
              </button>
            )}

            <div className={`hidden md:block w-px h-6 ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />

            {/* Light/Dark toggle */}
            <button onClick={onToggleDark}
              className={`p-2 rounded-lg border transition-all hover:scale-105 ${isDark ? "border-gray-700/50 bg-gray-900/40 text-yellow-400 hover:border-yellow-700/50" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Theme Selector */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowThemes(!showThemes)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isDark ? "border-gray-700/50 bg-black/40 hover:border-gray-600/70" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                <div className="w-3 h-3 rounded-full" style={{ background: currentTheme.color, boxShadow: `0 0 6px ${currentTheme.color}80` }} />
                <span className={`text-xs hidden sm:inline ${isDark ? "text-gray-400" : "text-gray-600"}`}>{currentTheme.label}</span>
                <ChevronDown size={11} className={`transition-transform ${showThemes ? "rotate-180" : ""} ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              </button>
              {showThemes && (
                <div className={`absolute right-0 top-full mt-2 border rounded-2xl p-2 flex flex-col gap-0.5 z-50 backdrop-blur-xl shadow-2xl min-w-[155px] ${isDark ? "bg-black/96 border-gray-700/50" : "bg-white/98 border-gray-200"}`}
                  style={{ boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${currentTheme.color}20` }}>
                  <div className={`text-[9px] font-bold tracking-widest px-2 pb-1.5 pt-0.5 ${isDark ? "text-gray-600" : "text-gray-400"}`}>🌙 DARK</div>
                  {themes.filter(t => t.dark).map(t => (
                    <button key={t.value} onClick={() => { onThemeChange(t.value); setShowThemes(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${theme === t.value ? (isDark ? "bg-gray-800/80 text-white" : "bg-gray-100") : (isDark ? "text-gray-400 hover:bg-gray-800/50 hover:text-white" : "text-gray-600 hover:bg-gray-50")}`}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color, boxShadow: `0 0 5px ${t.color}80` }} />
                      {t.label}
                      {theme === t.value && <span className="ml-auto text-[8px] opacity-60">✓</span>}
                    </button>
                  ))}
                  <div className={`text-[9px] font-bold tracking-widest px-2 py-1.5 border-t mt-0.5 ${isDark ? "text-gray-600 border-gray-800" : "text-gray-400 border-gray-100"}`}>☀️ LIGHT</div>
                  {themes.filter(t => !t.dark).map(t => (
                    <button key={t.value} onClick={() => { onThemeChange(t.value); setShowThemes(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${theme === t.value ? (isDark ? "bg-gray-800/80 text-white" : "bg-gray-100") : (isDark ? "text-gray-400 hover:bg-gray-800/50 hover:text-white" : "text-gray-600 hover:bg-gray-50")}`}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color, boxShadow: `0 0 5px ${t.color}80` }} />
                      {t.label}
                      {theme === t.value && <span className="ml-auto text-[8px] opacity-60">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logout */}
            <button onClick={logout}
              className={`p-2 rounded-lg border transition-all hover:scale-105 border-red-700/40 bg-red-950/20 text-red-400 hover:bg-red-950/30`}
              title="Logout">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:0% center} 100%{background-position:200% center} }`}</style>
    </header>
  );
};

export default Header;
