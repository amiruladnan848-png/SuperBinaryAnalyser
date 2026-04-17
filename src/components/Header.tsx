import React, { useState, useEffect } from "react";
import { Zap, TrendingUp, ChevronDown, Sun, Moon } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import ownerPhoto from "@/assets/owner-photo.jpg";
import { AppTheme } from "@/types";

interface HeaderProps {
  theme: AppTheme;
  onThemeChange: (t: AppTheme) => void;
  isDark: boolean;
  onToggleDark: () => void;
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

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange, isDark, onToggleDark }) => {
  const [logoGlow, setLogoGlow] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [ownerLoaded, setOwnerLoaded] = useState(false);
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

  const headerBg = isDark
    ? "bg-black/85 border-gray-800/60"
    : "bg-white/92 border-gray-200";

  return (
    <header className={`relative z-50 border-b ${headerBg} backdrop-blur-2xl`}>
      {/* Owner photo subtle background layer in header */}
      {isDark && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ opacity: ownerLoaded ? 0.04 : 0 }}
        >
          <img
            src={ownerPhoto}
            alt=""
            className="absolute right-0 top-0 h-full object-cover object-top"
            style={{ width: "200px", filter: "blur(8px) saturate(1.8)" }}
            onLoad={() => setOwnerLoaded(true)}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, #000 40%, transparent 100%)" }}
          />
        </div>
      )}

      {/* Animated gradient line at bottom of header */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${currentTheme.color}60 30%, ${currentTheme.color} 50%, ${currentTheme.color}60 70%, transparent 100%)`,
          animation: "shimmer 3s linear infinite",
          backgroundSize: "200% auto",
        }}
      />

      <div className="relative max-w-[1800px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">

          {/* Logo + Branding */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-full blur-lg transition-all duration-[1500ms]"
                style={{
                  background: currentTheme.color,
                  opacity: logoGlow ? 0.6 : 0.15,
                  transform: logoGlow ? "scale(1.6)" : "scale(1)",
                }}
              />
              <img
                src={logoIcon}
                alt="Super Binary Analyser"
                className="w-11 h-11 relative z-10 transition-transform duration-300 hover:scale-110 hover:rotate-6"
                style={{ filter: `drop-shadow(0 0 10px ${currentTheme.color})` }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg font-black tracking-wide leading-tight"
                  style={{
                    background: `linear-gradient(90deg, ${currentTheme.color}, ${isDark ? "#ffffff" : "#1f2937"}, ${currentTheme.color})`,
                    backgroundSize: "200% auto",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "shimmer 3s linear infinite",
                  }}
                >
                  SUPER-BINARY-ANALYSER
                </h1>
                <span className="hidden sm:flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border" style={{ color: currentTheme.color, background: `${currentTheme.color}12`, borderColor: `${currentTheme.color}35` }}>
                  <Zap size={8} /> v5.0
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <TrendingUp size={10} style={{ color: currentTheme.color }} />
                <span className={`text-[10px] tracking-widest ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  HIGH ACCURACY BINARY SIGNAL ENGINE • 2026
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* Owner info with photo */}
            <div className="hidden md:flex items-center gap-2.5">
              <div className="relative">
                <div
                  className="w-9 h-9 rounded-full overflow-hidden border-2 flex-shrink-0 shadow-lg"
                  style={{
                    borderColor: currentTheme.color,
                    boxShadow: `0 0 12px ${currentTheme.color}40`,
                  }}
                >
                  <img
                    src={ownerPhoto}
                    alt="Amirul_Adnan"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-black flex-shrink-0"
                  style={{ background: "#00ff88" }}
                />
              </div>
              <div className="flex flex-col items-start text-right">
                <span className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800"}`}>Amirul_Adnan</span>
                <a
                  href="https://t.me/amirul_adnan_trader"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-cyan-500 hover:text-cyan-400 transition-colors"
                >
                  📱 @amirul_adnan_trader
                </a>
              </div>
            </div>

            {/* Divider */}
            <div className={`hidden md:block w-px h-7 ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />

            {/* Dark/Light toggle */}
            <button
              onClick={onToggleDark}
              className={`p-2 rounded-lg border transition-all duration-200 hover:scale-105 ${isDark ? "border-gray-700/50 bg-gray-900/40 text-yellow-400 hover:border-yellow-700/50 hover:bg-yellow-950/20" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"}`}
              title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Theme Selector */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowThemes(!showThemes)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 backdrop-blur-sm ${isDark ? "border-gray-700/50 bg-black/40 hover:border-gray-600/70" : "border-gray-200 bg-white hover:border-gray-300"}`}
              >
                <div className="w-3 h-3 rounded-full" style={{ background: currentTheme.color, boxShadow: `0 0 6px ${currentTheme.color}80` }} />
                <span className={`text-xs hidden sm:inline ${isDark ? "text-gray-400" : "text-gray-600"}`}>{currentTheme.label}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showThemes ? "rotate-180" : ""} ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              </button>

              {showThemes && (
                <div className={`absolute right-0 top-full mt-2 border rounded-2xl p-2 flex flex-col gap-0.5 z-50 backdrop-blur-xl shadow-2xl min-w-[160px] ${isDark ? "bg-black/96 border-gray-700/50" : "bg-white/98 border-gray-200"}`}
                  style={{ boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${currentTheme.color}20` }}
                >
                  <div className={`text-[9px] font-bold tracking-widest px-2 pb-1.5 pt-0.5 ${isDark ? "text-gray-600" : "text-gray-400"}`}>🌙 DARK THEMES</div>
                  {themes.filter(t => t.dark).map(t => (
                    <button
                      key={t.value}
                      onClick={() => { onThemeChange(t.value); setShowThemes(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150 ${theme === t.value ? (isDark ? "bg-gray-800/80 text-white" : "bg-gray-100 text-gray-900") : (isDark ? "text-gray-400 hover:bg-gray-800/50 hover:text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: t.color, boxShadow: `0 0 5px ${t.color}80` }} />
                      {t.label}
                      {theme === t.value && <span className="ml-auto text-[8px] opacity-60">✓</span>}
                    </button>
                  ))}
                  <div className={`text-[9px] font-bold tracking-widest px-2 py-1.5 border-t mt-0.5 ${isDark ? "text-gray-600 border-gray-800" : "text-gray-400 border-gray-100"}`}>☀️ LIGHT THEMES</div>
                  {themes.filter(t => !t.dark).map(t => (
                    <button
                      key={t.value}
                      onClick={() => { onThemeChange(t.value); setShowThemes(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150 ${theme === t.value ? (isDark ? "bg-gray-800/80 text-white" : "bg-gray-100 text-gray-900") : (isDark ? "text-gray-400 hover:bg-gray-800/50 hover:text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: t.color, boxShadow: `0 0 5px ${t.color}80` }} />
                      {t.label}
                      {theme === t.value && <span className="ml-auto text-[8px] opacity-60">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </header>
  );
};

export default Header;
