import {
  CandleData, Signal, SignalDirection, SignalStrength, IndicatorResult,
} from "@/types";
import {
  calculateRSI, calculateATR, findSupportResistance, detectCandlePattern,
  detectManipulation, detectTrend, runAllIndicators,
  detectLiquidityZones, detectMarketStructure, analyzeVolume,
  calculateBollingerBands,
} from "@/lib/indicators";
import { analyzePriceAction, runConfirmation, analyzeCandlePower, detectMarketZone } from "@/lib/priceAction";
import { getMarketSession, getSessionQuality, formatBDTime, getBangladeshTime } from "@/lib/marketUtils";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ── Direction History (anti-repetition per pair) ──────────────────────────────
const pairDirectionHistory: Map<string, SignalDirection[]> = new Map();
const MAX_HISTORY = 6;

function getDirectionHistory(pair: string): SignalDirection[] { return pairDirectionHistory.get(pair) || []; }
function updateDirectionHistory(pair: string, direction: SignalDirection) {
  const h = getDirectionHistory(pair);
  h.push(direction);
  if (h.length > MAX_HISTORY) h.shift();
  pairDirectionHistory.set(pair, h);
}
function getSameDirectionStreak(pair: string, direction: SignalDirection): number {
  const h = getDirectionHistory(pair);
  let s = 0;
  for (let i = h.length - 1; i >= 0; i--) { if (h[i] === direction) s++; else break; }
  return s;
}

function forceDirection(buyScore: number, sellScore: number, candles: CandleData[]): "BUY" | "SELL" {
  if (buyScore !== sellScore) return buyScore > sellScore ? "BUY" : "SELL";
  // Tie-break: last 3 candles momentum
  const last3 = candles.slice(-3);
  const bullCount = last3.filter(c => c.close > c.open).length;
  return bullCount >= 2 ? "BUY" : "SELL";
}

function applyStreakPenalty(pair: string, buyScore: number, sellScore: number, prelimDir: "BUY" | "SELL"): "BUY" | "SELL" {
  const signalDir: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, signalDir);
  if (streak >= 3) {
    const opp = prelimDir === "BUY" ? sellScore : buyScore;
    const total = buyScore + sellScore;
    if (total > 0 && opp / total >= 0.32) return prelimDir === "BUY" ? "SELL" : "BUY";
  }
  return prelimDir;
}

// ── Session-specific BB thresholds ───────────────────────────────────────────
// Different sessions have different volatility profiles; we tune per-session
function getSessionBBThresholds(sessionName: string): { oversold: number; overbought: number; midLow: number; midHigh: number } {
  const s = sessionName.toLowerCase();
  if (s.includes("overlap") || s.includes("london") || s.includes("new york")) {
    // High volatility sessions — wider bands tolerated
    return { oversold: 0.08, overbought: 0.92, midLow: 0.38, midHigh: 0.62 };
  }
  if (s.includes("tokyo") || s.includes("asia")) {
    // Medium volatility
    return { oversold: 0.12, overbought: 0.88, midLow: 0.40, midHigh: 0.60 };
  }
  // Sydney / Pacific — lower volatility
  return { oversold: 0.15, overbought: 0.85, midLow: 0.42, midHigh: 0.58 };
}

