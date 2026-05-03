import React, { useState, useEffect, memo } from "react";
import { Clock, Globe, Activity, Wifi, TrendingUp, Target } from "lucide-react";
import { formatBDTime, formatBDDate, getBangladeshTime, getMarketSession, getSessionTimes } from "@/lib/marketUtils";

interface MarketClockProps {
  themeColor: string;
  isDark: boolean;
}

const SESSION_STRATEGIES: Record<string, { strategy: string; bestFor: string; icon: string }> = {
  "Sydney":   { strategy: "Mean-Reversion", bestFor: "RSI + BB Squeeze", icon: "🦘" },
  "Tokyo":    { strategy: "Range-Bound Oscillator", bestFor: "Stoch + RSI + BB", icon: "🗼" },
  "London":   { strategy: "Breakout Momentum", bestFor: "MACD + EMA + ADX", icon: "🏛️" },
  "New York": { strategy: "Volatility Breakout", bestFor: "BB + MACD + Volume", icon: "🗽" },
};

const MarketClock: React.FC<MarketClockProps> = memo(({ themeColor, isDark }) => {
  const [bdTime, setBdTime] = useState(getBangladeshTime());
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const interval = setInterval(() => {
      setBdTime(getBangladeshTime());
      setSession(getMarketSession());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sessionTimes = getSessionTimes();
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const border = isDark ? "border-gray-800/50" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const bgInner = isDark ? "from-gray-900/80 to-black/60" : "from-gray-50 to-white";

  // Active session name for lookup
  const activeSessionName = sessionTimes.find(s =>
    session.label.toLowerCase().includes(s.session.toLowerCase())
  )?.session;
  const sessionInfo = activeSessionName ? SESSION_STRATEGIES[activeSessionName] : null;

  return (
    <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
      <div className={`p-4 border-b ${border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={15} style={{ color: themeColor }} />
            <span className={`text-sm font-bold ${tb}`}>Market Clock</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400">
            <Wifi size={10} className="animate-pulse" />
            <span>LIVE</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Bangladesh Time */}
        <div className={`text-center p-3 rounded-xl bg-gradient-to-br ${bgInner} border ${border}`}>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Globe size={11} className={ts} />
            <span className={`text-[10px] ${ts} tracking-widest`}>BANGLADESH (BDT UTC+6)</span>
          </div>
          <div
            className="text-2xl font-black font-mono tracking-wider"
            style={{ color: themeColor, textShadow: isDark ? `0 0 20px ${themeColor}50` : "none" }}
          >
            {formatBDTime(bdTime)}
          </div>
          <div className={`text-[11px] ${ts} mt-0.5`}>{formatBDDate(bdTime)}</div>
        </div>

        {/* Current Session */}
        <div
          className="flex items-center justify-between p-3 rounded-xl border transition-colors"
          style={{ borderColor: `${session.color}40`, background: `${session.color}10` }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: session.color, boxShadow: `0 0 8px ${session.color}` }}
            />
            <div>
              <p className={`text-[10px] ${ts}`}>ACTIVE SESSION</p>
              <p className="text-sm font-bold" style={{ color: session.color }}>{session.label}</p>
            </div>
          </div>
          <Activity size={16} style={{ color: session.color, opacity: 0.7 }} />
        </div>

        {/* Session Strategy Info */}
        {sessionInfo && (
          <div
            className="p-2.5 rounded-xl border"
            style={{ borderColor: `${themeColor}25`, background: `${themeColor}06` }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={11} style={{ color: themeColor }} />
              <span className={`text-[9px] font-bold tracking-widest ${ts}`}>SESSION STRATEGY</span>
            </div>
            <p className="text-xs font-bold" style={{ color: themeColor }}>
              {sessionInfo.icon} {sessionInfo.strategy}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Target size={9} className={ts} />
              <p className={`text-[10px] ${ts}`}>{sessionInfo.bestFor}</p>
            </div>
          </div>
        )}

        {/* All Sessions */}
        <div className="space-y-1">
          <p className={`text-[10px] ${ts} tracking-widest mb-1.5`}>SESSIONS (BDT)</p>
          {sessionTimes.map(s => {
            const isActive = session.label.toLowerCase().includes(s.session.toLowerCase());
            const info = SESSION_STRATEGIES[s.session];
            return (
              <div
                key={s.session}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${
                  isActive
                    ? "border-emerald-700/50 bg-emerald-950/20"
                    : isDark ? "border-gray-800/30 bg-gray-900/10" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{info?.icon}</span>
                  <span className={`font-medium ${isActive ? "text-emerald-400" : ts}`}>{s.session}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="text-[9px] text-emerald-500 font-bold px-1.5 rounded-full bg-emerald-950/30 border border-emerald-800/40">
                      ACTIVE
                    </span>
                  )}
                  <span className={`font-mono text-[10px] ${isActive ? "text-emerald-500" : ts}`}>
                    {s.bdOpen}–{s.bdClose}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

MarketClock.displayName = "MarketClock";
export default MarketClock;
