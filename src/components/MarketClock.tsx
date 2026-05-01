import React from "react";
import { useState, useEffect } from "react";
import { Clock, Globe, Activity, Wifi } from "lucide-react";
import { formatBDTime, formatBDDate, getBangladeshTime, getMarketSession, getSessionTimes } from "@/lib/marketUtils";

interface MarketClockProps {
  themeColor: string;
  isDark: boolean;
}

const MarketClock: React.FC<MarketClockProps> = ({ themeColor, isDark }) => {
  const [, setTick] = useState(0);
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setSession(getMarketSession());
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
          <div className="text-2xl font-black font-mono tracking-wider" style={{ color: themeColor, textShadow: isDark ? `0 0 20px ${themeColor}50` : "none" }}>
            {formatBDTime(bdTime)}
          </div>
          <div className={`text-[11px] ${ts} mt-0.5`}>{formatBDDate(bdTime)}</div>
        </div>

        {/* Current Session */}
        <div className="flex items-center justify-between p-3 rounded-xl border transition-all" style={{ borderColor: `${session.color}40`, background: `${session.color}10` }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: session.color, boxShadow: `0 0 8px ${session.color}` }} />
            <div>
              <p className={`text-[10px] ${ts}`}>ACTIVE SESSION</p>
              <p className="text-sm font-bold" style={{ color: session.color }}>{session.label}</p>
            </div>
          </div>
          <Activity size={16} style={{ color: session.color, opacity: 0.7 }} />
        </div>

        {/* All Sessions */}
        <div className="space-y-1">
          <p className={`text-[10px] ${ts} tracking-widest mb-1.5`}>SESSIONS (BDT)</p>
          {sessionTimes.map(s => {
            const isActive = session.label.toLowerCase().includes(s.session.toLowerCase());
            return (
              <div key={s.session} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${isActive ? "border-emerald-700/50 bg-emerald-950/20" : `${isDark ? "border-gray-800/30 bg-gray-900/10" : "border-gray-200 bg-gray-50"}`}`}>
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
