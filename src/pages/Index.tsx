import React, { useState, useEffect, useCallback } from "react";
import PinLock from "@/components/PinLock";
import Header from "@/components/Header";
import MarketClock from "@/components/MarketClock";
import APIKeySetup from "@/components/APIKeySetup";
import PairSelector from "@/components/PairSelector";
import SignalPanel from "@/components/SignalPanel";
import StatsBar from "@/components/StatsBar";
import TradingViewChart from "@/components/TradingViewChart";
import ScreenshotAnalyser from "@/components/ScreenshotAnalyser";
import { AppTheme } from "@/types";
import heroBanner from "@/assets/hero-banner.jpg";
import ownerPhoto from "@/assets/owner-photo.jpg";
import { isWeekend } from "@/lib/marketUtils";

const THEME_CONFIG: Record<AppTheme, { color: string; dark: boolean }> = {
  emerald: { color: "#00ff88", dark: true },
  gold: { color: "#FFD700", dark: true },
  cyber: { color: "#00d4ff", dark: true },
  ocean: { color: "#0080ff", dark: true },
  ruby: { color: "#ff3366", dark: true },
  violet: { color: "#a855f7", dark: true },
  light: { color: "#2563eb", dark: false },
  rose: { color: "#e11d48", dark: false },
};

const STORAGE_KEYS = {
  unlocked: "sba_unlocked",
  apiKey: "sba_api_key",
  apiValid: "sba_api_valid",
  selectedPairs: "sba_pairs",
  theme: "sba_theme",
  signalCount: "sba_signal_count",
  soundEnabled: "sba_sound",
};

const DEFAULT_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "EUR/JPY"];