// ── Bollinger Band scoring (PRIMARY — highest weight) ─────────────────────────
function scoreBollingerBands(closes: number[], sessionLabel: string): {
  buyScore: number; sellScore: number; weight: number; label: string; signal: "BUY" | "SELL" | "NEUTRAL"
} {
  const bb = calculateBollingerBands(closes);
  const weight = 34; // Highest weight
  const thr = getSessionBBThresholds(sessionLabel);
  let buyScore = 0, sellScore = 0, signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let label = `%B:${(bb.percentB * 100).toFixed(1)}%`;

  // Priority: strongest signals first
  if (bb.breakout === "LOWER" || bb.percentB <= thr.oversold) {
    buyScore = weight;
    signal = "BUY";
    label += bb.squeeze ? " (Squeeze↑)" : " (Oversold)";
  } else if (bb.breakout === "UPPER" || (bb.percentB >= thr.overbought)) {
    sellScore = weight;
    signal = "SELL";
    label += bb.squeeze ? " (Squeeze↓)" : " (Overbought)";
  } else if (bb.bbSignal === "STRONG_BUY") {
    buyScore = weight;
    signal = "BUY";
    label += " (StrongBUY)";
  } else if (bb.bbSignal === "STRONG_SELL") {
    sellScore = weight;
    signal = "SELL";
    label += " (StrongSELL)";
  } else if (bb.bbSignal === "BUY" || bb.percentB < thr.midLow) {
    buyScore = weight * 0.85;
    signal = "BUY";
    label += bb.squeeze ? " (SQZ↑)" : bb.walkingBand === "LOWER" ? " (Walk↓)" : "";
  } else if (bb.bbSignal === "SELL" || bb.percentB > thr.midHigh) {
    sellScore = weight * 0.85;
    signal = "SELL";
    label += bb.squeeze ? " (SQZ↓)" : bb.walkingBand === "UPPER" ? " (Walk↑)" : "";
  } else {
    // Neutral zone — resolve via squeeze momentum
    if (bb.squeezeMomentum > 0) { buyScore = weight * 0.5; signal = "BUY"; }
    else if (bb.squeezeMomentum < 0) { sellScore = weight * 0.5; signal = "SELL"; }
    else {
      // Last resort — micro bias
      if (bb.percentB < 0.5) { buyScore = weight * 0.42; signal = "BUY"; }
      else { sellScore = weight * 0.42; signal = "SELL"; }
    }
  }

  // Bonus for squeeze + breakout confluence
  if (bb.squeeze && (bb.breakout !== "NONE")) {
    if (signal === "BUY") buyScore = Math.min(weight, buyScore * 1.15);
    else if (signal === "SELL") sellScore = Math.min(weight, sellScore * 1.15);
  }

  return { buyScore, sellScore, weight, label, signal };
}

// ── RSI Session-Aware Scoring ─────────────────────────────────────────────────
function scoreRSIForSession(rsi: number, sessionLabel: string): "BUY" | "SELL" | "NEUTRAL" {
  const s = sessionLabel.toLowerCase();
  let obLevel = 65, osLevel = 35;
  if (s.includes("overlap")) { obLevel = 60; osLevel = 40; } // tighter for volatile sessions
  if (s.includes("sydney") || s.includes("pacific")) { obLevel = 70; osLevel = 30; } // wider for quiet sessions
  if (rsi <= osLevel) return "BUY";
  if (rsi >= obLevel) return "SELL";
  if (rsi < 47) return "BUY";
  if (rsi > 53) return "SELL";
  return "NEUTRAL";
}

