import React, { useState, useRef, useCallback, useMemo, memo } from "react";
import {
  Zap, ChevronDown, ChevronUp, Volume2, VolumeX,
  AlertTriangle, Loader2, Clock, TrendingUp, RefreshCw,
} from "lucide-react";
import { Signal } from "@/types";
import { generateDemoSignal } from "@/lib/signalEngine";
import { getMarketSession, getBangladeshTime } from "@/lib/marketUtils";
import { playCallSound, playPutSound, playStrongSignalSound } from "@/lib/soundEngine";
import SignalCard from "@/components/SignalCard";
import { toast } from "sonner";

function formatBDLocalTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

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

const ManualSignalPanel: React.FC<ManualSignalPanelProps> = memo(({
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

  const dailyLeft = useMemo(() => Math.max(0, signalLimit - signalsUsed), [signalLimit, signalsUsed]);
  const limitReached = dailyLeft <= 0;
  const usagePct = useMemo(() => signalLimit > 0 ? Math.min(100, (signalsUsed / signalLimit) * 100) : 0, [signalLimit, signalsUsed]);

  const border = isDark ? "border-gray-800/40" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";

  const bdNow = getBangladeshTime();
  const nextMinuteSecs = 60 - bdNow.getSeconds();
  const nextCandleTime = useMemo(() => new Date(getBangladeshTime().getTime() + (60 - getBangladeshTime().getSeconds()) * 1000), []);
  const expiryTimeDt = useMemo(() => new Date(nextCandleTime.getTime() + 60 * 1000), [nextCandleTime]);

  const { label: sessionLabel } = getMarketSession();

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
      // Brief pause for UX feedback
      await new Promise(r => setTimeout(r, 60 + Math.random() * 50));
      const signal = generateDemoSignal(pair);
      if (signal) { newSignals.push(signal); scanned++; }
    }

    setScanningPair("");
    setProcessing(false);

    if (newSignals.length > 0) {
      onSignalsUsed(signalsUsed + newSignals.length);
      const ids = new Set(newSignals.map(s => s.id));
      setNewSignalIds(ids);
      setSignals(prev => [...newSignals, ...prev].slice(0, 80));
      onSignalGenerated?.(newSignals.length);
      setTimeout(() => setNewSignalIds(new Set()), 4500);

      const top = [...newSignals].sort((a, b) => b.confidence - a.confidence)[0];
      if (soundRef.current) {
        try {
          if (top.strength === "STRONG") await playStrongSignalSound(top.direction as "CALL" | "PUT");
          else if (top.direction === "CALL") await playCallSound();
          else await playPutSound();
        } catch { /* ignore audio errors */ }
      }

      const topDir = top.direction === "CALL" ? "📈" : "📉";
      const strong = newSignals.filter(s => s.strength === "STRONG").length;
      const left = Math.max(0, signalLimit - (signalsUsed + newSignals.length));
      toast.success(
        `${topDir} ${newSignals.length} signal(s) • ${strong} STRONG • ${left} left today`,
        { duration: 3500 }
      );
    }
  }, [processing, isAllowed, limitReached, selectedPairs, signalLimit, signalsUsed, onSignalsUsed, onSignalGenerated, onPairChange]);

  const handleClear = useCallback(() => setSignals([]), []);
  const handleToggleShowAll = useCallback(() => setShowAll(p => !p), []);

  const visibleSignals = useMemo(() => showAll ? signals : signals.slice(0, 6), [signals, showAll]);

  const canScan = !processing && isAllowed && !limitReached && selectedPairs.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Control Card */}
      <div
        className={`rounded-2xl border overflow-hidden ${bg} backdrop-blur-xl`}
        style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${themeColor}18`, border: `1px solid ${themeColor}35` }}
              >
                <Zap size={15} style={{ color: themeColor }} />
              </div>
              <div>
                <span className={`text-sm font-bold ${tb}`}>Manual Signal Generator</span>
                <p className={`text-[10px] ${ts}`}>{sessionLabel}</p>
              </div>
            </div>
            <button
              onClick={onSoundToggle}
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-400"
                  : isDark ? "border-gray-700/40 bg-gray-900/20 text-gray-600" : "border-gray-200 bg-gray-50 text-gray-400"
              }`}
              title={soundEnabled ? "Mute sounds" : "Enable sounds"}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
          </div>

          {/* Access denied */}
          {!isAllowed && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-950/20 border border-red-800/30 mb-4">
              <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-400">Access Pending</p>
                <p className="text-xs text-red-500/70">Contact admin to get signal access.</p>
              </div>
            </div>
          )}

          {/* Daily usage */}
          <div className="mb-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={ts}>Daily Signals Used</span>
              <span
                className="font-bold"
                style={{ color: limitReached ? "#ff4466" : usagePct > 70 ? "#FFD700" : themeColor }}
              >
                {signalsUsed}/{signalLimit}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "#1f2937" : "#e5e7eb" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${usagePct}%`,
                  background: limitReached ? "#ff4466" : usagePct > 70 ? "#FFD700" : `linear-gradient(90deg, ${themeColor}80, ${themeColor})`,
                }}
              />
            </div>
            {!limitReached && <p className={`text-[10px] ${ts}`}>{dailyLeft} signals remaining today</p>}
          </div>

          {/* Next candle info */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl border mb-4"
            style={{ borderColor: `${themeColor}25`, background: `${themeColor}05` }}
          >
            <Clock size={13} style={{ color: themeColor }} />
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] ${ts}`}>
                Candle closes in <span className="text-yellow-400 font-bold">{nextMinuteSecs}s</span>
              </p>
              <p className={`text-[10px] ${ts} truncate`}>
                Entry: <span style={{ color: themeColor }} className="font-bold">{formatBDLocalTime(nextCandleTime)}</span> BDT
                {" "}• Expiry: <span className="text-cyan-400 font-bold">{formatBDLocalTime(expiryTimeDt)}</span>
              </p>
            </div>
            <TrendingUp size={12} style={{ color: themeColor }} className="opacity-40 flex-shrink-0" />
          </div>

          {/* Scanning progress */}
          {processing && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-cyan-800/30 bg-cyan-950/10 mb-4">
              <Loader2 size={13} className="text-cyan-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-cyan-400 font-medium">
                  Analysing {scanningPair || "pairs"}...
                </p>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: isDark ? "#1f2937" : "#e5e7eb" }}>
                  <div className="h-full rounded-full animate-pulse" style={{ width: "65%", background: themeColor }} />
                </div>
              </div>
            </div>
          )}

          {/* Main button */}
          <button
            onClick={runManualScan}
            disabled={!canScan}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm text-black transition-transform duration-150 hover:scale-[1.015] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: canScan
                ? `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`
                : isDark ? "#374151" : "#9ca3af",
              boxShadow: canScan ? `0 4px 28px ${themeColor}45, 0 0 50px ${themeColor}18` : "none",
            }}
          >
            {processing ? (
              <><Loader2 size={17} className="animate-spin" /> Analysing...</>
            ) : limitReached ? (
              "Daily Limit Reached"
            ) : !isAllowed ? (
              "⛔ Access Not Granted"
            ) : (
              <><Zap size={17} fill="currentColor" /> GET SIGNAL NOW</>
            )}
          </button>

          {selectedPairs.length === 0 && isAllowed && (
            <p className="text-xs text-amber-500/70 text-center mt-2 flex items-center justify-center gap-1">
              <AlertTriangle size={11} /> Select at least one pair from the sidebar
            </p>
          )}

          <p className={`text-[10px] ${ts} text-center mt-3`}>
            BB Primary · {sessionLabel} · 19 indicators · Price action · Market zones
          </p>
        </div>
      </div>

      {/* Signals List */}
      {signals.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold ${tb}`}>
              Signal History{" "}
              <span className={`text-xs ${ts} font-normal`}>({signals.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={runManualScan}
                disabled={!canScan}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  isDark ? "border-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-700/50" : "border-gray-200 text-gray-500 hover:text-gray-700"
                }`}
                title="Generate new signals"
              >
                <RefreshCw size={11} className={processing ? "animate-spin" : ""} />
                New
              </button>
              <button
                onClick={handleClear}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  isDark ? "border-gray-800/40 text-gray-600 hover:text-red-400 hover:border-red-800/40 hover:bg-red-950/10" : "border-gray-200 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                }`}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {visibleSignals.map((signal, idx) => (
              <div
                key={signal.id}
                style={{ animationDelay: `${idx * 0.035}s` }}
                className="signal-enter"
              >
                <SignalCard
                  signal={signal}
                  themeColor={themeColor}
                  isNew={newSignalIds.has(signal.id)}
                  isDark={isDark}
                />
              </div>
            ))}
          </div>

          {signals.length > 6 && (
            <button
              onClick={handleToggleShowAll}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs transition-colors ${
                isDark
                  ? "border-gray-800/40 bg-gray-900/20 text-gray-500 hover:text-gray-300"
                  : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700"
              }`}
            >
              {showAll
                ? <><ChevronUp size={13} /> Show Less</>
                : <><ChevronDown size={13} /> Show All {signals.length}</>}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border"
            style={{ borderColor: `${themeColor}30`, background: `${themeColor}08` }}
          >
            <Zap size={32} style={{ color: themeColor, opacity: 0.35 }} />
          </div>
          <p className={`${tb} font-semibold text-base`}>Ready to Analyse</p>
          <p className={`${ts} text-sm mt-1.5 max-w-xs`}>
            {!isAllowed
              ? "Access pending admin approval"
              : limitReached
              ? "Daily signal limit reached"
              : "Click GET SIGNAL NOW to generate signals for your selected pairs"}
          </p>
        </div>
      )}
    </div>
  );
});

ManualSignalPanel.displayName = "ManualSignalPanel";
export default ManualSignalPanel;
