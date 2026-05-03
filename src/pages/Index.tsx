import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { AuthProvider, useAuth } from "@/lib/auth.tsx";
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
import { Lock, AlertTriangle, Info, CheckCircle, X, Bell } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "danger";
  is_active: boolean;
  created_at: string;
}

// ── Announcement Banner ───────────────────────────────────────────────────────
const ANN_CONFIG = {
  info:    { color: "#00d4ff", bg: "#00d4ff14", border: "#00d4ff38", Icon: Info },
  warning: { color: "#FFD700", bg: "#FFD70014", border: "#FFD70038", Icon: AlertTriangle },
  success: { color: "#00ff88", bg: "#00ff8814", border: "#00ff8838", Icon: CheckCircle },
  danger:  { color: "#ff4466", bg: "#ff446614", border: "#ff446638", Icon: AlertTriangle },
};

const AnnouncementBanner = memo<{ ann: Announcement; isDark: boolean; onDismiss: (id: string) => void }>(
  ({ ann, isDark, onDismiss }) => {
    const cfg = ANN_CONFIG[ann.type] || ANN_CONFIG.info;
    const { Icon } = cfg;
    return (
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl border ann-enter"
        style={{ background: cfg.bg, borderColor: cfg.border, boxShadow: `0 2px 16px ${cfg.color}12` }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.border}` }}>
          <Icon size={14} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: cfg.color }}>{ann.title}</p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{ann.message}</p>
        </div>
        <button
          onClick={() => onDismiss(ann.id)}
          className={`flex-shrink-0 p-1 rounded-lg transition-colors ${isDark ? "text-gray-600 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"}`}
        >
          <X size={13} />
        </button>
      </div>
    );
  }
);
AnnouncementBanner.displayName = "AnnouncementBanner";

// ── Weekend Lock ──────────────────────────────────────────────────────────────
const WeekendLockScreen = memo<{ isDark: boolean; themeColor: string }>(({ isDark, themeColor }) => (
  <div className={`flex flex-col items-center justify-center py-20 text-center rounded-2xl border ${isDark ? "border-gray-800/50 bg-black/40" : "border-gray-200 bg-white/60"} backdrop-blur-xl`}>
    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border" style={{ background: "#ff446614", borderColor: "#ff446638" }}>
      <Lock size={36} className="text-red-400" />
    </div>
    <h2 className={`text-2xl font-black mb-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>Real Market Closed</h2>
    <p className={`text-sm max-w-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
      Signal engine is <span className="text-red-400 font-bold">LOCKED</span> on weekends (Sat &amp; Sun).
      <br />Real forex market is closed. Return on{" "}
      <span className="font-bold" style={{ color: themeColor }}>Monday</span>.
    </p>
    <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-full border border-amber-700/40 bg-amber-950/20">
      <AlertTriangle size={12} className="text-amber-400" />
      <span className="text-xs text-amber-400 font-medium">Weekend — Market Off • Come Back Monday</span>
    </div>
  </div>
));
WeekendLockScreen.displayName = "WeekendLockScreen";

// ── Theme config ──────────────────────────────────────────────────────────────
const THEME_CONFIG: Record<AppTheme, { color: string; dark: boolean }> = {
  emerald: { color: "#00ff88", dark: true },
  gold:    { color: "#FFD700", dark: true },
  cyber:   { color: "#00d4ff", dark: true },
  ocean:   { color: "#0080ff", dark: true },
  ruby:    { color: "#ff3366", dark: true },
  violet:  { color: "#a855f7", dark: true },
  light:   { color: "#2563eb", dark: false },
  rose:    { color: "#e11d48", dark: false },
};

const STORAGE_KEYS = { selectedPairs: "sba_pairs", theme: "sba_theme", sound: "sba_sound" };
const DEFAULT_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "EUR/JPY"];

// ── Particles (static, computed once) ────────────────────────────────────────
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i, x: Math.random() * 100, y: Math.random() * 100,
  size: 1 + Math.random() * 1.5, delay: Math.random() * 10, dur: 8 + Math.random() * 8,
}));

// ── App inner ─────────────────────────────────────────────────────────────────
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("emerald");
  const [isDark, setIsDark] = useState(true);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [chartPair, setChartPair] = useState("EUR/USD");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [signalCount, setSignalCount] = useState(0);
  const [ownerBgLoaded, setOwnerBgLoaded] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [signalLimit, setSignalLimit] = useState(10);
  const [signalsUsed, setSignalsUsed] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const themeColor = useMemo(() => THEME_CONFIG[theme]?.color || "#00ff88", [theme]);

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
    setWeekend(isWeekend());
    setMounted(true);
    const t = setInterval(() => setWeekend(isWeekend()), 60000);
    return () => clearInterval(t);
  }, []);

  // Fetch user access
  useEffect(() => {
    if (!user) return;
    if (user.isAdmin) { setIsAllowed(true); setSignalLimit(999); setSignalsUsed(0); return; }
    const run = async () => {
      const { data } = await supabase
        .from("user_access").select("is_allowed,signal_limit,signals_used_today,last_reset_date")
        .eq("user_id", user.id).maybeSingle();
      if (data) {
        const today = new Date().toISOString().split("T")[0];
        let used = data.signals_used_today;
        if (data.last_reset_date !== today) {
          await supabase.from("user_access").update({ signals_used_today: 0, last_reset_date: today }).eq("user_id", user.id);
          used = 0;
        }
        setIsAllowed(data.is_allowed); setSignalLimit(data.signal_limit); setSignalsUsed(used);
      } else {
        await supabase.from("user_access").insert({ user_id: user.id, is_allowed: false, signal_limit: 10, signals_used_today: 0 });
        setIsAllowed(false); setSignalLimit(10); setSignalsUsed(0);
      }
    };
    run();
  }, [user]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  }, [user]);

  useEffect(() => {
    fetchAnnouncements();
    const t = setInterval(fetchAnnouncements, 30000);
    return () => clearInterval(t);
  }, [fetchAnnouncements]);

  const handleDismiss = useCallback((id: string) => setDismissedIds(prev => new Set(prev).add(id)), []);

  const handleTheme = useCallback((t: AppTheme) => {
    setTheme(t);
    setIsDark(THEME_CONFIG[t]?.dark ?? true);
    localStorage.setItem(STORAGE_KEYS.theme, t);
  }, []);

  const handleToggleDark = useCallback(() => handleTheme(isDark ? "light" : "emerald"), [isDark, handleTheme]);

  const handleTogglePair = useCallback((symbol: string) => {
    setSelectedPairs(prev => {
      const next = prev.includes(symbol) ? prev.filter(p => p !== symbol) : [...prev, symbol];
      localStorage.setItem(STORAGE_KEYS.selectedPairs, JSON.stringify(next));
      if (!prev.includes(symbol)) setChartPair(symbol);
      return next;
    });
  }, []);

  const handleSignalGenerated = useCallback((count: number) => setSignalCount(prev => prev + count), []);

  const handleSignalsUsed = useCallback(async (n: number) => {
    setSignalsUsed(n);
    if (user && !user.isAdmin) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("user_access").update({ signals_used_today: n, last_reset_date: today }).eq("user_id", user.id);
    }
  }, [user]);

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled(prev => { localStorage.setItem(STORAGE_KEYS.sound, String(!prev)); return !prev; });
  }, []);

  const handleAdminToggle = useCallback(() => setShowAdmin(p => !p), []);

  const visibleAnnouncements = useMemo(
    () => announcements.filter(a => !dismissedIds.has(a.id)),
    [announcements, dismissedIds]
  );

  if (!mounted || loading) return (
    <div className="min-h-screen bg-[#020c15] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#00ff8860", borderTopColor: "#00ff88" }} />
        <p className="text-gray-600 text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  );

  if (!user) return <AuthPage onAuthSuccess={() => {}} />;

  return (
    <div
      className={`min-h-screen relative overflow-x-hidden ${isDark ? "bg-[#020c15]" : "bg-gray-50"}`}
      style={{ color: isDark ? "#e5e7eb" : "#1f2937" }}
    >
      {/* ── Background ───────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute inset-0" style={{ opacity: ownerBgLoaded ? 1 : 0, transition: "opacity 1s" }}>
              <div className="absolute top-0 right-0 bottom-0"
                style={{ width: "44%", backgroundImage: `url(${ownerPhoto})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.07, filter: "blur(14px) saturate(2)" }} />
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(135deg, #020c15 0%, #020c15ee 42%, #020c15a0 66%, #020c1530 100%)" }} />
            </div>
            <img src={ownerPhoto} alt="" className="hidden" onLoad={() => setOwnerBgLoaded(true)} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 50% at 20% 0%, ${themeColor}09 0%, transparent 65%)` }} />
            <div className="absolute inset-0 opacity-[0.015]"
              style={{ backgroundImage: `linear-gradient(${themeColor} 1px, transparent 1px), linear-gradient(90deg, ${themeColor} 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
            <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full blur-[150px] opacity-[0.035]" style={{ background: themeColor }} />
            {PARTICLES.map(p => (
              <div key={p.id} className="absolute rounded-full"
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, background: themeColor, opacity: 0.08, animation: `floatP ${p.dur}s ease-in-out infinite`, animationDelay: `${p.delay}s` }} />
            ))}
            <div className="absolute left-0 right-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent 0%, ${themeColor}20 30%, ${themeColor}45 50%, ${themeColor}20 70%, transparent 100%)`, animation: "scanLine 18s linear infinite" }} />
          </>
        ) : (
          <>
            <div className="absolute right-0 top-0 bottom-0"
              style={{ width: "32%", backgroundImage: `url(${ownerPhoto})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: ownerBgLoaded ? 0.04 : 0, filter: "blur(22px)", transition: "opacity 1s" }} />
            <img src={ownerPhoto} alt="" className="hidden" onLoad={() => setOwnerBgLoaded(true)} />
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50/15" />
          </>
        )}
      </div>

      <Header
        theme={theme} onThemeChange={handleTheme}
        isDark={isDark} onToggleDark={handleToggleDark}
        showAdmin={user.isAdmin} onAdminToggle={handleAdminToggle}
        isAdminOpen={showAdmin} user={user}
      />

      <div className="relative z-10 max-w-[1800px] mx-auto px-4 py-5 space-y-4">

        {/* Announcements */}
        {visibleAnnouncements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell size={11} className="text-yellow-400 animate-pulse" />
              <span className={`text-[10px] font-bold tracking-widest ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                BROADCAST ({visibleAnnouncements.length})
              </span>
            </div>
            {visibleAnnouncements.map(ann => (
              <AnnouncementBanner key={ann.id} ann={ann} isDark={isDark} onDismiss={handleDismiss} />
            ))}
          </div>
        )}

        {/* Admin Panel */}
        {user.isAdmin && showAdmin && (
          <div className="rounded-2xl border overflow-hidden"
            style={{ borderColor: `${themeColor}28`, background: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.92)" }}>
            <div className="p-5">
              <AdminPanel themeColor={themeColor} isDark={isDark} />
            </div>
          </div>
        )}

        {/* Hero Banner */}
        <div
          className="relative rounded-2xl overflow-hidden border"
          style={{ borderColor: `${themeColor}28`, boxShadow: `0 0 50px ${themeColor}0c` }}
        >
          <img src={heroBanner} alt="Super Binary Analyser"
            className="w-full h-36 sm:h-48 object-cover"
            style={{ opacity: isDark ? 0.34 : 0.28 }} />
          <div className="absolute right-0 top-0 bottom-0 w-48 sm:w-72 overflow-hidden">
            <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top"
              style={{ opacity: isDark ? 0.19 : 0.12, filter: "blur(0.5px)" }} />
            <div className="absolute inset-0"
              style={{ background: `linear-gradient(90deg, ${isDark ? "#020c15" : "#fff"} 0%, ${isDark ? "#020c15bb" : "#ffffffbb"} 30%, transparent 80%)` }} />
          </div>
          <div className="absolute inset-0"
            style={{ background: isDark
              ? "linear-gradient(90deg, #020c15 0%, #020c15bb 55%, transparent 100%)"
              : "linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 55%, transparent 100%)" }} />
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${themeColor}75, transparent)` }} />
          <div className="absolute inset-0 flex items-center px-6 sm:px-8">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-4xl font-black tracking-wide leading-tight"
                style={{ background: `linear-gradient(90deg, ${themeColor}, ${isDark ? "#ffffff" : "#1f2937"}, ${themeColor})`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s linear infinite" }}>
                SUPER-BINARY-ANALYSER
              </h2>
              <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                19 Indicators · Session-Adaptive Engine · BB Primary · All Sessions · 2026
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden border-2 flex-shrink-0"
                    style={{ borderColor: themeColor, boxShadow: `0 0 10px ${themeColor}45` }}>
                    <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
                  </div>
                  <span className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {user.isAdmin ? "👑 Admin" : `@${user.username}`}
                  </span>
                </div>
                <a href="https://t.me/amirul_adnan_trader" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  📱 @amirul_adnan_trader
                </a>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full border"
                  style={{ color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10` }}>
                  ⚡ SESSION-ADAPTIVE
                </span>
                {weekend && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-700/40 bg-red-950/20 text-red-400">
                    🔒 Weekend Lock
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
            style={{ borderColor: `${themeColor}28`, background: isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.9)" }}>
            <div className="w-2 h-2 rounded-full animate-ping" style={{ background: weekend ? "#ff4466" : themeColor }} />
            <span className="text-[10px] font-black" style={{ color: weekend ? "#ff4466" : themeColor }}>
              {weekend ? "WEEKEND LOCKED" : "SIGNAL READY"}
            </span>
          </div>
        </div>

        {/* Stats */}
        <StatsBar
          signalCount={signalCount} selectedPairs={selectedPairs.length}
          themeColor={themeColor} isRunning={false} isDark={isDark}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[290px,1fr] gap-4">
          <div className="space-y-4">
            <MarketClock themeColor={themeColor} isDark={isDark} />
            <PairSelector selectedPairs={selectedPairs} onTogglePair={handleTogglePair} themeColor={themeColor} isDark={isDark} />
          </div>

          <div className="space-y-4">
            <TradingViewChart pair={chartPair} themeColor={themeColor} isDark={isDark} />

            {selectedPairs.length > 1 && (
              <div className="flex gap-2 flex-wrap items-center">
                <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Chart:</span>
                {selectedPairs.map(p => (
                  <button key={p} onClick={() => setChartPair(p)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors active:scale-95"
                    style={chartPair === p
                      ? { background: `${themeColor}1e`, color: themeColor, borderColor: `${themeColor}48`, boxShadow: `0 0 8px ${themeColor}20` }
                      : { background: isDark ? "#0a0a0a" : "#f9fafb", color: isDark ? "#9ca3af" : "#6b7280", borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {weekend ? (
              <WeekendLockScreen isDark={isDark} themeColor={themeColor} />
            ) : (
              <ManualSignalPanel
                selectedPairs={selectedPairs} themeColor={themeColor} isDark={isDark}
                onSignalGenerated={handleSignalGenerated} onPairChange={setChartPair}
                soundEnabled={soundEnabled} onSoundToggle={handleSoundToggle}
                signalLimit={signalLimit} signalsUsed={signalsUsed} onSignalsUsed={handleSignalsUsed}
                isAllowed={isAllowed}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t pt-4 pb-3 ${isDark ? "border-gray-800/30" : "border-gray-200"}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: `${themeColor}45` }}>
                <img src={ownerPhoto} alt="" className="w-full h-full object-cover object-top" />
              </div>
              <span className={`text-xs ${isDark ? "text-gray-700" : "text-gray-400"}`}>
                © 2026 Super-Binary-Analyser · Amirul_Adnan · v8.0 Session-Adaptive
              </span>
            </div>
            <div className={`flex items-center gap-4 text-xs ${isDark ? "text-gray-700" : "text-gray-400"}`}>
              <span>⚠️ Educational only. Trade responsibly.</span>
              <a href="https://t.me/amirul_adnan_trader" target="_blank" rel="noopener noreferrer"
                className="text-cyan-600 hover:text-cyan-500 transition-colors">@amirul_adnan_trader</a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatP { 0%,100%{transform:translateY(0) scale(1);opacity:.07} 50%{transform:translateY(-16px) scale(1.15);opacity:.16} }
        @keyframes scanLine { 0%{top:-2px;opacity:0} 6%{opacity:1} 94%{opacity:1} 100%{top:100%;opacity:0} }
        @keyframes shimmer { 0%{background-position:0% center} 100%{background-position:200% center} }
        .signal-enter { animation: signalIn 0.30s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes signalIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .ann-enter { animation: annIn 0.30s ease-out both; }
        @keyframes annIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        *{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${themeColor}30;border-radius:2px}
      `}</style>
    </div>
  );
};

const Index: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default Index;
