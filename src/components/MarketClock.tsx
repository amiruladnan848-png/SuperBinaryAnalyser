import React, { useState, useEffect } from "react";
import { Clock, Globe, Activity, Wifi, Lock } from "lucide-react";
import { formatBDTime, formatBDDate, getBangladeshTime, getMarketSession, getSessionTimes, isWeekend } from "@/lib/marketUtils";

interface MarketClockProps {
  themeColor: string;
  isDark: boolean;
}

const MarketClock: React.FC<MarketClockProps> = ({ themeColor, isDark }) => {
  const [, setTick] = useState(0);
  const [session, setSession] = useState(getMarketSession());
  const [weekend, setWeekend] = useState(isWeekend());

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setSession(getMarketSession());
      setWeekend(isWeekend());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const bdTime = getBangladeshTime();
  const sessionTimes = getSessionTimes();
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const border = isDark ? "border-gray-800/50" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const bgInner = isDark ? "from-gray-900/80 to-black/60" : "from-gray-50 to-white";

  return (
    <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
      <div className={`p-4 border-b ${border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} style={{ color: themeColor }} />
            <span className={`text-sm font-bold ${tb}`}>Market Clock</span>
          </div>
          {weekend ? (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/25 border border-amber-700/40 rounded-full px-2 py-0.5">
              <Lock size={9} />
              <span>WEEKEND LOCK</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Wifi size={10} className="animate-pulse" />
              <span>LIVE</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Bangladesh Time */}
        <div className={`text-center p-3 rounded-xl bg-gradient-to-br ${bgInner} border ${border}`}>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Globe size={12} className={ts} />
            <span className={`text-[10px] ${ts} tracking-widest`}>BANGLADESH (BDT UTC+6)</span>
          </div>
          <div
            className="text-2xl font-black font-mono tracking-wider"
            style={{ color: themeColor, textShadow: isDark ? `0 0 20px ${themeColor}50` : "none" }}
          >
            {formatBDTime(bdTime)}
          </div>
          <div className={`text-[11px] ${ts} mt-1`}>{formatBDDate(bdTime)}</div>
        </div>

        {/* Current Session */}
        <div
          className="flex items-center justify-between p-3 rounded-xl border transition-all duration-500"
          style={{ borderColor: `${session.color}40`, background: `${session.color}10` }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: session.color, boxShadow: `0 0 8px ${session.color}` }}
            />
            <div>
              <p className={`text-[10px] ${ts}`}>{weekend ? "WEEKEND SESSION" : "ACTIVE SESSION"}</p>
              <p className="text-sm font-bold" style={{ color: session.color }}>{session.label}</p>
            </div>
          </div>
          <Activity size={18} style={{ color: session.color, opacity: 0.7 }} />
        </div>

        {/* Weekend Lock Notice */}
        {weekend && (
          <div
            className="p-3 rounded-xl border text-xs space-y-2"
            style={{ borderColor: "#F59E0B40", background: "#F59E0B08" }}
          >
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Lock size={11} />
              <span>Auto Signal Engine Locked</span>
            </div>
            <p className={ts}>
              Forex markets are closed on weekends. Use the <span className="text-cyan-400 font-medium">📷 Chart Analyser</span> tab for screenshot-based signals.
            </p>
          </div>
        )}

        {/* All Sessions */}
        <div className="space-y-1.5">
          <p className={`text-[10px] ${ts} tracking-widest mb-2`}>SESSIONS (BDT)</p>
          {sessionTimes.map(s => {
            const isActive = !weekend && session.label.toLowerCase().includes(s.session.toLowerCase());
            return (
              <div
                key={s.session}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all duration-300 ${isActive ? "border-emerald-700/50 bg-emerald-950/20" : `${isDark ? "border-gray-800/30 bg-gray-900/10" : "border-gray-200 bg-gray-50"}`}`}
              >
                <span className={`font-medium ${isActive ? "text-emerald-400" : ts}`}>{s.session}</span>
                <span className={`font-mono text-[10px] ${isActive ? "text-emerald-500" : ts}`}>{s.bdOpen} – {s.bdClose}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MarketClock;
