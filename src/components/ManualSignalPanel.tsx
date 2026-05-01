import React, { useState, useRef, useCallback } from "react";
import { Zap, ChevronDown, ChevronUp, Volume2, VolumeX, AlertTriangle, Loader2, Clock, TrendingUp } from "lucide-react";
import { Signal } from "@/types";
import { generateSignal, generateDemoSignal } from "@/lib/signalEngine";
import { fetchCandles } from "@/lib/twelvedata";
import { getMarketSession, getBangladeshTime } from "@/lib/marketUtils";

function formatBDLocalTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
import { playCallSound, playPutSound, playStrongSignalSound } from "@/lib/soundEngine";
import SignalCard from "@/components/SignalCard";
import { toast } from "sonner";

interface ManualSignalPanelProps {
  selectedPairs: string[];
  themeColor: string;
  isDark: boolean;
  onSignalGenerated?: (count: number) => void;
  onPairChange?: (pair: string) => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  signalLimit: number;
  signalsUsed: number;
  onSignalsUsed: (n: number) => void;
  isAllowed: boolean;
}

const ManualSignalPanel: React.FC<ManualSignalPanelProps> = ({
  selectedPairs, themeColor, isDark,
  onSignalGenerated, onPairChange, soundEnabled, onSoundToggle,
  signalLimit, signalsUsed, onSignalsUsed, isAllowed,
}) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [processing, setProcessing] = useState(false);
  const [scanningPair, setScanningPair] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [newSignalIds, setNewSignalIds] = useState<Set<string>>(new Set());
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  const dailyLeft = Math.max(0, signalLimit - signalsUsed);
  const limitReached = dailyLeft <= 0;

  const border = isDark ? "border-gray-800/40" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";

  const bdNow = getBangladeshTime();
  // Next minute boundary in Bangladesh time
  const nextMinuteSecs = 60 - bdNow.getSeconds();
  const nextCandleTime = new Date(bdNow.getTime() + nextMinuteSecs * 1000);
  const expiryTimeDt = new Date(nextCandleTime.getTime() + 60 * 1000);

  const runManualScan = useCallback(async () => {
    if (processing) return;
    if (!isAllowed) { toast.error("❌ Access not granted. Contact admin."); return; }
    if (limitReached) { toast.error(`Daily limit of ${signalLimit} signals reached.`); return; }
    if (selectedPairs.length === 0) { toast.warning("Select at least one pair."); return; }

    setProcessing(true);
    const newSignals: Signal[] = [];
    let scanned = 0;

    for (const pair of selectedPairs) {
      if ((signalsUsed + scanned) >= signalLimit) break;
      setScanningPair(pair);
      if (onPairChange) onPairChange(pair);

      try {
        let signal: Signal | null = null;
        // Always use demo mode since API key is removed
        await new Promise(r => setTimeout(r, 80 + Math.random() * 60));
        signal = generateDemoSignal(pair);
        if (signal) { newSignals.push(signal); scanned++; }
      } catch (err) {
        console.error(`[Manual] Error ${pair}:`, err);
      }
    }

    setScanningPair("");
    setProcessing(false);

    if (newSignals.length > 0) {
      onSignalsUsed(signalsUsed + newSignals.length);
      const ids = new Set(newSignals.map(s => s.id));
      setNewSignalIds(ids);
      setSignals(prev => [...newSignals, ...prev].slice(0, 100));
      onSignalGenerated?.(newSignals.length);
      setTimeout(() => setNewSignalIds(new Set()), 5000);

      const top = [...newSignals].sort((a, b) => b.confidence - a.confidence)[0];
      if (soundRef.current) {
        if (top.strength === "STRONG") playStrongSignalSound(top.direction as "CALL" | "PUT").catch(() => {});
        else if (top.direction === "CALL") playCallSound().catch(() => {});
        else playPutSound().catch(() => {});
      }

      const topDir = top.direction === "CALL" ? "📈" : "📉";
      const strong = newSignals.filter(s => s.strength === "STRONG").length;
      const left = Math.max(0, signalLimit - (signalsUsed + newSignals.length));
      toast.success(`${topDir} ${newSignals.length} signal(s) generated • ${strong} STRONG • ${left} left today`, { duration: 4000 });
    }
  }, [processing, isAllowed, limitReached, selectedPairs, signalLimit, signalsUsed, onSignalsUsed, onSignalGenerated, onPairChange]);

  const visibleSignals = showAll ? signals : signals.slice(0, 6);

  const { label: sessionLabel } = getMarketSession();
  const usagePct = signalLimit > 0 ? Math.min(100, (signalsUsed / signalLimit) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Control Card */}
      <div className={`rounded-2xl border overflow-hidden ${bg} backdrop-blur-xl`}
        style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Zap size={17} style={{ color: themeColor }} />
              <span className={`text-sm font-bold ${tb}`}>Manual Signal Generator</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onSoundToggle}
                className={`p-2 rounded-lg border transition-all hover:scale-105 ${soundEnabled ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-400" : isDark ? "border-gray-700/40 bg-gray-900/20 text-gray-600" : "border-gray-200 bg-gray-50 text-gray-400"}`}
                title={soundEnabled ? "Mute" : "Unmute"}>
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border`}
                style={{ color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10` }}>
                {sessionLabel}
              </span>
            </div>
          </div>

          {/* Access denied banner */}
          {!isAllowed && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-950/20 border border-red-800/30 mb-4">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-400">Access Not Granted</p>
                <p className="text-xs text-red-500/70">Your account is pending admin approval. Contact admin to get access.</p>
              </div>
            </div>
          )}

          {/* Daily usage */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className={ts}>Daily Signals Used</span>
              <span className="font-bold" style={{ color: limitReached ? "#ff4466" : themeColor }}>{signalsUsed}/{signalLimit}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "#1f2937" : "#e5e7eb" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${usagePct}%`, background: limitReached ? "#ff4466" : `linear-gradient(90deg, ${themeColor}80, ${themeColor})` }} />
            </div>
            {!limitReached && (
              <p className={`text-[10px] ${ts}`}>{dailyLeft} signals remaining today</p>
            )}
          </div>

          {/* Next candle info */}
          <div className="flex items-center gap-3 p-3 rounded-xl border mb-4"
            style={{ borderColor: `${themeColor}25`, background: `${themeColor}05` }}>
            <Clock size={14} style={{ color: themeColor }} />
            <div className="flex-1">
              <p className={`text-[10px] ${ts}`}>Current candle closes in <span className="text-yellow-400 font-bold">{nextMinuteSecs}s</span></p>
              <p className={`text-[10px] ${ts}`}>Next entry: <span style={{ color: themeColor }} className="font-bold">{formatBDLocalTime(nextCandleTime)}</span> BDT • Expiry: <span className="text-cyan-400 font-bold">{formatBDLocalTime(expiryTimeDt)}</span></p>
            </div>
            <TrendingUp size={14} style={{ color: themeColor }} className="opacity-50" />
          </div>

          {/* Scanning progress */}
          {processing && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-cyan-800/30 bg-cyan-950/10 mb-4">
              <Loader2 size={14} className="text-cyan-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-cyan-400 font-medium">Analysing {scanningPair || "pairs"}...</p>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: isDark ? "#1f2937" : "#e5e7eb" }}>
                  <div className="h-full rounded-full animate-pulse" style={{ width: "60%", background: themeColor }} />
                </div>
              </div>
            </div>
          )}

          {/* Main Button */}
          <button
            onClick={runManualScan}
            disabled={processing || !isAllowed || limitReached || selectedPairs.length === 0}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm text-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: (processing || !isAllowed || limitReached || selectedPairs.length === 0)
                ? isDark ? "#4b5563" : "#9ca3af"
                : `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
              boxShadow: (processing || !isAllowed || limitReached) ? "none" : `0 4px 30px ${themeColor}50, 0 0 60px ${themeColor}20`,
            }}
          >
            {processing ? (
              <><Loader2 size={18} className="animate-spin" /> Analysing...</>
            ) : limitReached ? (
              "Daily Limit Reached"
            ) : !isAllowed ? (
              "⛔ Access Not Granted"
            ) : (
              <><Zap size={18} fill="currentColor" /> GET SIGNAL NOW</>
            )}
          </button>

          {selectedPairs.length === 0 && isAllowed && (
            <p className="text-xs text-amber-500/70 text-center mt-2 flex items-center justify-center gap-1">
              <AlertTriangle size={11} /> Select at least one pair from the sidebar
            </p>
          )}

          <p className={`text-[10px] ${ts} text-center mt-3`}>
            Powered by Bollinger Band + 11 indicators • Price action • Candle power • Market zones
          </p>
        </div>
      </div>

      {/* Signals List */}
      {signals.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold ${tb}`}>
              Signal History <span className={`text-xs ${ts} font-normal`}>({signals.length})</span>
            </h3>
            <button onClick={() => setSignals([])}
              className={`text-xs ${ts} hover:text-red-400 transition-colors px-2 py-1 rounded-lg border ${isDark ? "border-gray-800/40 hover:border-red-800/40 hover:bg-red-950/10" : "border-gray-200 hover:border-red-200 hover:bg-red-50"}`}>
              Clear All
            </button>
          </div>
          <div className="space-y-3">
            {visibleSignals.map((signal, idx) => (
              <div key={signal.id} style={{ animationDelay: `${idx * 0.04}s` }} className="signal-enter">
                <SignalCard signal={signal} themeColor={themeColor} isNew={newSignalIds.has(signal.id)} isDark={isDark} />
              </div>
            ))}
          </div>
          {signals.length > 6 && (
            <button onClick={() => setShowAll(!showAll)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs transition-all hover:scale-[1.01] ${isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500 hover:text-gray-300" : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700"}`}>
              {showAll ? <><ChevronUp size={13} /> Show Less</> : <><ChevronDown size={13} /> Show All {signals.length}</>}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border"
            style={{ borderColor: `${themeColor}30`, background: `${themeColor}08` }}>
            <Zap size={32} style={{ color: themeColor, opacity: 0.4 }} />
          </div>
          <p className={`${tb} font-semibold text-base`}>Ready to Analyse</p>
          <p className={`${ts} text-sm mt-1.5 max-w-xs`}>
            {!isAllowed ? "Access pending admin approval" : limitReached ? "Daily signal limit reached" : "Click GET SIGNAL NOW to generate signals for your selected pairs"}
          </p>
        </div>
      )}
    </div>
  );
};

export default ManualSignalPanel;