const Index: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("emerald");
  const [isDark, setIsDark] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [apiValid, setApiValid] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [signalCount, setSignalCount] = useState(0);
  const [engineRunning, setEngineRunning] = useState(false);
  const [chartPair, setChartPair] = useState("EUR/USD");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<"signals" | "screenshot">("signals");
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; dur: number }>>([]);
  const [ownerBgLoaded, setOwnerBgLoaded] = useState(false);
  const [weekend, setWeekend] = useState(false);

  useEffect(() => {
    const stored = {
      unlocked: localStorage.getItem(STORAGE_KEYS.unlocked) === "true",
      apiKey: localStorage.getItem(STORAGE_KEYS.apiKey) || "",
      apiValid: localStorage.getItem(STORAGE_KEYS.apiValid) === "true",
      pairs: JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedPairs) || JSON.stringify(DEFAULT_PAIRS)),
      theme: (localStorage.getItem(STORAGE_KEYS.theme) as AppTheme) || "emerald",
      count: parseInt(localStorage.getItem(STORAGE_KEYS.signalCount) || "0"),
      sound: localStorage.getItem(STORAGE_KEYS.soundEnabled) !== "false",
    };
    setUnlocked(stored.unlocked);
    setApiKey(stored.apiKey);
    setApiValid(stored.apiValid);
    setSelectedPairs(stored.pairs);
    setTheme(stored.theme);
    setIsDark(THEME_CONFIG[stored.theme]?.dark ?? true);
    setSignalCount(stored.count);
    setSoundEnabled(stored.sound);
    setChartPair(stored.pairs[0] || "EUR/USD");
    setMounted(true);
    setWeekend(isWeekend());

    setParticles(Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      delay: Math.random() * 10,
      dur: 6 + Math.random() * 8,
    })));

    // Update weekend status every minute
    const weekendTimer = setInterval(() => setWeekend(isWeekend()), 60000);
    return () => clearInterval(weekendTimer);
  }, []);

  // Auto-switch to screenshot tab on weekend
  useEffect(() => {
    if (weekend && activeTab === "signals") {
      setActiveTab("screenshot");
    }
  }, [weekend]);

  const handleUnlock = () => {
    setUnlocked(true);
    localStorage.setItem(STORAGE_KEYS.unlocked, "true");
  };

  const handleTheme = (t: AppTheme) => {
    setTheme(t);
    const config = THEME_CONFIG[t];
    setIsDark(config?.dark ?? true);
    localStorage.setItem(STORAGE_KEYS.theme, t);
  };

  const handleToggleDark = () => {
    if (isDark) handleTheme("light");
    else handleTheme("emerald");
  };

  const handleApiSave = (key: string, valid: boolean) => {
    setApiKey(key);
    setApiValid(valid);
    localStorage.setItem(STORAGE_KEYS.apiKey, key);
    localStorage.setItem(STORAGE_KEYS.apiValid, String(valid));
  };

  const handleTogglePair = (symbol: string) => {
    setSelectedPairs(prev => {
      const next = prev.includes(symbol) ? prev.filter(p => p !== symbol) : [...prev, symbol];
      localStorage.setItem(STORAGE_KEYS.selectedPairs, JSON.stringify(next));
      if (!prev.includes(symbol)) setChartPair(symbol);
      return next;
    });
  };

  const handleSignalGenerated = useCallback((count: number) => {
    setSignalCount(prev => {
      const next = prev + count;
      localStorage.setItem(STORAGE_KEYS.signalCount, String(next));
      return next;
    });
    setEngineRunning(true);
  }, []);

  const handleSoundToggle = () => {
    setSoundEnabled(prev => {
      localStorage.setItem(STORAGE_KEYS.soundEnabled, String(!prev));
      return !prev;
    });
  };

  const themeColor = THEME_CONFIG[theme]?.color || "#00ff88";

  if (!mounted) return null;
  if (!unlocked) return <PinLock onUnlock={handleUnlock} />;

  const pageBg = isDark ? "bg-[#020c15]" : "bg-gray-50";

  return (
    <div className={`min-h-screen ${pageBg} relative overflow-x-hidden`} style={{ color: isDark ? "#e5e7eb" : "#1f2937" }}>

      {/* ── Owner Photo & Animated Background ─────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {isDark ? (
          <>
            {/* Owner photo — primary atmospheric background layer */}
            <div
              className="absolute inset-0 transition-opacity duration-1500"
              style={{ opacity: ownerBgLoaded ? 1 : 0 }}
            >
              {/* Right-side subtle portrait */}
              <div
                className="absolute top-0 right-0 bottom-0"
                style={{
                  width: "45%",
                  backgroundImage: `url(${ownerPhoto})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.07,
                  filter: "blur(12px) saturate(2)",
                }}
              />
              {/* Full background very subtle */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${ownerPhoto})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.03,
                  filter: "blur(30px) saturate(1.5)",
                }}
              />
              {/* Gradient overlay to blend with dark theme */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, #020c15 0%, #020c15ee 40%, #020c15a0 65%, #020c1530 100%)`,
                }}
              />
            </div>

            {/* Preload trigger */}
            <img src={ownerPhoto} alt="" className="hidden" onLoad={() => setOwnerBgLoaded(true)} />

            {/* Dark atmospheric overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 80% 50% at 20% -5%, ${themeColor}09 0%, transparent 65%), radial-gradient(ellipse 60% 40% at 80% 100%, ${themeColor}06 0%, transparent 60%)`,
              }}
            />

            {/* Grid */}
            <div
              className="absolute inset-0 opacity-[0.018]"
              style={{
                backgroundImage: `linear-gradient(${themeColor} 1px, transparent 1px), linear-gradient(90deg, ${themeColor} 1px, transparent 1px)`,
                backgroundSize: "60px 60px",
              }}
            />

            {/* Glow orbs — themed */}
            <div className="absolute top-1/4 left-1/5 w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.045]" style={{ background: themeColor }} />
            <div className="absolute bottom-1/3 right-1/5 w-[450px] h-[450px] rounded-full blur-[120px] opacity-[0.035]" style={{ background: "#00d4ff" }} />
            <div className="absolute top-2/3 left-1/3 w-[350px] h-[350px] rounded-full blur-[110px] opacity-[0.025]" style={{ background: "#FFD700" }} />

            {/* Floating particles */}
            {particles.map(p => (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  background: themeColor,
                  opacity: 0.10,
                  animation: `floatParticle ${p.dur}s ease-in-out infinite`,
                  animationDelay: `${p.delay}s`,
                }}
              />
            ))}

            {/* Animated scan line */}
            <div
              className="absolute left-0 right-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${themeColor}20 30%, ${themeColor}50 50%, ${themeColor}20 70%, transparent 100%)`,
                animation: "scanLineFull 16s linear infinite",
              }}
            />
          </>
        ) : (
          <>
            {/* Light mode — gentle owner photo hint */}
            <div
              className="absolute inset-0 transition-opacity duration-1500"
              style={{ opacity: ownerBgLoaded ? 1 : 0 }}
            >
              <div
                className="absolute right-0 top-0 bottom-0"
                style={{
                  width: "35%",
                  backgroundImage: `url(${ownerPhoto})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  opacity: 0.04,
                  filter: "blur(20px) grayscale(0.5) saturate(1.2)",
                }}
              />
            </div>
            <img src={ownerPhoto} alt="" className="hidden" onLoad={() => setOwnerBgLoaded(true)} />
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50/20" />
            <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-[0.06]" style={{ background: themeColor }} />
          </>
        )}
      </div>

      <Header theme={theme} onThemeChange={handleTheme} isDark={isDark} onToggleDark={handleToggleDark} />

      <div className="relative z-10 max-w-[1800px] mx-auto px-4 py-5 space-y-4">

        {/* ── Hero Banner ─────────────────────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden border transition-all duration-500"
          style={{
            borderColor: `${themeColor}30`,
            boxShadow: `0 0 60px ${themeColor}10, 0 0 120px ${themeColor}05, inset 0 0 60px ${themeColor}03`,
          }}
        >
          <img src={heroBanner} alt="Super Binary Analyser" className="w-full h-40 sm:h-52 object-cover" style={{ opacity: isDark ? 0.35 : 0.3 }} />

          {/* Owner photo — right bleed effect in hero */}
          <div className="absolute right-0 top-0 bottom-0 w-52 sm:w-80 overflow-hidden">
            <img
              src={ownerPhoto}
              alt=""
              className="w-full h-full object-cover object-top"
              style={{
                opacity: isDark ? 0.22 : 0.15,
                filter: isDark ? "blur(0.5px) saturate(1.3)" : "blur(1px) saturate(0.9) grayscale(0.3)",
              }}
            />
            {/* Fade-in mask from left */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${isDark ? "#020c15" : "#ffffff"} 0%, ${isDark ? "#020c15cc" : "#ffffffcc"} 30%, transparent 80%)`,
              }}
            />
          </div>

          {/* Dark gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? `linear-gradient(90deg, #020c15 0%, #020c15bb 55%, transparent 100%)`
                : `linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 55%, transparent 100%)`,
            }}
          />

          {/* Animated theme border glow on hero */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${themeColor}80, transparent)`,
              boxShadow: `0 0 15px ${themeColor}60`,
            }}
          />

          <div className="absolute inset-0 flex items-center px-6 sm:px-8">
            <div className="max-w-xl">
              <h2
                className="text-2xl sm:text-4xl font-black tracking-wide leading-tight"
                style={{
                  background: `linear-gradient(90deg, ${themeColor}, ${isDark ? "#ffffff" : "#1f2937"}, ${themeColor})`,
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: "shimmer 4s linear infinite",
                }}
              >
                SUPER-BINARY-ANALYSER
              </h2>
              <p className={`text-sm mt-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                AI-Powered 1-Min Signal Engine • 14+ Indicators • Price Action • Deep Chart Analysis • 2026
              </p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {/* Owner avatar + name */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full overflow-hidden border-2 flex-shrink-0 shadow-xl"
                    style={{
                      borderColor: themeColor,
                      boxShadow: `0 0 14px ${themeColor}50`,
                    }}
                  >
                    <img src={ownerPhoto} alt="Amirul_Adnan" className="w-full h-full object-cover object-top" />
                  </div>
                  <span className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Owner: Amirul_Adnan</span>
                </div>

                <a
                  href="https://t.me/amirul_adnan_trader"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 hover:underline"
                >
                  📱 @amirul_adnan_trader
                </a>

                <span
                  className="text-[10px] font-black px-3 py-1 rounded-full border"
                  style={{
                    color: themeColor,
                    borderColor: `${themeColor}40`,
                    background: `${themeColor}12`,
                    boxShadow: `0 0 14px ${themeColor}20`,
                  }}
                >
                  ⚡ ULTRA HIGH ACCURACY
                </span>

                {weekend && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-700/40 bg-amber-950/20 text-amber-400">
                    📅 Weekend — Screenshot Mode Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live badge */}
          <div
            className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
            style={{ borderColor: `${themeColor}30`, background: isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.9)" }}
          >
            <div className="w-2 h-2 rounded-full animate-ping" style={{ background: themeColor }} />
            <span className="text-[10px] font-black" style={{ color: themeColor }}>
              {weekend ? "SCREENSHOT ONLY" : "LIVE SIGNALS"}
            </span>
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar
          signalCount={signalCount}
          selectedPairs={selectedPairs.length}
          themeColor={themeColor}
          isRunning={engineRunning}
          isDark={isDark}
        />

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[290px,1fr] gap-4">

          {/* Left Sidebar */}
          <div className="space-y-4">
            <MarketClock themeColor={themeColor} isDark={isDark} />
            <APIKeySetup apiKey={apiKey} isValid={apiValid} onSave={handleApiSave} themeColor={themeColor} isDark={isDark} />
            <PairSelector selectedPairs={selectedPairs} onTogglePair={handleTogglePair} themeColor={themeColor} isDark={isDark} />
          </div>

          {/* Right Content */}
          <div className="space-y-4">
            <TradingViewChart pair={chartPair} themeColor={themeColor} isDark={isDark} />

            {/* Pair Switcher for Chart */}
            {selectedPairs.length > 1 && (
              <div className="flex gap-2 flex-wrap items-center">
                <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Chart:</span>
                {selectedPairs.map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPair(p)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-150 active:scale-95 hover:scale-[1.04]"
                    style={chartPair === p
                      ? { background: `${themeColor}20`, color: themeColor, borderColor: `${themeColor}50`, boxShadow: `0 0 10px ${themeColor}25` }
                      : { background: isDark ? "#0a0a0a" : "#f9fafb", color: isDark ? "#9ca3af" : "#6b7280", borderColor: isDark ? "#1f2937" : "#e5e7eb" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Tab Switcher */}
            <div className={`flex gap-1 p-1 rounded-xl border ${isDark ? "border-gray-800/50 bg-black/40" : "border-gray-200 bg-gray-100/80"} backdrop-blur-sm`}>
              {[
                {
                  id: "signals",
                  label: "🎯 Signal Engine",
                  desc: weekend ? "Locked on weekends" : "Auto 1-min signals",
                  locked: weekend,
                },
                {
                  id: "screenshot",
                  label: "📷 Chart Analyser",
                  desc: "Screenshot deep analysis • 24/7",
                  locked: false,
                },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className="flex-1 flex flex-col items-center py-2.5 px-3 rounded-lg transition-all duration-200 hover:scale-[1.01] relative"
                  style={activeTab === tab.id ? { background: `${themeColor}15`, boxShadow: `0 0 15px ${themeColor}15` } : {}}
                >
                  <span className="text-sm font-bold" style={{ color: activeTab === tab.id ? themeColor : isDark ? "#9ca3af" : "#6b7280" }}>
                    {tab.label}
                    {tab.locked && <span className="ml-1.5 text-[9px] text-amber-400">🔒</span>}
                  </span>
                  <span className={`text-[10px] mt-0.5 ${isDark ? "text-gray-600" : "text-gray-400"}`}>{tab.desc}</span>
                  {tab.id === "screenshot" && weekend && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse border border-black" />
                  )}
                </button>
              ))}
            </div>

            {/* Active Tab Content */}
            {activeTab === "signals" ? (
              <SignalPanel
                selectedPairs={selectedPairs}
                apiKey={apiKey}
                isApiValid={apiValid}
                themeColor={themeColor}
                isDark={isDark}
                onSignalGenerated={handleSignalGenerated}
                onPairChange={setChartPair}
                soundEnabled={soundEnabled}
                onSoundToggle={handleSoundToggle}
              />
            ) : (
              <ScreenshotAnalyser themeColor={themeColor} isDark={isDark} soundEnabled={soundEnabled} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t ${isDark ? "border-gray-800/30" : "border-gray-200"} pt-4 pb-3`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full overflow-hidden border-2 flex-shrink-0 shadow-lg"
                style={{ borderColor: `${themeColor}50`, boxShadow: `0 0 10px ${themeColor}30` }}
              >
                <img src={ownerPhoto} alt="Amirul_Adnan" className="w-full h-full object-cover object-top" />
              </div>
              <span className={`text-xs ${isDark ? "text-gray-700" : "text-gray-400"}`}>
                © 2026 Super-Binary-Analyser • Owner: Amirul_Adnan • v5.0 Ultra
              </span>
            </div>
            <div className={`flex items-center gap-4 text-xs ${isDark ? "text-gray-700" : "text-gray-400"}`}>
              <span>⚠️ Educational purposes only. Trade responsibly.</span>
              <a
                href="https://t.me/amirul_adnan_trader"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 hover:text-cyan-500 transition-colors"
              >
                @amirul_adnan_trader
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Global Animations */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); opacity: 0.10; }
          33% { transform: translateY(-22px) rotate(120deg) scale(1.3); opacity: 0.22; }
          66% { transform: translateY(-10px) rotate(240deg) scale(0.85); opacity: 0.14; }
        }
        @keyframes scanLineFull {
          0% { top: -2px; opacity: 0; }
          4% { opacity: 1; }
          96% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes scanLine {
          0% { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes slide-in-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 10px ${themeColor}30; }
          50% { box-shadow: 0 0 25px ${themeColor}60; }
        }
        .signal-enter {
          animation: slide-in-up 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        * { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${themeColor}35; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: ${themeColor}65; }
        ::selection { background: ${themeColor}30; }
      `}</style>
    </div>
  );
};

export default Index;
