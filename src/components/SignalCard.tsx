import React from "react";
import { Signal } from "@/types";
import { ArrowUp, ArrowDown, Zap, Shield, Target, Clock, Droplets, TrendingUp, Activity, Users } from "lucide-react";

interface SignalCardProps {
  signal: Signal;
  themeColor: string;
  isNew?: boolean;
  isDark: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, themeColor, isNew = false, isDark }) => {
  const isCall = signal.direction === "CALL";
  const dirColor = isCall ? "#00d084" : "#ff4466";
  const strengthColors: Record<string, string> = { STRONG: "#00d084", MODERATE: "#FFD700", WEAK: "#ff8c00" };
  const confidenceColor = signal.confidence >= 82 ? "#00d084" : signal.confidence >= 70 ? "#FFD700" : "#ff8c00";

  const cardBg = isDark
    ? `linear-gradient(145deg, ${dirColor}07 0%, #020810 60%, ${dirColor}04 100%)`
    : `linear-gradient(145deg, ${dirColor}06 0%, #ffffff 60%, ${dirColor}03 100%)`;

  const subBg = isDark ? "bg-gray-900/50 border-gray-800/30" : "bg-gray-50/80 border-gray-200";
  const tb = isDark ? "text-white" : "text-gray-900";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const tsm = isDark ? "text-gray-300" : "text-gray-600";

  const buyerStr = signal.buyerStrength ?? 50;
  const sellerStr = signal.sellerStrength ?? 50;
  const candlePwr = signal.candlePower ?? 0;
  const confirmScore = signal.confirmationScore ?? 0;

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all duration-500 ${isNew ? "ring-2 ring-offset-0" : ""}`}
      style={{
        borderColor: isNew ? `${dirColor}60` : `${dirColor}30`,
        background: cardBg,
        boxShadow: isNew ? `0 0 40px ${dirColor}25, 0 4px 24px ${dirColor}10` : `0 2px 16px ${dirColor}08`,
      }}
    >
      {/* New signal glow line */}
      {isNew && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${dirColor}, transparent)`,
            boxShadow: `0 0 12px ${dirColor}`,
            animation: "shimmer 1.5s ease-in-out infinite",
          }}
        />
      )}

      {isNew && (
        <div
          className="absolute top-2 right-2 text-[9px] font-black px-2.5 py-0.5 rounded-full animate-bounce z-10"
          style={{ background: dirColor, color: "#000", boxShadow: `0 0 10px ${dirColor}` }}
        >
          LIVE
        </div>
      )}

      {/* Main Header */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xl font-black ${tb}`}>{signal.pair}</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  color: strengthColors[signal.strength],
                  borderColor: `${strengthColors[signal.strength]}40`,
                  background: `${strengthColors[signal.strength]}10`
                }}
              >
                {signal.strength}
              </span>
              {signal.bosType && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                  style={{
                    color: signal.bosType === "BULLISH" ? "#00d084" : "#ff4466",
                    borderColor: signal.bosType === "BULLISH" ? "#00d08430" : "#ff446630",
                    background: signal.bosType === "BULLISH" ? "#00d08410" : "#ff446610"
                  }}
                >
                  BOS {signal.bosType === "BULLISH" ? "↑" : "↓"}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-3 text-[10px] ${ts}`}>
              <span className="flex items-center gap-1"><Clock size={9} />{signal.entryTime}</span>
              <span className="flex items-center gap-1"><Target size={9} />Expiry: {signal.expiryTime}</span>
            </div>
          </div>

          {/* Direction Badge */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 transition-all duration-300"
            style={{
              borderColor: dirColor,
              background: `${dirColor}12`,
              boxShadow: `0 0 24px ${dirColor}30, inset 0 0 12px ${dirColor}08`
            }}
          >
            {isCall
              ? <ArrowUp size={24} style={{ color: dirColor }} strokeWidth={3} />
              : <ArrowDown size={24} style={{ color: dirColor }} strokeWidth={3} />}
            <span className="text-xs font-black mt-0.5" style={{ color: dirColor }}>{signal.direction}</span>
          </div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[10px] ${ts} tracking-widest font-medium`}>SIGNAL ACCURACY</span>
          <span className="text-sm font-black" style={{ color: confidenceColor }}>{signal.confidence}%</span>
        </div>
        <div className={`h-2 ${isDark ? "bg-gray-900/80" : "bg-gray-100"} rounded-full overflow-hidden`}>
          <div
            className="h-full rounded-full transition-all duration-1200"
            style={{
              width: `${signal.confidence}%`,
              background: `linear-gradient(90deg, ${confidenceColor}50, ${confidenceColor})`,
              boxShadow: `0 0 10px ${confidenceColor}40`
            }}
          />
        </div>
      </div>

      {/* Buyer/Seller + Candle Power Row */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2">
        {/* Buyer Strength */}
        <div className={`p-2 rounded-lg border ${subBg}`}>
          <div className="flex items-center gap-1 mb-1">
            <Users size={9} className="text-emerald-500" />
            <span className={`text-[9px] ${ts}`}>BUYERS</span>
          </div>
          <div className="h-1 bg-gray-800/50 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${buyerStr}%` }} />
          </div>
          <p className="text-xs font-bold text-emerald-400">{buyerStr}%</p>
        </div>

        {/* Candle Power */}
        <div className={`p-2 rounded-lg border ${subBg}`}>
          <div className="flex items-center gap-1 mb-1">
            <Activity size={9} style={{ color: dirColor }} />
            <span className={`text-[9px] ${ts}`}>POWER</span>
          </div>
          <div className="h-1 bg-gray-800/50 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full transition-all" style={{ width: `${candlePwr}%`, background: dirColor }} />
          </div>
          <p className="text-xs font-bold" style={{ color: dirColor }}>{candlePwr}%</p>
        </div>

        {/* Seller Strength */}
        <div className={`p-2 rounded-lg border ${subBg}`}>
          <div className="flex items-center gap-1 mb-1">
            <Users size={9} className="text-red-500" />
            <span className={`text-[9px] ${ts}`}>SELLERS</span>
          </div>
          <div className="h-1 bg-gray-800/50 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${sellerStr}%` }} />
          </div>
          <p className="text-xs font-bold text-red-400">{sellerStr}%</p>
        </div>
      </div>

      {/* Market Zone + Confirmation */}
      {(signal.marketZone || confirmScore > 0) && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          {signal.marketZone && (
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border"
              style={{ borderColor: `${dirColor}25`, background: `${dirColor}06` }}
            >
              <Target size={10} style={{ color: dirColor }} />
              <span className="text-[10px] font-medium truncate" style={{ color: dirColor }}>{signal.marketZone}</span>
            </div>
          )}
          {confirmScore > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border"
              style={{ borderColor: `${confirmScore >= 70 ? "#00d084" : "#FFD700"}25`, background: `${confirmScore >= 70 ? "#00d084" : "#FFD700"}06` }}
            >
              <Shield size={10} style={{ color: confirmScore >= 70 ? "#00d084" : "#FFD700" }} />
              <span className="text-[10px] font-medium" style={{ color: confirmScore >= 70 ? "#00d084" : "#FFD700" }}>
                Confirm {confirmScore}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Liquidity Info */}
      {signal.liquidityType && signal.liquidityType !== "None" && (
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs"
            style={{ borderColor: `${dirColor}25`, background: `${dirColor}07` }}
          >
            <Droplets size={10} style={{ color: dirColor }} />
            <span className="font-medium" style={{ color: dirColor }}>{signal.liquidityType}</span>
          </div>
        </div>
      )}

      {/* Indicators Grid */}
      <div className="px-4 pb-3">
        <p className={`text-[9px] ${ts} tracking-widest mb-2`}>INDICATOR SIGNALS</p>
        <div className="grid grid-cols-2 gap-1.5">
          {signal.indicators.slice(0, 10).map(ind => (
            <div
              key={ind.name}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${subBg} transition-all duration-200`}
            >
              <span className={`text-[10px] ${ts} truncate max-w-[80px]`}>{ind.name}</span>
              <span
                className="text-[10px] font-bold ml-1 flex-shrink-0"
                style={{
                  color: ind.signal === "BUY" ? "#00d084" : ind.signal === "SELL" ? "#ff4466" : isDark ? "#6b7280" : "#9ca3af"
                }}
              >
                {ind.signal === "BUY" ? "▲ BUY" : ind.signal === "SELL" ? "▼ SELL" : "— WAIT"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2">
        <div className={`text-center p-2 rounded-lg border ${subBg}`}>
          <p className={`text-[9px] ${ts}`}>PATTERN</p>
          <p className={`text-[10px] ${tsm} font-medium truncate`} title={signal.pattern.split("•")[0].trim()}>
            {signal.pattern.split("•")[0].trim()}
          </p>
        </div>
        <div className={`text-center p-2 rounded-lg border ${subBg}`}>
          <p className={`text-[9px] ${ts}`}>RSI</p>
          <p className="text-[10px] font-bold" style={{
            color: signal.rsi < 35 ? "#00d084" : signal.rsi > 65 ? "#ff4466" : isDark ? "#9ca3af" : "#6b7280"
          }}>
            {signal.rsi}
          </p>
        </div>
        <div className={`text-center p-2 rounded-lg border ${subBg}`}>
          <p className={`text-[9px] ${ts}`}>TREND</p>
          <p className="text-[10px] font-bold" style={{
            color: signal.trend === "UPTREND" ? "#00d084" : signal.trend === "DOWNTREND" ? "#ff4466" : isDark ? "#6b7280" : "#9ca3af"
          }}>
            {signal.trend === "UPTREND" ? "UP ↑" : signal.trend === "DOWNTREND" ? "DOWN ↓" : "FLAT →"}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 flex items-center justify-between border-t"
        style={{ borderColor: `${dirColor}15`, background: `${dirColor}04` }}
      >
        <div className="flex items-center gap-1.5">
          <Shield size={10} style={{ color: dirColor }} />
          <span className={`text-[10px] ${ts} truncate max-w-[140px]`}>{signal.sessionName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={10} style={{ color: dirColor }} />
          <span className="text-[10px] font-bold" style={{ color: dirColor }}>1 MIN BINARY</span>
        </div>
      </div>
    </div>
  );
};

export default SignalCard;