// ── Main signal generator ─────────────────────────────────────────────────────
export function generateSignal(pair: string, candles: CandleData[]): Signal | null {
  if (!candles || candles.length < 20) return null;

  const closes = candles.map(c => c.close);
  const { session, label: sessionLabel } = getMarketSession();
  const sessionQuality = getSessionQuality(session);
  const atr = calculateATR(candles);

  let buyRaw = 0, sellRaw = 0, totalWeight = 0;

  // ── 1. Bollinger Bands (PRIMARY — weight 34) ─────────────────────────────
  const bbScore = scoreBollingerBands(closes, sessionLabel);
  totalWeight += bbScore.weight;
  buyRaw += bbScore.buyScore;
  sellRaw += bbScore.sellScore;

  // ── 2. All other indicators ───────────────────────────────────────────────
  const indicators = runAllIndicators(candles);
  for (const ind of indicators) {
    totalWeight += ind.weight;
    if (ind.signal === "BUY") buyRaw += ind.weight;
    else if (ind.signal === "SELL") sellRaw += ind.weight;
    else {
      // NEUTRAL → session-aware micro-bias
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      const microBull = last.close > last.open && last.close > prev.close;
      const bias = sessionLabel.toLowerCase().includes("overlap") ? 0.45 : 0.40;
      if (microBull) buyRaw += ind.weight * bias; else sellRaw += ind.weight * bias;
    }
  }

  // ── 3. Candlestick pattern (weight 24) ───────────────────────────────────
  const pattern = detectCandlePattern(candles);
  const patternWeight = 24;
  totalWeight += patternWeight;
  if (pattern.bias === "BULLISH") buyRaw += (pattern.strength / 100) * patternWeight;
  else if (pattern.bias === "BEARISH") sellRaw += (pattern.strength / 100) * patternWeight;
  else {
    const lc = candles[candles.length - 1];
    if (lc.close > lc.open) buyRaw += patternWeight * 0.38; else sellRaw += patternWeight * 0.38;
  }

  // ── 4. Trend (weight 20) ─────────────────────────────────────────────────
  const trend = detectTrend(closes);
  const trendWeight = 20;
  totalWeight += trendWeight;
  if (trend.trend === "UPTREND") buyRaw += trendWeight * (1 + trend.strength / 200);
  else if (trend.trend === "DOWNTREND") sellRaw += trendWeight * (1 + trend.strength / 200);
  else {
    const n = closes.length;
    const micro = closes[n - 1] - closes[n - 4];
    if (micro > 0) buyRaw += trendWeight * 0.50;
    else if (micro < 0) sellRaw += trendWeight * 0.50;
    else buyRaw += trendWeight * 0.25;
  }

  // ── 5. Liquidity (weight 18) ─────────────────────────────────────────────
  const liquidity = detectLiquidityZones(candles, atr);
  const liqWeight = 18;
  totalWeight += liqWeight;
  if (liquidity.buyLiquidity) buyRaw += (liquidity.strength / 100) * liqWeight * 1.1;
  else if (liquidity.sellLiquidity) sellRaw += (liquidity.strength / 100) * liqWeight * 1.1;
  else { const lc = candles[candles.length - 1]; if (lc.close > lc.open) buyRaw += liqWeight * 0.28; else sellRaw += liqWeight * 0.28; }

  // ── 6. Market Structure BOS/CHoCH (weight 18) ────────────────────────────
  const structure = detectMarketStructure(candles);
  const bosWeight = 18;
  totalWeight += bosWeight;
  if (structure.bos === "BULLISH" || structure.choch === "BULLISH") buyRaw += bosWeight;
  else if (structure.bos === "BEARISH" || structure.choch === "BEARISH") sellRaw += bosWeight;
  else { const lc = candles[candles.length - 1]; if (lc.close > lc.open) buyRaw += bosWeight * 0.38; else sellRaw += bosWeight * 0.38; }

  // ── 7. Price Action (weight 28) ──────────────────────────────────────────
  const priceAction = analyzePriceAction(candles, atr);
  const paWeight = 28;
  totalWeight += paWeight;
  if (priceAction.priceActionSignal === "BUY") buyRaw += paWeight * (1 + priceAction.zoneStrength / 180);
  else if (priceAction.priceActionSignal === "SELL") sellRaw += paWeight * (1 + priceAction.zoneStrength / 180);
  else {
    if (priceAction.momentum > 5) buyRaw += paWeight * 0.52;
    else if (priceAction.momentum < -5) sellRaw += paWeight * 0.52;
    else if (priceAction.momentum >= 0) buyRaw += paWeight * 0.36; else sellRaw += paWeight * 0.36;
  }

  // ── 8. Candle Power (weight 16) ──────────────────────────────────────────
  const candlePowerData = analyzeCandlePower(candles);
  const cpWeight = 16;
  totalWeight += cpWeight;
  if (candlePowerData.dominance === "BUYER") buyRaw += cpWeight * (candlePowerData.buyerStrength / 100);
  else if (candlePowerData.dominance === "SELLER") sellRaw += cpWeight * (candlePowerData.sellerStrength / 100);
  else { buyRaw += cpWeight * (candlePowerData.buyerStrength / 100); sellRaw += cpWeight * (candlePowerData.sellerStrength / 100); }

  // ── 9. Market Zone (weight 14) ───────────────────────────────────────────
  const marketZone = detectMarketZone(candles, atr);
  const mzWeight = 14;
  totalWeight += mzWeight;
  if (marketZone.zone === "SUPPORT") buyRaw += mzWeight * (Math.max(35, marketZone.zoneStrength) / 100);
  else if (marketZone.zone === "RESISTANCE") sellRaw += mzWeight * (Math.max(35, marketZone.zoneStrength) / 100);
  else { if (priceAction.momentum >= 0) buyRaw += mzWeight * 0.38; else sellRaw += mzWeight * 0.38; }

  // ── 10. S/R Proximity (weight 12) ────────────────────────────────────────
  const sr = findSupportResistance(candles);
  const srWeight = 12;
  totalWeight += srWeight;
  const lastClose = closes[closes.length - 1];
  if (atr > 0) {
    const distSup = lastClose - sr.support, distRes = sr.resistance - lastClose;
    if (distSup < atr * 0.7 && distSup < distRes) buyRaw += srWeight;
    else if (distRes < atr * 0.7 && distRes < distSup) sellRaw += srWeight;
    else if (lastClose > (sr.support + sr.resistance) / 2) buyRaw += srWeight * 0.32; else sellRaw += srWeight * 0.32;
  }

  // ── 11. Volume (weight 10) ───────────────────────────────────────────────
  const volume = analyzeVolume(candles);
  const volWeight = 10;
  totalWeight += volWeight;
  const lastC = candles[candles.length - 1];
  if (volume.trend === "INCREASING") { if (lastC.close > lastC.open) buyRaw += volWeight * 1.1; else sellRaw += volWeight * 1.1; }
  else { if (lastC.close > lastC.open) buyRaw += volWeight * 0.42; else sellRaw += volWeight * 0.42; }

  // ── Manipulation guard ────────────────────────────────────────────────────
  const manip = detectManipulation(candles, atr);
  if (manip.detected) { buyRaw *= 0.60; sellRaw *= 0.60; }

  // ── Session quality multiplier ────────────────────────────────────────────
  const buyScore = buyRaw * sessionQuality;
  const sellScore = sellRaw * sessionQuality;
  const buyPct = (buyScore / totalWeight) * 100;
  const sellPct = (sellScore / totalWeight) * 100;
  const diff = Math.abs(buyPct - sellPct);

  // ── Force direction — never neutral ──────────────────────────────────────
  let prelimDir = forceDirection(buyScore, sellScore, candles);
  prelimDir = applyStreakPenalty(pair, buyScore, sellScore, prelimDir);

  // ── 5-Second Confirmation ─────────────────────────────────────────────────
  const confirmation = runConfirmation(candles, prelimDir);
  if (!confirmation.confirmed && confirmation.score < 25 && diff < 6) {
    // Flip if other side has meaningful mass
    prelimDir = prelimDir === "BUY" ? "SELL" : "BUY";
  }

  const direction: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";

  // ── Confidence calculation ────────────────────────────────────────────────
  const bb = calculateBollingerBands(closes);
  const bbBonus = bb.bbSignal === "STRONG_BUY" || bb.bbSignal === "STRONG_SELL" ? 7 :
                  bb.bbSignal === "BUY" || bb.bbSignal === "SELL" ? 4 : 0;
  const squeezeBonus = bb.squeeze ? 5 : 0;
  const breakoutBonus = bb.breakout !== "NONE" ? 4 : 0;
  const trendBonus = trend.trend !== "SIDEWAYS" ? 3 : 0;
  const structureBonus = (structure.bos !== "NONE" || structure.choch !== "NONE") ? 3 : 0;
  const liquidityBonus = liquidity.liquidityType !== "None" ? 2 : 0;

  const sessionBonus = session === "OVERLAP" ? 6 : session === "LONDON" || session === "NEW_YORK" ? 4 : session === "TOKYO" ? 2 : 1;

  const streakDir: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, streakDir);
  const streakPenalty = streak >= 2 ? streak * 1.5 : 0;
  const manipPenalty = manip.detected ? 8 : 0;

  const rawConf = 58 + diff * 1.9 + confirmation.score * 0.13 + bbBonus + squeezeBonus + breakoutBonus + trendBonus + structureBonus + liquidityBonus;
  const confidence = Math.min(97, Math.max(64, rawConf - manipPenalty + sessionBonus - streakPenalty));
  const roundedConf = Math.round(confidence);

  const strength: SignalStrength = roundedConf >= 84 ? "STRONG" : roundedConf >= 72 ? "MODERATE" : "WEAK";

  const rsi = calculateRSI(closes);
  const now = new Date();

  // ── Future timezone: Bangladesh (UTC+6) ───────────────────────────────────
  const bdNow = getBangladeshTime();
  const secondsLeft = 60 - bdNow.getSeconds();
  const nextCandleOpenBD = new Date(bdNow.getTime() + secondsLeft * 1000);
  const expiryBD = new Date(nextCandleOpenBD.getTime() + 60 * 1000);

  const liqSuffix = liquidity.liquidityType !== "None" ? ` • ${liquidity.liquidityType}` : "";
  const manipSuffix = manip.detected ? ` ⚠️${manip.reason}` : "";
  const bbSuffix = bb.squeeze ? " • BB Squeeze" : bb.breakout !== "NONE" ? ` • BB ${bb.breakout === "UPPER" ? "↑Break" : "↓Break"}` : "";

  const fullIndicators: IndicatorResult[] = [
    { name: "Bollinger Bands ★", value: bbScore.label, signal: bbScore.signal, weight: bbScore.weight },
    ...indicators,
  ];

  updateDirectionHistory(pair, direction);

  return {
    id: generateId(),
    pair,
    direction,
    strength,
    confidence: roundedConf,
    timestamp: now,
    expiry: "1 Min",
    indicators: fullIndicators,
    sessionName: sessionLabel,
    entryTime: formatBDTime(nextCandleOpenBD) + " BDT",
    expiryTime: formatBDTime(expiryBD) + " BDT",
    rsi: parseFloat(rsi.toFixed(2)),
    trend: trend.trend,
    pattern: pattern.pattern + liqSuffix + manipSuffix + bbSuffix,
    liquidityType: liquidity.liquidityType,
    bosType: structure.bos !== "NONE" ? structure.bos : structure.choch !== "NONE" ? structure.choch : undefined,
    candlePower: candlePowerData.power,
    buyerStrength: candlePowerData.buyerStrength,
    sellerStrength: candlePowerData.sellerStrength,
    marketZone: marketZone.label,
    priceAction: priceAction.priceActionSignal,
    confirmationScore: confirmation.score,
  };
}

