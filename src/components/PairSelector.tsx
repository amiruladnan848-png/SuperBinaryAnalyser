import React, { useState } from "react";
import { Search, ChevronDown, Star, TrendingUp, CheckSquare } from "lucide-react";
import { FOREX_PAIRS } from "@/constants/pairs";

interface PairSelectorProps {
  selectedPairs: string[];
  onTogglePair: (symbol: string) => void;
  themeColor: string;
  isDark: boolean;
}

const PairSelector: React.FC<PairSelectorProps> = ({ selectedPairs, onTogglePair, themeColor, isDark }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"popular" | "all" | "selected">("popular");
  const [expanded, setExpanded] = useState(true);

  const filtered = FOREX_PAIRS.filter(p => {
    const matchSearch = p.symbol.toLowerCase().includes(search.toLowerCase()) ||
      p.label.toLowerCase().includes(search.toLowerCase());
    if (filter === "popular") return p.popular && matchSearch;
    if (filter === "selected") return selectedPairs.includes(p.symbol) && matchSearch;
    return matchSearch;
  });

  const border = isDark ? "border-gray-800/50" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const inputBg = isDark ? "bg-gray-900/50 border-gray-700/40 text-gray-300" : "bg-gray-50 border-gray-300 text-gray-700";

  const filterTabs = [
    { key: "popular", label: "Popular" },
    { key: "all", label: `All (${FOREX_PAIRS.length})` },
    { key: "selected", label: `✓ ${selectedPairs.length}` },
  ];

  return (
    <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full p-4 flex items-center justify-between transition-colors ${isDark ? "hover:bg-gray-900/20" : "hover:bg-gray-50"}`}
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} style={{ color: themeColor }} />
          <span className={`text-sm font-bold ${tb}`}>Pair Selector</span>
          <span
            className="text-xs font-bold rounded-full px-2 py-0.5"
            style={{ background: `${themeColor}20`, color: themeColor, border: `1px solid ${themeColor}40` }}
          >
            {selectedPairs.length}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={ts}
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        />
      </button>

      {expanded && (
        <div className={`px-4 pb-4 space-y-3 border-t ${border}`}>
          <div className="relative pt-3">
            <Search size={13} className={`absolute left-3 top-1/2 translate-y-[5px] ${ts}`} />
            <input
              type="text"
              placeholder="Search pairs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full ${inputBg} border rounded-lg pl-8 pr-3 py-2 text-xs placeholder-gray-500 focus:outline-none transition-all`}
            />
          </div>

          <div className="flex gap-1.5">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-150 border"
                style={filter === tab.key
                  ? { background: `${themeColor}20`, color: themeColor, borderColor: `${themeColor}40` }
                  : { background: "transparent", color: isDark ? "#6b7280" : "#9ca3af", borderColor: isDark ? "#374151" : "#e5e7eb" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick select all popular */}
          <button
            onClick={() => {
              const popularSymbols = FOREX_PAIRS.filter(p => p.popular).map(p => p.symbol);
              popularSymbols.forEach(s => {
                if (!selectedPairs.includes(s)) onTogglePair(s);
              });
            }}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${isDark ? "border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600/50" : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >
            <CheckSquare size={10} />
            Select All Popular Pairs
          </button>

          <div
            className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {filtered.map(pair => {
              const isSelected = selectedPairs.includes(pair.symbol);
              return (
                <button
                  key={pair.symbol}
                  onClick={() => onTogglePair(pair.symbol)}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg border text-xs transition-all duration-150 active:scale-95 group"
                  title={pair.label}
                  style={isSelected
                    ? { background: `${themeColor}15`, borderColor: `${themeColor}50`, color: themeColor, boxShadow: `0 0 8px ${themeColor}15` }
                    : { background: isDark ? "#0a0a0a" : "#f9fafb", borderColor: isDark ? "#1f2937" : "#e5e7eb", color: isDark ? "#9ca3af" : "#6b7280" }}
                >
                  <span className="font-bold text-[11px]">{pair.symbol}</span>
                  {pair.popular && (
                    <Star size={8} fill="currentColor" className={isSelected ? "opacity-80" : "opacity-25 group-hover:opacity-50"} />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className={`col-span-2 text-center py-4 text-xs ${ts}`}>No pairs found</div>
            )}
          </div>

          {selectedPairs.length === 0 && (
            <p className="text-xs text-amber-500/70 text-center">Select at least one pair</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PairSelector;
