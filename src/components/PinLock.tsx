import React, { useState, useEffect } from "react";
import logoIcon from "@/assets/logo-icon.png";

interface PinLockProps {
  onUnlock: () => void;
}

const CORRECT_PIN = "707078";

const PinLock: React.FC<PinLockProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (pin.length === 6) {
      if (pin === CORRECT_PIN) {
        setSuccess(true);
        setTimeout(() => onUnlock(), 800);
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setPin("");
          setError(false);
          setShake(false);
        }, 700);
      }
    }
  }, [pin, onUnlock]);

  const handleKey = (val: string) => {
    if (pin.length < 6) setPin(p => p + val);
  };

  const handleBackspace = () => {
    setPin(p => p.slice(0, -1));
  };

  const keys = ["1","2","3","4","5","6","7","8","9","*","0","⌫"];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#030b14] z-[9999] overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-black to-cyan-950/30" />
        {Array.from({length: 20}).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10 animate-pulse"
            style={{
              width: `${20 + i * 15}px`,
              height: `${20 + i * 15}px`,
              background: i % 2 === 0 ? "#00ff88" : "#00ccff",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + i * 0.5}s`,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent,2px,rgba(0,255,136,0.03)_2px,rgba(0,255,136,0.03)_4px)]" />
      </div>

      <div className={`relative z-10 flex flex-col items-center gap-6 transition-all duration-300 ${shake ? "animate-bounce" : ""}`}>
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl animate-pulse" />
            <img src={logoIcon} alt="Logo" className="w-20 h-20 relative z-10 drop-shadow-[0_0_20px_rgba(0,255,136,0.8)]" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 tracking-wider">
              SUPER-BINARY-ANALYSER
            </h1>
            <p className="text-emerald-500/60 text-xs mt-1 tracking-[0.3em]">SECURE ACCESS REQUIRED</p>
          </div>
        </div>

        {/* PIN Display */}
        <div className={`flex gap-3 p-4 rounded-2xl border ${error ? "border-red-500/60 bg-red-950/20" : success ? "border-emerald-500/60 bg-emerald-950/20" : "border-emerald-800/30 bg-black/40"} backdrop-blur-xl`}>
          {Array.from({length: 6}).map((_, i) => (
            <div
              key={i}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold border transition-all duration-200 ${
                pin.length > i
                  ? success
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(0,255,136,0.5)]"
                    : error
                    ? "border-red-400 bg-red-500/20 text-red-300"
                    : "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(0,255,136,0.3)]"
                  : "border-gray-700/50 bg-gray-900/20 text-transparent"
              }`}
            >
              {pin.length > i ? "●" : "○"}
            </div>
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm font-medium animate-pulse">Incorrect PIN. Try again.</p>
        )}
        {success && (
          <p className="text-emerald-400 text-sm font-medium animate-pulse">Access Granted ✓</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {keys.map((key) => (
            <button
              key={key}
              onClick={() => key === "⌫" ? handleBackspace() : key !== "*" ? handleKey(key) : null}
              disabled={key === "*"}
              className={`w-16 h-16 rounded-xl text-xl font-bold transition-all duration-150 border backdrop-blur-sm
                ${key === "⌫"
                  ? "border-orange-700/50 bg-orange-950/30 text-orange-400 hover:bg-orange-900/40 hover:border-orange-500/60 hover:shadow-[0_0_12px_rgba(255,100,0,0.3)] active:scale-95"
                  : key === "*"
                  ? "opacity-0 pointer-events-none"
                  : "border-emerald-800/30 bg-black/40 text-emerald-300 hover:bg-emerald-950/40 hover:border-emerald-500/50 hover:shadow-[0_0_12px_rgba(0,255,136,0.25)] active:scale-95"
                }`}
            >
              {key}
            </button>
          ))}
        </div>

        <p className="text-gray-600 text-xs tracking-widest">ENTER 6-DIGIT PIN</p>
      </div>
    </div>
  );
};

export default PinLock;