// ── Demo signal generator ─────────────────────────────────────────────────────
const demoDirectionHistory: Map<string, SignalDirection[]> = new Map();

export function generateDemoSignal(pair: string): Signal {
  const { label: sessionLabel } = getMarketSession();
  const minuteSeed = Math.floor(Date.now() / 60000);
  const pairSeed = pair.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  // Use multiple seeds for better distribution
  const seed = (pairSeed * 9973 + minuteSeed * 6991 + 314159) % 1000003;
  const rand = (offset = 0) => ((seed * 9301 + offset * 49297 + 233917) % 233280) / 233280;

  // Session-aware demo bias — simulate real market behavior per session
  const sessionFactor = sessionLabel.toLowerCase().includes("overlap") ? 0.55 :
                        sessionLabel.toLowerCase().includes("london") || sessionLabel.toLowerCase().includes("new york") ? 0.52 : 0.50;

  const rawBias = rand(1);
  const demoHistory = demoDirectionHistory.get(pair) || [];
  let direction: SignalDirection;
  const lastTwo = demoHistory.slice(-2);
  const allSame = lastTwo.length === 2 && lastTwo[0] === lastTwo[1];

  if (allSame && rand(15) > 0.42) direction = lastTwo[0] === "CALL" ? "PUT" : "CALL";
  else direction = rawBias < sessionFactor ? "CALL" : "PUT";

  demoHistory.push(direction);
  if (demoHistory.length > MAX_HISTORY) demoHistory.shift();
  demoDirectionHistory.set(pair, demoHistory);

  // Session-aware confidence — overlap gets higher confidence range
  const confBase = sessionLabel.toLowerCase().includes("overlap") ? 70 :
                   sessionLabel.toLowerCase().includes("london") || sessionLabel.toLowerCase().includes("new york") ? 68 : 65;
  const confidence = Math.round(confBase + rand(2) * 25);
  const strength: SignalStrength = confidence >= 84 ? "STRONG" : confidence >= 72 ? "MODERATE" : "WEAK";
  const s: "BUY" | "SELL" = direction === "CALL" ? "BUY" : "SELL";

  const rsiVal = direction === "CALL"
    ? parseFloat((18 + rand(3) * 22).toFixed(2))
    : parseFloat((56 + rand(3) * 26).toFixed(2));

  const buyerStr = direction === "CALL" ? Math.round(60 + rand(8) * 28) : Math.round(20 + rand(8) * 22);
  const sellerStr = 100 - buyerStr;
  const candlePwr = Math.round(52 + rand(9) * 40);
  const confirmScore = Math.round(62 + rand(10) * 28);

  // BB demo data — session-aware thresholds
  const bbPctB = direction === "CALL" ? rand(20) * 0.20 : 0.80 + rand(20) * 0.20;
  const bbSqueeze = rand(21) > 0.55;
  const bbBreakout = rand(22) > 0.70 ? (direction === "CALL" ? "↓Break" : "↑Break") : "";
  const bbLabel = `%B:${(bbPctB * 100).toFixed(1)}%${bbSqueeze ? " (Squeeze)" : ""}${bbBreakout ? ` ${bbBreakout}` : ""}`;

  const liqTypes = ["Bullish Order Block", "Bearish Order Block", "Liquidity Grab (Bullish)", "Liquidity Grab (Bearish)"];
  const liqType = direction === "CALL" ? liqTypes[Math.floor(rand(7) * 2)] : liqTypes[1 + Math.floor(rand(7) * 2)];
  const zones = ["Support Zone", "Resistance Zone", "Supply Zone", "Demand Zone", "Key Level", "Fair Value Gap"];
  const zoneLabel = direction === "CALL" ? zones[Math.floor(rand(11) * 2)] : zones[1 + Math.floor(rand(11) * 3)];
  const paPatterns = ["Bullish Rejection", "Bearish Rejection", "Pin Bar Reversal", "Inside Bar Break", "Momentum Surge", "Pullback Entry"];
  const paLabel = direction === "CALL" ? paPatterns[Math.floor(rand(12) * 3)] : paPatterns[3 + Math.floor(rand(12) * 3)];
  const patterns = direction === "CALL"
    ? ["Morning Star", "Bullish Engulfing", "Hammer", "Three White Soldiers", "Bullish Marubozu", "Piercing Line"]
    : ["Evening Star", "Bearish Engulfing", "Shooting Star", "Three Black Crows", "Bearish Marubozu", "Dark Cloud Cover"];
  const patternName = patterns[Math.floor(rand(6) * patterns.length)];

  const adxVal = (22 + rand(5) * 20).toFixed(1);
  const plusDI = direction === "CALL" ? (28 + rand(13) * 10).toFixed(1) : (12 + rand(13) * 8).toFixed(1);
  const macdVal = direction === "CALL" ? (0.00008 + rand(30) * 0.0002).toFixed(6) : -(0.00006 + rand(30) * 0.0002).toFixed(6);

  const indicators: IndicatorResult[] = [
    { name: "Bollinger Bands ★", value: bbLabel, signal: s, weight: 34 },
    { name: "RSI (14)", value: rsiVal.toString(), signal: s, weight: 18 },
    { name: "MACD", value: macdVal, signal: s, weight: 16 },
    { name: "Stochastic", value: `K:${direction === "CALL" ? (15 + rand(14) * 12).toFixed(1) : (78 + rand(14) * 10).toFixed(1)} D:${direction === "CALL" ? "14.8" : "80.2"}`, signal: s, weight: 14 },
    { name: "Williams %R", value: direction === "CALL" ? (-85 - rand(15) * 12).toFixed(1) : (-8 - rand(15) * 10).toFixed(1), signal: s, weight: 10 },
    { name: "CCI (20)", value: direction === "CALL" ? (-125 - rand(16) * 40).toFixed(1) : (128 + rand(16) * 40).toFixed(1), signal: s, weight: 10 },
    { name: "ADX/DI", value: `ADX:${adxVal} +DI:${plusDI}`, signal: s, weight: 9 },
    { name: "Ichimoku", value: direction === "CALL" ? "T>K Bull" : "T<K Bear", signal: s, weight: 9 },
    { name: "EMA Trend", value: direction === "CALL" ? "UPTREND" : "DOWNTREND", signal: s, weight: 7 },
    { name: "ROC (10)", value: direction === "CALL" ? (0.06 + rand(17) * 0.08).toFixed(4) : -(0.05 + rand(17) * 0.08).toFixed(4), signal: s, weight: 6 },
    { name: "Price Action", value: paLabel, signal: s, weight: 28 },
    { name: "Candle Power", value: `${candlePwr}% body`, signal: s, weight: 16 },
  ];

  const now = new Date();
  const bdNow = getBangladeshTime();
  const secondsLeft = 60 - bdNow.getSeconds();
  const nextCandleOpenBD = new Date(bdNow.getTime() + secondsLeft * 1000);
  const expiryBD = new Date(nextCandleOpenBD.getTime() + 60 * 1000);

  return {
    id: generateId(),
    pair,
    direction,
    strength,
    confidence,
    timestamp: now,
    expiry: "1 Min",
    indicators,
    sessionName: sessionLabel,
    entryTime: formatBDTime(nextCandleOpenBD) + " BDT",
    expiryTime: formatBDTime(expiryBD) + " BDT",
    rsi: rsiVal,
    trend: direction === "CALL" ? "UPTREND" : "DOWNTREND",
    pattern: `${patternName} • ${liqType}${bbSqueeze ? " • BB Squeeze" : ""}${bbBreakout ? ` • BB ${bbBreakout}` : ""}`,
    liquidityType: liqType,
    bosType: direction === "CALL" ? "BULLISH" : "BEARISH",
    candlePower: candlePwr,
    buyerStrength: buyerStr,
    sellerStrength: sellerStr,
    marketZone: zoneLabel,
    priceAction: direction === "CALL" ? "BUY" : "SELL",
    confirmationScore: confirmScore,
  };
}
