import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, RefreshCw, AlertTriangle, Zap, Radio, ChevronDown, ChevronUp, Volume2, VolumeX, Calendar, Lock } from "lucide-react";
import { Signal } from "@/types";
import { generateSignal, generateDemoSignal } from "@/lib/signalEngine";
import { fetchCandles } from "@/lib/twelvedata";
import {
  isWeekend, isMarketOpen, formatCountdown,
  getDailySignalUsage, incrementDailySignalUsage, DAILY_SIGNAL_LIMIT,
} from "@/lib/marketUtils";
import { playCallSound, playPutSound, playStrongSignalSound, playEngineStart, playEngineStop, playCountdownBeep } from "@/lib/soundEngine";
import SignalCard from "@/components/SignalCard";
import { toast } from "sonner";

interface SignalPanelProps {
  selectedPairs: string[];
  apiKey: string;
  isApiValid: boolean;
  themeColor: string;
  isDark: boolean;
  onSignalGenerated?: (count: number) => void;
  onPairChange?: (pair: string) => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
}

const SignalPanel: React.FC<SignalPanelProps> = ({
  selectedPairs, apiKey, isApiValid, themeColor, isDark,
  onSignalGenerated, onPairChange, soundEnabled, onSoundToggle,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [countdown, setCountdown] = useState("0:00");
  const [processing, setProcessing] = useState(false);
  const [newSignalIds, setNewSignalIds] = useState<Set<string>>(new Set());
  const [scanningPair, setScanningPair] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [lastSignalDir, setLastSignalDir] = useState<"CALL" | "PUT" | null>(null);
  const [dailyUsed, setDailyUsed] = useState(getDailySignalUsage());

  // Weekend check — live updating
  const [weekend, setWeekend] = useState(isWeekend());

  useEffect(() => {
    const t = setInterval(() => setWeekend(isWeekend()), 30000);
    return () => clearInterval(t);
  }, []);

  // If weekend becomes true while running, stop engine
  useEffect(() => {
    if (weekend && isRunning) {
      stopEngine();
      toast.warning("📅 Weekend detected — Auto signal engine locked. Use Screenshot Analyser instead.", { duration: 6000 });
    }
  }, [weekend]);

  const dailyLeft = Math.max(0, DAILY_SIGNAL_LIMIT - dailyUsed);
  const limitReached = dailyLeft <= 0;
  const engineLocked = weekend || limitReached;

  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedPairsRef = useRef(selectedPairs);
  const apiKeyRef = useRef(apiKey);
  const isApiValidRef = useRef(isApiValid);
  const soundEnabledRef = useRef(soundEnabled);
  const prevCountdownSecs = useRef<number>(0);

  useEffect(() => { selectedPairsRef.current = selectedPairs; }, [selectedPairs]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);
  useEffect(() => { isApiValidRef.current = isApiValid; }, [isApiValid]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const clearAllTimers = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  const startCountdownTick = useCallback((targetMs: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    prevCountdownSecs.current = Math.ceil((targetMs - Date.now()) / 1000);
    countdownRef.current = setInterval(() => {
      const remaining = targetMs - Date.now();
      if (remaining <= 0) { setCountdown("0:00"); return; }
      setCountdown(formatCountdown(remaining));
      const secs = Math.ceil(remaining / 1000);
      if (secs <= 5 && secs !== prevCountdownSecs.current && soundEnabledRef.current) {
        playCountdownBeep(secs === 1).catch(() => {});
      }
      prevCountdownSecs.current = secs;
    }, 250);
  }, []);

  const runSignalCycle = useCallback(async () => {
    if (processingRef.current) return;
    if (isWeekend()) {
      toast.warning("📅 Weekend — Auto signals locked. Use Screenshot Analyser.");
      runningRef.current = false;
      setIsRunning(false);
      clearAllTimers();
      return;
    }

    const currentUsage = getDailySignalUsage();
    if (currentUsage >= DAILY_SIGNAL_LIMIT) {
      toast.warning(`Daily limit reached (${DAILY_SIGNAL_LIMIT} signals/day). Resets at midnight.`);
      setDailyUsed(currentUsage);
      runningRef.current = false;
      setIsRunning(false);
      clearAllTimers();
      return;
    }

    const pairs = selectedPairsRef.current;
    const key = apiKeyRef.current;
    const valid = isApiValidRef.current;
    if (pairs.length === 0) return;

    processingRef.current = true;
    setProcessing(true);
    setScanningPair("");

    const newSignals: Signal[] = [];

    for (const pair of pairs) {
      if (!runningRef.current && !processingRef.current) break;
      if (getDailySignalUsage() >= DAILY_SIGNAL_LIMIT) break;

      setScanningPair(pair);
      if (onPairChange) onPairChange(pair);

      try {
        let signal: Signal | null = null;

        if (valid && key && key !== "DEMO_MODE") {
          let candles = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              candles = await fetchCandles(pair, key, 45);
              break;
            } catch (err) {
              console.warn(`[Fetch] ${pair} attempt ${attempt}:`, err);
              if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt));
            }
          }
          if (candles && candles.length >= 20) {
            signal = generateSignal(pair, candles);
          } else {
            signal = generateDemoSignal(pair);
          }
        } else {
          await new Promise(r => setTimeout(r, 50 + Math.random() * 40));
          signal = generateDemoSignal(pair);
        }

        if (signal) newSignals.push(signal);
      } catch (err) {
        console.error(`[Signal] Error ${pair}:`, err);
      }
    }

    setScanningPair("");
    processingRef.current = false;
    setProcessing(false);

    if (newSignals.length > 0) {
      const newCount = incrementDailySignalUsage(newSignals.length);
      setDailyUsed(newCount);

      const ids = new Set(newSignals.map(s => s.id));
      setNewSignalIds(ids);
      setSignals(prev => [...newSignals, ...prev].slice(0, 150));
      setCycleCount(c => c + 1);
      onSignalGenerated?.(newSignals.length);
      setTimeout(() => setNewSignalIds(new Set()), 6000);

      const topSignal = [...newSignals].sort((a, b) => b.confidence - a.confidence)[0];
      setLastSignalDir(topSignal.direction as "CALL" | "PUT");

      if (soundEnabledRef.current) {
        if (topSignal.strength === "STRONG") {
          playStrongSignalSound(topSignal.direction as "CALL" | "PUT").catch(() => {});
        } else if (topSignal.direction === "CALL") {
          playCallSound().catch(() => {});
        } else {
          playPutSound().catch(() => {});
        }
      }

      const liveLabel = valid && key !== "DEMO_MODE" ? "Live" : "Demo";
      const strongCount = newSignals.filter(s => s.strength === "STRONG").length;
      const topDir = topSignal.direction === "CALL" ? "📈" : "📉";
      const remaining = Math.max(0, DAILY_SIGNAL_LIMIT - newCount);
      toast.success(`${topDir} ${newSignals.length} signal${newSignals.length > 1 ? "s" : ""} (${strongCount} STRONG) — ${liveLabel} • ${remaining} left today`, { duration: 4000 });

      if (newCount >= DAILY_SIGNAL_LIMIT) {
        toast.warning("Daily signal limit reached. Engine stopped.");
        runningRef.current = false;
        setIsRunning(false);
        clearAllTimers();
        return;
      }
    } else {
      toast.info("Scan complete — processing...", { duration: 2000 });
    }
  }, [onSignalGenerated, onPairChange]);

  const scheduleNextCycle = useCallback(() => {
    if (!runningRef.current) return;
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const delay = nextMinute - now;
    startCountdownTick(nextMinute);

    timerRef.current = setTimeout(async () => {
      if (!runningRef.current) return;
      // Check weekend again at execution time
      if (isWeekend()) {
        toast.warning("📅 Weekend — Engine locked. Use Screenshot Analyser.");
        runningRef.current = false;
        setIsRunning(false);
        clearAllTimers();
        return;
      }
      await runSignalCycle();
      scheduleNextCycle();
    }, delay);

    console.log(`[Engine] Next cycle in ${(delay / 1000).toFixed(1)}s`);
  }, [runSignalCycle, startCountdownTick]);

  const startEngine = useCallback(async () => {
    if (weekend) { toast.error("📅 Weekend — Auto signals locked. Use the Screenshot Analyser tab instead."); return; }
    if (limitReached) { toast.error(`Daily limit (${DAILY_SIGNAL_LIMIT}) reached. Resets tomorrow.`); return; }
    if (selectedPairsRef.current.length === 0) { toast.warning("Select at least one pair."); return; }
    runningRef.current = true;
    setIsRunning(true);
    if (soundEnabledRef.current) playEngineStart().catch(() => {});
    toast.success("🚀 Signal engine started!", { duration: 2500 });
    await runSignalCycle();
    scheduleNextCycle();
  }, [weekend, limitReached, runSignalCycle, scheduleNextCycle]);

  const stopEngine = useCallback(() => {
    runningRef.current = false;
    processingRef.current = false;
    setIsRunning(false);
    setProcessing(false);
    setScanningPair("");
    setCountdown("0:00");
    clearAllTimers();
    if (soundEnabledRef.current) playEngineStop().catch(() => {});
    toast.info("Engine stopped.", { duration: 2000 });
  }, []);

  const manualRefresh = useCallback(async () => {
    if (processingRef.current) return;
    if (weekend) { toast.error("📅 Weekend — Use Screenshot Analyser instead."); return; }
    if (limitReached) { toast.error("Daily limit reached."); return; }
    toast.info("Running manual scan...", { duration: 1500 });
    await runSignalCycle();
  }, [runSignalCycle, limitReached, weekend]);

  useEffect(() => () => { runningRef.current = false; clearAllTimers(); }, []);

  useEffect(() => {
    if (isRunning && selectedPairs.length === 0) {
      stopEngine();
      toast.warning("Engine stopped — no pairs selected.");
    }
  }, [selectedPairs, isRunning, stopEngine]);

  const visibleSignals = showAll ? signals : signals.slice(0, 6);
  const border = isDark ? "border-gray-800/40" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";

  // ── Weekend Lock Banner ────────────────────────────────────────────────────
  if (weekend) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className={`rounded-2xl border overflow-hidden ${bg} backdrop-blur-xl`}
          style={{ borderColor: "#F59E0B50" }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "#F59E0B30", background: "#F59E0B08" }}>
            <div className="flex items-center gap-2.5">
              <Lock size={17} className="text-amber-400" />
              <span className={`text-sm font-bold ${tb}`}>Auto Signal Engine</span>
            </div>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/30 border border-amber-700/40 px-2 py-0.5 rounded-full">
              📅 WEEKEND LOCKED
            </span>
          </div>

          {/* Lock illustration */}
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 border-2 relative"
              style={{ borderColor: "#F59E0B50", background: "#F59E0B08" }}
            >
              <Lock size={40} className="text-amber-400" />
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                <span className="text-black text-[10px] font-black">!</span>
              </div>
            </div>

            <h3 className={`text-xl font-black mb-2 ${tb}`}>Weekend — Market Closed</h3>
            <p className={`text-sm ${ts} max-w-xs leading-relaxed mb-6`}>
              Real Forex markets are closed on weekends. The auto signal engine is locked to prevent fake signals on closed markets.
            </p>

            <div className="w-full max-w-sm p-4 rounded-xl border border-amber-700/30 bg-amber-950/10 text-left space-y-2.5">
              <p className="text-xs font-bold text-amber-400 tracking-widest">WEEKEND OPTIONS</p>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px]">📷</span>
                </div>
                <div>
                  <p className={`text-xs font-semibold ${tb}`}>Chart Screenshot Analyser</p>
                  <p className={`text-[10px] ${ts}`}>Analyse any broker chart screenshot — available 24/7 including weekends</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px]">⏰</span>
                </div>
                <div>
                  <p className={`text-xs font-semibold ${tb}`}>Returns Monday</p>
                  <p className={`text-[10px] ${ts}`}>Auto signal engine resumes when markets reopen Monday</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Show historical signals if any */}
        {signals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold ${tb} flex items-center gap-2`}>
                Previous Signals
                <span className={`text-xs ${ts} font-normal`}>({signals.length})</span>
              </h3>
              <button
                onClick={() => setSignals([])}
                className={`text-xs ${ts} hover:text-red-400 transition-colors px-2 py-1 rounded-lg border ${isDark ? "border-gray-800/40 hover:border-red-800/40 hover:bg-red-950/10" : "border-gray-200 hover:border-red-200 hover:bg-red-50"}`}
              >
                Clear
              </button>
            </div>
            <div className="space-y-3">
              {visibleSignals.map((signal, idx) => (
                <div key={signal.id} style={{ animationDelay: `${idx * 0.04}s` }} className="signal-enter">
                  <SignalCard signal={signal} themeColor={themeColor} isNew={false} isDark={isDark} />
                </div>
              ))}
            </div>
            {signals.length > 6 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs transition-all ${isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500 hover:text-gray-300" : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700"}`}
              >
                {showAll ? <><ChevronUp size={13} /> Show Less</> : <><ChevronDown size={13} /> Show All {signals.length}</>}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-2xl border overflow-hidden transition-all duration-500 ${bg} backdrop-blur-xl`}
        style={{
          borderColor: isRunning ? `${themeColor}50` : isDark ? "#374151" : "#e5e7eb",
          boxShadow: isRunning ? `0 0 50px ${themeColor}12, 0 0 100px ${themeColor}06` : "none",
        }}
      >
        <div className="p-5">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Radio size={18} style={{ color: isRunning ? themeColor : isDark ? "#6b7280" : "#9ca3af" }} className={isRunning ? "animate-pulse" : ""} />
                {isRunning && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping" style={{ background: themeColor }} />}
              </div>
              <span className={`text-sm font-bold ${tb}`}>1-Min Signal Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSoundToggle}
                className={`p-2 rounded-lg border transition-all duration-150 hover:scale-105 ${soundEnabled ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-400" : isDark ? "border-gray-700/40 bg-gray-900/20 text-gray-600" : "border-gray-200 bg-gray-50 text-gray-400"}`}
                title={soundEnabled ? "Mute signals" : "Unmute signals"}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
              {cycleCount > 0 && (
                <span className={`text-[10px] ${ts} bg-gray-900/50 px-2 py-0.5 rounded-full border ${isDark ? "border-gray-800/40" : "border-gray-200"}`}>
                  {cycleCount} cycles
                </span>
              )}
              <div
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all duration-500"
                style={isRunning
                  ? { color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10`, boxShadow: `0 0 12px ${themeColor}20` }
                  : { color: isDark ? "#6b7280" : "#9ca3af", borderColor: isDark ? "#374151" : "#e5e7eb", background: "transparent" }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? "animate-pulse" : ""}`} style={{ background: isRunning ? themeColor : isDark ? "#6b7280" : "#9ca3af" }} />
                {isRunning ? "LIVE" : "OFFLINE"}
              </div>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={isApiValid && apiKey !== "DEMO_MODE"
                ? { color: "#00ff88", borderColor: "#00ff8840", background: "#00ff8810" }
                : { color: "#FFD700", borderColor: "#FFD70040", background: "#FFD70010" }}
            >
              {isApiValid && apiKey !== "DEMO_MODE" ? "⚡ LIVE DATA" : "🔆 DEMO MODE"}
            </span>
            <span className={`text-[10px] ${ts}`}>{selectedPairs.length} pairs • Weekdays Only</span>

            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={limitReached
                ? { color: "#ff4466", borderColor: "#ff446640", background: "#ff446610" }
                : dailyLeft <= 3
                ? { color: "#FFD700", borderColor: "#FFD70040", background: "#FFD70010" }
                : { color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10` }}
            >
              <Calendar size={9} />
              {limitReached ? "Limit Reached" : `${dailyLeft}/${DAILY_SIGNAL_LIMIT} left today`}
            </span>
          </div>

          {/* Limit reached banner */}
          {limitReached ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-950/20 border border-red-800/30 mb-4">
              <Calendar size={18} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-400">Daily Signal Limit Reached</p>
                <p className="text-xs text-red-500/70 mt-0.5">You've used all {DAILY_SIGNAL_LIMIT} signals for today. Resets at midnight.</p>
              </div>
            </div>
          ) : processing ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-cyan-800/30 bg-cyan-950/10 mb-4">
              <RefreshCw size={15} className="text-cyan-400 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-cyan-400 font-medium">Scanning {scanningPair || "market"}...</p>
                  <span className="text-[10px] text-cyan-500">
                    {scanningPair ? `${selectedPairs.indexOf(scanningPair) + 1}/${selectedPairs.length}` : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: scanningPair ? `${((selectedPairs.indexOf(scanningPair) + 1) / selectedPairs.length) * 100}%` : "40%",
                      background: `linear-gradient(90deg, ${themeColor}80, ${themeColor})`,
                      boxShadow: `0 0 8px ${themeColor}60`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : isRunning ? (
            <div
              className="flex items-center justify-between p-3 rounded-xl border mb-4 relative overflow-hidden"
              style={{ borderColor: `${themeColor}25`, background: `${themeColor}05` }}
            >
              <div className="absolute inset-0 opacity-[0.03]" style={{ background: `repeating-linear-gradient(45deg, ${themeColor} 0px, ${themeColor} 1px, transparent 1px, transparent 8px)` }} />
              <div className="relative flex items-center gap-2">
                <Zap size={14} style={{ color: themeColor }} className="animate-pulse" />
                <div>
                  <span className={`text-xs ${ts} block`}>Next signal in</span>
                  {lastSignalDir && (
                    <span className="text-[10px]" style={{ color: lastSignalDir === "CALL" ? "#00d084" : "#ff4466" }}>
                      Last: {lastSignalDir} {lastSignalDir === "CALL" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </div>
              <span
                className="text-3xl font-black font-mono relative"
                style={{ color: themeColor, textShadow: isDark ? `0 0 20px ${themeColor}50` : "none", fontVariantNumeric: "tabular-nums" }}
              >
                {countdown}
              </span>
            </div>
          ) : (
            <div className={`p-3 rounded-xl border ${isDark ? "border-gray-800/30 bg-gray-900/20" : "border-gray-200 bg-gray-50"} mb-4`}>
              <p className={`text-xs ${ts} text-center`}>
                Weekday market engine — 1-min binary signals at each candle close • {dailyLeft} signals remaining today
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2.5">
            {!isRunning ? (
              <button
                onClick={startEngine}
                disabled={engineLocked || selectedPairs.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: engineLocked || selectedPairs.length === 0
                    ? isDark ? "#4b5563" : "#9ca3af"
                    : `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                  boxShadow: engineLocked || selectedPairs.length === 0 ? "none" : `0 4px 24px ${themeColor}40`,
                }}
              >
                <Play size={16} fill="currentColor" />
                {limitReached ? "Daily Limit Reached" : "Start Signal Engine"}
              </button>
            ) : (
              <button
                onClick={stopEngine}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border border-red-700/50 bg-red-950/20 text-red-400 hover:bg-red-950/30 transition-all duration-200 active:scale-[0.98]"
              >
                <Square size={16} fill="currentColor" />
                Stop Engine
              </button>
            )}
            <button
              onClick={manualRefresh}
              disabled={processing || engineLocked || selectedPairs.length === 0}
              title="Scan now"
              className={`px-4 py-3.5 rounded-xl border transition-all duration-150 active:scale-[0.97] disabled:opacity-40 hover:scale-[1.02] ${isDark ? "border-gray-700/40 bg-gray-900/20 text-gray-400 hover:text-gray-300 hover:border-gray-600/50" : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
            >
              <RefreshCw size={15} className={processing ? "animate-spin" : ""} />
            </button>
          </div>

          {selectedPairs.length === 0 && !engineLocked && (
            <p className="text-xs text-amber-500/70 text-center mt-3 flex items-center justify-center gap-1">
              <AlertTriangle size={11} /> Select at least one pair
            </p>
          )}
        </div>
      </div>

      {/* Signals List */}
      {signals.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold ${tb} flex items-center gap-2`}>
              Signal History
              <span className={`text-xs ${ts} font-normal`}>({signals.length})</span>
            </h3>
            <button
              onClick={() => setSignals([])}
              className={`text-xs ${ts} hover:text-red-400 transition-colors duration-150 px-2 py-1 rounded-lg border ${isDark ? "border-gray-800/40 hover:border-red-800/40 hover:bg-red-950/10" : "border-gray-200 hover:border-red-200 hover:bg-red-50"}`}
            >
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
            <button
              onClick={() => setShowAll(!showAll)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs transition-all hover:scale-[1.01] ${isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500 hover:text-gray-300 hover:border-gray-700/50" : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
            >
              {showAll ? <><ChevronUp size={13} /> Show Less</> : <><ChevronDown size={13} /> Show All {signals.length} Signals</>}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border transition-all duration-500"
            style={{ borderColor: `${themeColor}30`, background: `${themeColor}08`, boxShadow: isRunning ? `0 0 40px ${themeColor}15` : `0 0 15px ${themeColor}05` }}
          >
            <Radio size={32} style={{ color: themeColor, opacity: 0.5 }} className={isRunning ? "animate-pulse" : ""} />
          </div>
          <p className={`${tb} font-semibold text-base`}>
            {isRunning ? "Scanning Market..." : limitReached ? "Daily Limit Reached" : "No Signals Yet"}
          </p>
          <p className={`${ts} text-sm mt-1.5 max-w-xs`}>
            {limitReached
              ? `You've used all ${DAILY_SIGNAL_LIMIT} daily signals. Returns tomorrow at midnight.`
              : isRunning
              ? "Signals appear at each 1-minute candle close."
              : "Start the engine to receive real-time 1-minute signals."}
          </p>
          {isRunning && (
            <div className="mt-4 px-5 py-2 rounded-full text-sm font-black border font-mono" style={{ color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10`, textShadow: isDark ? `0 0 15px ${themeColor}50` : "none" }}>
              {countdown}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SignalPanel;
