import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, X, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, BarChart2, Zap, Eye, Calendar, Lock } from "lucide-react";
import { analyzeChartScreenshot } from "@/lib/priceAction";
import { playAnalysisComplete, playCallSound, playPutSound } from "@/lib/soundEngine";
import { ScreenshotAnalysis } from "@/types";
import {
  getDailyScreenshotUsage, incrementDailyScreenshotUsage, DAILY_SCREENSHOT_LIMIT,
} from "@/lib/marketUtils";
import { toast } from "sonner";

interface ScreenshotAnalyserProps {
  themeColor: string;
  isDark: boolean;
  soundEnabled: boolean;
}

const ScreenshotAnalyser: React.FC<ScreenshotAnalyserProps> = ({ themeColor, isDark, soundEnabled }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState<ScreenshotAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dailyUsed, setDailyUsed] = useState(getDailyScreenshotUsage());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const dailyLeft = Math.max(0, DAILY_SCREENSHOT_LIMIT - dailyUsed);
  const limitReached = dailyLeft <= 0;

  const border = isDark ? "border-gray-800/50" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const subBg = isDark ? "bg-gray-900/40 border-gray-800/30" : "bg-gray-50 border-gray-200";

  const processImage = async (file: File) => {
    if (limitReached) {
      toast.error(`Daily screenshot limit (${DAILY_SCREENSHOT_LIMIT}) reached. Resets at midnight.`);
      return;
    }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Image too large. Max 15MB."); return; }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setResult(null);
      setAnalysing(true);

      try {
        toast.info("🔍 Deep chart analysis running...", { duration: 3000 });
        await new Promise(r => setTimeout(r, 600));

        const analysis = await analyzeChartScreenshot(dataUrl);

        // Increment usage
        const newCount = incrementDailyScreenshotUsage();
        setDailyUsed(newCount);

        const screenshotResult: ScreenshotAnalysis = {
          direction: analysis.direction,
          confidence: analysis.confidence,
          patterns: analysis.patterns,
          zones: analysis.zones,
          trend: analysis.trend,
          candlePattern: analysis.candlePattern,
          buyerSellerRatio: analysis.buyerSellerRatio,
          recommendation: analysis.recommendation,
          timestamp: new Date(),
        };

        setResult(screenshotResult);

        if (soundEnabled) {
          await playAnalysisComplete();
          if (analysis.direction === "CALL") await playCallSound();
          else if (analysis.direction === "PUT") await playPutSound();
        }

        const dirEmoji = analysis.direction === "CALL" ? "📈" : analysis.direction === "PUT" ? "📉" : "⏸";
        const left = Math.max(0, DAILY_SCREENSHOT_LIMIT - newCount);
        toast.success(`${dirEmoji} Analysis complete — ${analysis.direction} ${analysis.confidence}% • ${left} left today`);
      } catch (err) {
        toast.error("Analysis failed. Try a clearer screenshot.");
        console.error(err);
      } finally {
        setAnalysing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImage(file);
  };

  const clearResult = () => {
    setImagePreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const dirColor = result?.direction === "CALL" ? "#00d084" : result?.direction === "PUT" ? "#ff4466" : themeColor;
  const confidenceColor = result
    ? result.confidence >= 80 ? "#00d084" : result.confidence >= 65 ? "#FFD700" : "#ff8c00"
    : themeColor;

  return (
    <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: `${themeColor}25`, background: `${themeColor}06` }}>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Camera size={16} style={{ color: themeColor }} />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: themeColor }} />
          </div>
          <span className={`text-sm font-bold ${tb}`}>Chart Screenshot Analyser</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10` }}>
            DEEP AI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-[9px] ${ts}`}>
            <Eye size={9} />
            <span>Any broker chart</span>
          </div>
          {/* Daily limit badge */}
          <span
            className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border"
            style={limitReached
              ? { color: "#ff4466", borderColor: "#ff446640", background: "#ff446610" }
              : dailyLeft <= 3
              ? { color: "#FFD700", borderColor: "#FFD70040", background: "#FFD70010" }
              : { color: themeColor, borderColor: `${themeColor}40`, background: `${themeColor}10` }}
          >
            <Calendar size={8} />
            {limitReached ? "0 left" : `${dailyLeft}/${DAILY_SCREENSHOT_LIMIT}`}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Daily limit reached */}
        {limitReached ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-red-800/40 bg-red-950/20">
              <Lock size={28} className="text-red-400" />
            </div>
            <div>
              <p className={`text-sm font-bold ${isDark ? "text-red-400" : "text-red-600"}`}>Daily Screenshot Limit Reached</p>
              <p className={`text-xs ${ts} mt-1`}>You've used all {DAILY_SCREENSHOT_LIMIT} screenshot analyses for today.</p>
              <p className={`text-xs ${ts} mt-0.5`}>Resets at midnight. Come back tomorrow!</p>
            </div>
          </div>
        ) : (
          <>
            {/* Info */}
            <div className={`text-xs ${ts} px-3 py-2 rounded-lg border ${subBg} leading-relaxed`}>
              📷 Upload any 1-min broker chart screenshot. The deep AI engine analyses candlestick patterns, market zones, buyer/seller dominance, trend structure and gives a precise signal. Works with any broker: Pocket Option, Quotex, IQ Option, Binomo, MT4/5.
            </div>

            {/* Upload Area */}
            {!imagePreview ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className="relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer"
                style={{
                  borderColor: dragOver ? themeColor : isDark ? "#374151" : "#d1d5db",
                  background: dragOver ? `${themeColor}08` : isDark ? "rgba(0,0,0,0.2)" : "rgba(249,250,251,0.8)",
                  minHeight: "140px",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center gap-3 p-6">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{ background: dragOver ? `${themeColor}20` : isDark ? "#111827" : "#f3f4f6", border: `1px solid ${dragOver ? themeColor : isDark ? "#374151" : "#e5e7eb"}` }}
                  >
                    <Upload size={24} style={{ color: dragOver ? themeColor : isDark ? "#6b7280" : "#9ca3af" }} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-semibold ${tb}`}>Drop chart screenshot here</p>
                    <p className={`text-xs ${ts} mt-1`}>or click to upload • PNG, JPG, WebP • Any broker</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-black transition-all hover:scale-105 hover:brightness-110"
                      style={{ background: themeColor, boxShadow: `0 4px 16px ${themeColor}40` }}
                    >
                      <Upload size={12} /> Upload File
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all hover:scale-105 ${isDark ? "border-gray-700 bg-gray-900/40 text-gray-300 hover:border-gray-500" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
                    >
                      <Camera size={12} /> Camera
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: `${themeColor}40` }}>
                <img src={imagePreview} alt="Chart screenshot" className="w-full object-cover max-h-56" style={{ objectPosition: "center top" }} />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
                <button onClick={clearResult} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white border border-white/20 hover:bg-black/80 transition-all">
                  <X size={12} />
                </button>
                {analysing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${themeColor}40`, borderTopColor: themeColor }} />
                      <div className="absolute inset-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${themeColor}20`, borderTopColor: `${themeColor}80`, animationDirection: "reverse" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-white text-sm font-bold">Deep Analysis Running...</p>
                      <p className="text-gray-300 text-xs mt-1">Scanning candles • zones • buyer/seller</p>
                    </div>
                    <div className="absolute left-0 right-0 h-0.5 opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)`, animation: "scanLine 1.2s linear infinite" }} />
                  </div>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
          </>
        )}

        {/* Analysis Result */}
        {result && !analysing && (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: `${dirColor}40`, background: `${dirColor}06`, boxShadow: `0 0 25px ${dirColor}15`, animation: "slide-in-up 0.4s ease forwards" }}
          >
            {/* Direction Banner */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: `${dirColor}15`, borderBottom: `1px solid ${dirColor}30` }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center border-2" style={{ borderColor: dirColor, background: `${dirColor}20` }}>
                  {result.direction === "CALL" ? <TrendingUp size={22} style={{ color: dirColor }} strokeWidth={2.5} />
                    : result.direction === "PUT" ? <TrendingDown size={22} style={{ color: dirColor }} strokeWidth={2.5} />
                    : <Minus size={22} style={{ color: dirColor }} strokeWidth={2.5} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black" style={{ color: dirColor }}>{result.direction}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${dirColor}20`, color: dirColor }}>
                      Screenshot Signal
                    </span>
                  </div>
                  <p className={`text-xs ${ts} mt-0.5`}>{result.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: confidenceColor }}>{result.confidence}%</p>
                <p className={`text-[10px] ${ts}`}>CONFIDENCE</p>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="px-4 py-2">
              <div className={`h-2 ${isDark ? "bg-gray-900" : "bg-gray-100"} rounded-full overflow-hidden`}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${result.confidence}%`, background: `linear-gradient(90deg, ${confidenceColor}60, ${confidenceColor})`, boxShadow: `0 0 8px ${confidenceColor}50` }}
                />
              </div>
            </div>

            {/* Metrics */}
            <div className="px-4 pb-3 grid grid-cols-3 gap-2">
              <div className={`text-center p-2 rounded-lg border ${subBg}`}>
                <p className={`text-[9px] ${ts}`}>TREND</p>
                <p className="text-xs font-bold" style={{ color: result.trend === "UPTREND" ? "#00d084" : result.trend === "DOWNTREND" ? "#ff4466" : isDark ? "#9ca3af" : "#6b7280" }}>
                  {result.trend}
                </p>
              </div>
              <div className={`text-center p-2 rounded-lg border ${subBg}`}>
                <p className={`text-[9px] ${ts}`}>BUYERS</p>
                <p className="text-xs font-bold" style={{ color: result.buyerSellerRatio > 55 ? "#00d084" : result.buyerSellerRatio < 45 ? "#ff4466" : isDark ? "#9ca3af" : "#6b7280" }}>
                  {result.buyerSellerRatio}%
                </p>
              </div>
              <div className={`text-center p-2 rounded-lg border ${subBg}`}>
                <p className={`text-[9px] ${ts}`}>SELLERS</p>
                <p className="text-xs font-bold" style={{ color: (100 - result.buyerSellerRatio) > 55 ? "#ff4466" : (100 - result.buyerSellerRatio) < 45 ? "#00d084" : isDark ? "#9ca3af" : "#6b7280" }}>
                  {100 - result.buyerSellerRatio}%
                </p>
              </div>
            </div>

            {/* Patterns */}
            <div className="px-4 pb-3 space-y-2">
              <p className={`text-[10px] ${ts} tracking-widest`}>DETECTED PATTERNS</p>
              <div className="flex flex-wrap gap-1.5">
                {result.patterns.map((p, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border font-medium" style={{ color: dirColor, borderColor: `${dirColor}35`, background: `${dirColor}10` }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Zones */}
            <div className="px-4 pb-3 space-y-2">
              <p className={`text-[10px] ${ts} tracking-widest`}>MARKET ZONES</p>
              <div className="flex flex-wrap gap-1.5">
                {result.zones.map((z, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border font-medium" style={{ color: "#FFD700", borderColor: "#FFD70040", background: "#FFD70010" }}>
                    {z}
                  </span>
                ))}
              </div>
            </div>

            {/* Candle Pattern */}
            <div className="px-4 pb-3">
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${subBg}`}>
                <BarChart2 size={13} style={{ color: dirColor }} />
                <div>
                  <p className={`text-[9px] ${ts}`}>CANDLE PATTERN</p>
                  <p className="text-xs font-medium" style={{ color: dirColor }}>{result.candlePattern}</p>
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="px-4 py-3 border-t" style={{ borderColor: `${dirColor}25`, background: `${dirColor}08` }}>
              <div className="flex items-start gap-2">
                {result.direction === "NEUTRAL"
                  ? <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  : <CheckCircle size={14} style={{ color: dirColor }} className="flex-shrink-0 mt-0.5" />}
                <p className="text-xs leading-relaxed" style={{ color: isDark ? "#d1d5db" : "#374151" }}>
                  {result.recommendation}
                </p>
              </div>
            </div>

            {/* Re-analyse */}
            <div className="px-4 pb-4">
              <button
                onClick={clearResult}
                disabled={limitReached}
                className={`w-full mt-2 py-2.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 ${isDark ? "border-gray-700/50 bg-gray-900/20 text-gray-400 hover:text-gray-300" : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700"}`}
              >
                {limitReached ? `🔒 Daily limit reached (${dailyLeft} left)` : "📷 Analyse New Screenshot"}
              </button>
            </div>
          </div>
        )}

        {/* Quick tips */}
        {!result && !imagePreview && !limitReached && (
          <div className={`space-y-1.5 text-[10px] ${ts}`}>
            <p className="font-medium" style={{ color: themeColor }}>Tips for best accuracy:</p>
            <p>• Use 1-minute timeframe chart</p>
            <p>• Include recent 20-30 candles</p>
            <p>• Higher resolution = more accurate analysis</p>
            <p>• Works with Pocket Option, Quotex, IQ Option, Binomo, MT4/MT5 & any broker</p>
            <p>• Works 24/7 including weekends</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenshotAnalyser;
