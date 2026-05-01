import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth, ADMIN_EMAIL } from "@/lib/auth";
import AuthPage from "@/components/auth/AuthPage";
import AdminPanel from "@/components/admin/AdminPanel";
import Header from "@/components/Header";
import MarketClock from "@/components/MarketClock";
import PairSelector from "@/components/PairSelector";
import ManualSignalPanel from "@/components/ManualSignalPanel";
import StatsBar from "@/components/StatsBar";
import TradingViewChart from "@/components/TradingViewChart";
import { AppTheme } from "@/types";
import ownerPhoto from "@/assets/owner-photo.jpg";
import heroBanner from "@/assets/hero-banner.jpg";
import { supabase } from "@/lib/supabase";
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
  selectedPairs: "sba_pairs",
  theme: "sba_theme",
  sound: "sba_sound",
};

const DEFAULT_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "EUR/JPY"];

// ── Inner app (needs auth context) ───────────────────────────────────────────
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [authDone, setAuthDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("emerald");
  const [isDark, setIsDark] = useState(true);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [chartPair, setChartPair] = useState("EUR/USD");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [signalCount, setSignalCount] = useState(0);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; dur: number }>>([]);
  const [ownerBgLoaded, setOwnerBgLoaded] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // User access from DB
  const [isAllowed, setIsAllowed] = useState(false);
  const [signalLimit, setSignalLimit] = useState(10);
  const [signalsUsed, setSignalsUsed] = useState(0);

  useEffect(() => {
    const stored = {
      pairs: JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedPairs) || JSON.stringify(DEFAULT_PAIRS)),
      theme: (localStorage.getItem(STORAGE_KEYS.theme) as AppTheme) || "emerald",
      sound: localStorage.getItem(STORAGE_KEYS.sound) !== "false",
    };
    setSelectedPairs(stored.pairs);
    setTheme(stored.theme);
    setIsDark(THEME_CONFIG[stored.theme]?.dark ?? true);
    setSoundEnabled(stored.sound);
    setChartPair(stored.pairs[0] || "EUR/USD");
    setMounted(true);
    setWeekend(isWeekend());
    setParticles(Array.from({ length: 28 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 1 + Math.random() * 2, delay: Math.random() * 10, dur: 6 + Math.random() * 8,
    })));
    const t = setInterval(() => setWeekend(isWeekend()), 60000);
    return () => clearInterval(t);
  }, []);

  // Fetch user access record from DB
  useEffect(() => {
    if (!user) return;

    // Admin has unrestricted access
    if (user.isAdmin) {
      setIsAllowed(true);
      setSignalLimit(999);
      setSignalsUsed(0);
      return;
    }

    const fetchAccess = async () => {
      const { data } = await supabase
        .from("user_access")
        .select("is_allowed, signal_limit, signals_used_today, last_reset_date")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        // Reset daily count if new day
        const today = new Date().toISOString().split("T")[0];
        let usedToday = data.signals_used_today;
        if (data.last_reset_date !== today) {
          await supabase.from("user_access").update({ signals_used_today: 0, last_reset_date: today }).eq("user_id", user.id);
          usedToday = 0;
        }
        setIsAllowed(data.is_allowed);
        setSignalLimit(data.signal_limit);
        setSignalsUsed(usedToday);
      } else {
        // No record yet — create pending access
        await supabase.from("user_access").insert({ user_id: user.id, is_allowed: false, signal_limit: 10, signals_used_today: 0 });
        setIsAllowed(false);
        setSignalLimit(10);
        setSignalsUsed(0);
      }
    };

    fetchAccess();
  }, [user]);

  const handleTheme = (t: AppTheme) => {
    setTheme(t);
    setIsDark(THEME_CONFIG[t]?.dark ?? true);
    localStorage.setItem(STORAGE_KEYS.theme, t);
  };
  const handleToggleDark = () => handleTheme(isDark ? "light" : "emerald");

  const handleTogglePair = (symbol: string) => {
    setSelectedPairs(prev => {
      const next = prev.includes(symbol) ? prev.filter(p => p !== symbol) : [...prev, symbol];
      localStorage.setItem(STORAGE_KEYS.selectedPairs, JSON.stringify(next));
      if (!prev.includes(symbol)) setChartPair(symbol);
      return next;
    });
  };

  const handleSignalGenerated = (count: number) => {
    setSignalCount(prev => prev + count);
  };

  const handleSignalsUsed = async (n: number) => {
    setSignalsUsed(n);
    if (user && !user.isAdmin) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("user_access").update({ signals_used_today: n, last_reset_date: today }).eq("user_id", user.id);
    }
  };

  const handleSoundToggle = () => {
    setSoundEnabled(prev => {
      localStorage.setItem(STORAGE_KEYS.sound, String(!prev));
      return !prev;
    });
  };

  const themeColor = THEME_CONFIG[theme]?.color || "#00ff88";

  if (!mounted || loading) return (
    <div className="min-h-screen bg-[#020c15] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00ff8860", borderTopColor: "#00ff88" }} />
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>
  );

  if (!user) return <AuthPage onAuthSuccess={() => setAuthDone(prev => !prev)} />;

  const pageBg = isDark ? "bg-[#020c15]" : "bg-gray-50";

  return (
    <div className={`min-h-screen ${pageBg} relative overflow-x-hidden`} style={{ color: isDark ? "#e5e7eb" : "#1f2937" }}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute inset-0 transition-opacity duration-1500" style={{ opacity: ownerBgLoaded ? 1 : 0 }}>
              <div className="absolute top-0 right-0 bottom-0" style={{ width: "45%", backgroundImage: `url(${ownerPhoto})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.07, filter: "blur(12px) saturate(2)" }} />
              <div className="absolute inset-0" style={{ backgroundImage: `url(${ownerPhoto})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.03, filter: "blur(30px)" }} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, #020c15 0%, #020c15ee 40%, #020c15a0 65%, #020c1530 100%)` }} />
            </div>
            <img src={ownerPhoto} alt="" className="hidden" onLoad={() => setOwnerBgLoaded(true)} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 50% at 20% -5%, ${themeColor}09 0%, transparent 65%), radial-gradient(ellipse 60% 40% at 80% 100%, ${themeColor}06 0%, transparent 60%)` }} />
            <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: `linear-gradient(${themeColor} 1px, transparent 1px), linear-gradient(90deg, ${themeColor} 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
            <div className="absolute top-1/4 left-1/5 w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.04]" style={{ background: themeColor }} />
            <div className="absolute bottom-1/3 right-1/5 w-[450px] h-[450px] rounded-full blur-[120px] opacity-[0.03]" style={{ background: "#00d4ff" }} />
            {particles.map(p => (
              <div key={p.id} className="absolute rounded-full" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, background: themeColor, opacity: 0.09, animation: `floatParticle ${p.dur}s ease-in-out infinite`, animationDelay: `${p.delay}s` }} />
            ))}
            <div className="absolute left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent 0%, ${themeColor}20 30%, ${themeColor}50 50%, ${themeColor}20 70%, transparent 100%)`, animation: "scanLineFull 16s linear infinite" }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0 transition-opacity" style={{ opacity: ownerBgLoaded ? 1 : 0 }}>
              <div className="absolute right-0 top-0 bottom-0" style={{ width: "35%", backgroundImage: `url(${ownerPhoto})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.04, filter: "blur(20px)" }} />
            </div>
            <img src={ownerPhoto} alt="" className="hidden" onLoad={() => setOwnerBgLoaded(true)} />
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50/20" />
          </>
        )}
      </div>

      <Header theme={theme} onThemeChange={handleTheme} isDark={isDark} onToggleDark={handleToggleDark} showAdmin={user.isAdmin} onAdminToggle={() => setShowAdmin(p => !p)} isAdminOpen={showAdmin} user={user} />

      <div className="relative z-10 max-w-[1800px] mx-auto px-4 py-5 space-y-4">

        {/* Admin Panel */}
        {user.isAdmin && showAdmin && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${themeColor}30`, background: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)" }}>
            <div className="p-5">
              <AdminPanel themeColor={themeColor} isDark={isDark} />
            </div>
          </div>
        )}

        {/* Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border transition-all" style={{ borderColor: `${themeColor}30`, boxShadow: `0 0 60px ${themeColor}10` }}>
          <img src={heroBanner} alt="Super Binary Analyser" className="w-full h-36 sm:h-48 object-cover" style={{ opacity: isDark ? 0.35 : 0.3 }} />
          <div className="absolute right-0 top-0 bottom-0 w-48 sm:w-72 overflow-hidden">
            <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" style={{ opacity: isDark ? 0.20 : 0.13, filter: "blur(0.5px)" }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${isDark ? "#020c15" : "#fff"} 0%, ${isDark ? "#020c15bb" : "#ffffffbb"} 30%, transparent 80%)` }} />
          </div>
          <div className="absolute inset-0" style={{ background: isDark ? `linear-gradient(90deg, #020c15 0%, #020c15bb 55%, transparent 100%)` : `linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 55%, transparent 100%)` }} />
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${themeColor}80, transparent)` }} />
          <div className="absolute inset-0 flex items-center px-6 sm:px-8">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-4xl font-black tracking-wide leading-tight" style={{ background: `linear-gradient(90deg, ${themeColor}, ${isDark ? "#ffffff" : "#1f2937"}, ${themeColor})`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s linear infinite" }}>
                SUPER-BINARY-ANALYSER
              </h2>
              <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                12 Indicators • BB Primary • Price Action • Manual Signal Engine • 2026
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: themeColor, boxShadow: `0 0 10px ${themeColor}50` }}>
                    <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
                  </div>
                  <span className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {user.isAdmin ? "👑 Admin" : `@${user.username}`}
                  </span>
                </div>
                <a href="https://t.me/amirul_adnan_trader" target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">📱 @amirul_adnan_trader</a>
                <span className="text-[10px] font-black px-3 py-1 rounded-full border" style={{ color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}12` }}>⚡ BB POWERED</span>
                {weekend && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-700/40 bg-amber-950/20 text-amber-400">📅 Weekend Mode</span>}
              </div>
            </div>
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm" style={{ borderColor: `${themeColor}30`, background: isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.9)" }}>
            <div className="w-2 h-2 rounded-full animate-ping" style={{ background: themeColor }} />
            <span className="text-[10px] font-black" style={{ color: themeColor }}>MANUAL MODE</span>
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar signalCount={signalCount} selectedPairs={selectedPairs.length} themeColor={themeColor} isRunning={false} isDark={isDark} />

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[290px,1fr] gap-4">
          {/* Sidebar */}
          <div className="space-y-4">
            <MarketClock themeColor={themeColor} isDark={isDark} />
            <PairSelector selectedPairs={selectedPairs} onTogglePair={handleTogglePair} themeColor={themeColor} isDark={isDark} />
          </div>

          {/* Main Content */}
          <div className="space-y-4">
            <TradingViewChart pair={chartPair} themeColor={themeColor} isDark={isDark} />

            {/* Pair Switcher */}
            {selectedPairs.length > 1 && (
              <div className="flex gap-2 flex-wrap items-center">
                <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Chart:</span>
                {selectedPairs.map(p => (
                  <button key={p} onClick={() => setChartPair(p)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-150 active:scale-95 hover:scale-[1.04]"
                    style={chartPair === p
                      ? { background: `${themeColor}20`, color: themeColor, borderColor: `${themeColor}50`, boxShadow: `0 0 10px ${themeColor}25` }
                      : { background: isDark ? "#0a0a0a" : "#f9fafb", color: isDark ? "#9ca3af" : "#6b7280", borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Manual Signal Panel */}
            <ManualSignalPanel
              selectedPairs={selectedPairs}
              themeColor={themeColor}
              isDark={isDark}
              onSignalGenerated={handleSignalGenerated}
              onPairChange={setChartPair}
              soundEnabled={soundEnabled}
              onSoundToggle={handleSoundToggle}
              signalLimit={signalLimit}
              signalsUsed={signalsUsed}
              onSignalsUsed={handleSignalsUsed}
              isAllowed={isAllowed}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t ${isDark ? "border-gray-800/30" : "border-gray-200"} pt-4 pb-3`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: `${themeColor}50` }}>
                <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
              </div>
              <span className={`text-xs ${isDark ? "text-gray-700" : "text-gray-400"}`}>
                © 2026 Super-Binary-Analyser • Owner: Amirul_Adnan • v6.0 BB Ultra
              </span>
            </div>
            <div className={`flex items-center gap-4 text-xs ${isDark ? "text-gray-700" : "text-gray-400"}`}>
              <span>⚠️ Educational only. Trade responsibly.</span>
              <a href="https://t.me/amirul_adnan_trader" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-500">@amirul_adnan_trader</a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatParticle { 0%,100%{transform:translateY(0) rotate(0) scale(1);opacity:.09} 33%{transform:translateY(-22px) rotate(120deg) scale(1.3);opacity:.20} 66%{transform:translateY(-10px) rotate(240deg) scale(.85);opacity:.13} }
        @keyframes scanLineFull { 0%{top:-2px;opacity:0} 4%{opacity:1} 96%{opacity:1} 100%{top:100%;opacity:0} }
        @keyframes shimmer { 0%{background-position:0% center} 100%{background-position:200% center} }
        .signal-enter { animation: slide-in-up 0.38s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes slide-in-up { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        *{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${themeColor}35;border-radius:2px}
      `}</style>
    </div>
  );
};

// ── Root with AuthProvider ────────────────────────────────────────────────────
const Index: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default Index;
