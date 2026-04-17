import React, { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, TrendingUp, X } from "lucide-react";

interface TradingViewChartProps {
  pair: string;
  themeColor: string;
  isDark: boolean;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({ pair, themeColor, isDark }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [currentPair, setCurrentPair] = useState(pair);

  // Convert our pair format to TradingView format
  const getTVSymbol = (p: string) => {
    const cleaned = p.replace("/", "");
    return `FX:${cleaned}`;
  };

  const buildWidget = (symbol: string) => {
    if (!widgetRef.current) return;
    widgetRef.current.innerHTML = "";
    setLoaded(false);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => setLoaded(true);
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: getTVSymbol(symbol),
      interval: "1",
      timezone: "Asia/Dhaka",
      theme: isDark ? "dark" : "light",
      style: "1",
      locale: "en",
      backgroundColor: isDark ? "#030b14" : "#ffffff",
      gridColor: isDark ? "rgba(0,255,136,0.05)" : "rgba(0,0,0,0.05)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: [
        "STD;Bollinger_Bands",
        "STD;RSI",
        "STD;MACD",
      ],
    });

    widgetRef.current.appendChild(script);
  };

  useEffect(() => {
    buildWidget(pair);
    setCurrentPair(pair);
  }, [pair, isDark]);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-500 ${isExpanded ? "fixed inset-4 z-[200]" : "relative"}`}
      style={{
        borderColor: `${themeColor}40`,
        background: isDark ? "#030b14" : "#ffffff",
        boxShadow: isExpanded ? `0 0 60px ${themeColor}30` : `0 0 20px ${themeColor}15`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: `${themeColor}25`, background: isDark ? `${themeColor}08` : `${themeColor}10` }}
      >
        <div className="flex items-center gap-2.5">
          <TrendingUp size={15} style={{ color: themeColor }} />
          <span className="text-sm font-bold" style={{ color: isDark ? "#e5e7eb" : "#1f2937" }}>
            Live Chart — {currentPair}
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10` }}
          >
            1 MIN
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            TradingView
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg border transition-all duration-150 hover:scale-105"
            style={{ borderColor: `${themeColor}30`, background: `${themeColor}10`, color: themeColor }}
            title={isExpanded ? "Collapse chart" : "Expand chart"}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-lg border border-red-700/40 bg-red-950/20 text-red-400 hover:bg-red-950/40 transition-all"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* TradingView Widget */}
      <div
        ref={containerRef}
        className="tradingview-widget-container relative"
        style={{ height: isExpanded ? "calc(100vh - 130px)" : "420px" }}
      >
        <div
          ref={widgetRef}
          className="tradingview-widget-container__widget w-full h-full"
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: isDark ? "#030b14" : "#f9fafb" }}>
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: `${themeColor}60`, borderTopColor: themeColor }}
              />
              <p className="text-xs" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>Loading chart...</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t flex items-center justify-between" style={{ borderColor: `${themeColor}15` }}>
        <span className="text-[10px]" style={{ color: isDark ? "#374151" : "#9ca3af" }}>
          Powered by TradingView • 1-Min candles • Bangladesh timezone
        </span>
        <span className="text-[10px]" style={{ color: isDark ? "#374151" : "#9ca3af" }}>
          RSI • MACD • Bollinger Bands overlaid
        </span>
      </div>
    </div>
  );
};

export default TradingViewChart;
