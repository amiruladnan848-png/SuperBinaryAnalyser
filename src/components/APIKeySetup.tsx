import React, { useState } from "react";
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader2, ShieldCheck, Zap } from "lucide-react";
import { validateAPIKey } from "@/lib/twelvedata";
import { toast } from "sonner";

interface APIKeySetupProps {
  apiKey: string;
  isValid: boolean;
  onSave: (key: string, valid: boolean) => void;
  themeColor: string;
  isDark: boolean;
}

const APIKeySetup: React.FC<APIKeySetupProps> = ({ apiKey, isValid, onSave, themeColor, isDark }) => {
  const [inputKey, setInputKey] = useState(apiKey === "DEMO_MODE" ? "" : apiKey);
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [expanded, setExpanded] = useState(!isValid);

  const border = isDark ? "border-gray-800/50" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const inputBg = isDark ? "bg-gray-900/60 border-gray-700/50 text-gray-200" : "bg-gray-50 border-gray-300 text-gray-800";

  const handleValidate = async () => {
    if (!inputKey.trim()) { toast.error("Please enter your data feed key"); return; }
    setValidating(true);
    try {
      const valid = await validateAPIKey(inputKey.trim());
      if (valid) {
        onSave(inputKey.trim(), true);
        toast.success("✅ Connected! Live market data enabled.");
        setExpanded(false);
      } else {
        onSave(inputKey.trim(), false);
        toast.error("Invalid key. Check your credentials.");
      }
    } catch {
      toast.error("Connection error. Check your internet.");
    } finally {
      setValidating(false);
    }
  };

  const handleDemoMode = () => {
    onSave("DEMO_MODE", false);
    toast.info("Demo mode active — signals are simulated.");
    setExpanded(false);
  };

  return (
    <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full p-4 flex items-center justify-between hover:${isDark ? "bg-gray-900/20" : "bg-gray-50"} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <Key size={16} style={{ color: themeColor }} />
          <span className={`text-sm font-bold ${tb}`}>Market Data Feed</span>
        </div>
        <div className="flex items-center gap-2">
          {isValid ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded-full px-2 py-0.5">
              <ShieldCheck size={11} /><span>LIVE</span>
            </div>
          ) : apiKey === "DEMO_MODE" ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-full px-2 py-0.5">
              <Zap size={11} /><span>DEMO</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-full px-2 py-0.5">
              <XCircle size={11} /><span>NOT SET</span>
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className={`p-4 pt-0 space-y-3 border-t ${border}`}>
          <p className={`text-xs ${ts} leading-relaxed mt-3`}>
            Connect a real-time market data feed for highest accuracy signals. Free tier: ~800 credits/day. Each signal cycle uses minimal credits with smart caching.
          </p>

          <div className="space-y-2">
            <label className={`text-xs ${ts} font-medium`}>Data Feed API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={inputKey}
                  onChange={e => setInputKey(e.target.value)}
                  placeholder="Paste your market data API key..."
                  className={`w-full ${inputBg} border rounded-lg px-3 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 pr-10 transition-all`}
                  onKeyDown={e => e.key === "Enter" && handleValidate()}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${ts} hover:text-gray-400`}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleValidate}
                disabled={validating}
                className="px-4 py-2.5 rounded-lg font-bold text-sm text-black transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
                style={{ background: themeColor, boxShadow: `0 4px 16px ${themeColor}40` }}
              >
                {validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {validating ? "..." : "Connect"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex-1 h-px ${isDark ? "bg-gray-800/60" : "bg-gray-200"}`} />
            <span className={`text-[10px] ${ts}`}>or</span>
            <div className={`flex-1 h-px ${isDark ? "bg-gray-800/60" : "bg-gray-200"}`} />
          </div>

          <button
            onClick={handleDemoMode}
            className="w-full py-2.5 rounded-lg border border-amber-700/40 bg-amber-950/20 text-amber-400 text-sm font-medium hover:bg-amber-950/30 transition-all duration-200"
          >
            ⚡ Use Demo Mode (Simulated Signals)
          </button>

          <p className={`text-[10px] ${ts} text-center`}>
            🔒 Your key is stored locally only. Never transmitted to third parties.
          </p>
        </div>
      )}
    </div>
  );
};

export default APIKeySetup;
