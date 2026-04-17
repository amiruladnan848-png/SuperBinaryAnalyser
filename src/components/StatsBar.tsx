import React, { useState, useEffect } from "react";
import { TrendingUp, BarChart2, Zap, Shield, Target, Activity, Brain, Layers } from "lucide-react";

interface StatsBarProps {
  signalCount: number;
  selectedPairs: number;
  themeColor: string;
  isRunning: boolean;
  isDark: boolean;
  winRate?: number;
}

const StatsBar: React.FC<StatsBarProps> = ({ signalCount, selectedPairs, themeColor, isRunning, isDark, winRate = 85 }) => {
  const [animatedCount, setAnimatedCount] = useState(0);

  useEffect(() => {
    if (signalCount === 0) { setAnimatedCount(0); return; }
    const step = Math.ceil(signalCount / 20);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, signalCount);
      setAnimatedCount(current);
      if (current >= signalCount) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [signalCount]);

  const stats = [
    { icon: BarChart2, label: "Signals Today", value: animatedCount.toString(), color: themeColor },
    { icon: TrendingUp, label: "Active Pairs", value: selectedPairs.toString(), color: "#00d4ff" },
    { icon: Zap, label: "Engine", value: isRunning ? "LIVE" : "IDLE", color: isRunning ? "#00ff88" : isDark ? "#6b7280" : "#9ca3af" },
    { icon: Shield, label: "Target Win", value: `${winRate}%+`, color: "#FFD700" },
    { icon: Brain, label: "Indicators", value: "12 Active", color: "#a855f7" },
    { icon: Layers, label: "Logic", value: "PA + Zone", color: "#f97316" },
  ];

  const border = isDark ? "border-gray-800/40" : "border-gray-200";
  const bg = isDark ? "bg-black/40" : "bg-white/70";

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {stats.map(({ icon: Icon, label, value, color }, idx) => (
        <div
          key={label}
          className={`group flex items-center gap-2 p-3 rounded-xl border ${border} ${bg} backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg cursor-default`}
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
            style={{
              background: `${color}12`,
              border: `1px solid ${color}30`,
              boxShadow: `0 0 10px ${color}10`,
            }}
          >
            <Icon size={14} style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className={`text-[9px] ${isDark ? "text-gray-600" : "text-gray-400"} truncate leading-tight`}>{label}</p>
            <p
              className="text-xs font-black leading-tight transition-all duration-300"
              style={{
                color,
                textShadow: isDark && value === "LIVE" ? `0 0 8px ${color}` : "none",
              }}
            >
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
