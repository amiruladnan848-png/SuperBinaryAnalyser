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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Direction History for anti-repetition ─────────────────────────────────────
const pairDirectionHistory: Map<string, SignalDirection[]> = new Map();
const MAX_HISTORY = 5;

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
  const last = candles[candles.length - 1];
  return last.close >= last.open ? "BUY" : "SELL";
}

function applyStreakPenalty(pair: string, buyScore: number, sellScore: number, prelimDir: "BUY" | "SELL"): "BUY" | "SELL" {
  const signalDir: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, signalDir);
  if (streak >= 3) {
    const opp = prelimDir === "BUY" ? sellScore : buyScore;
    const total = buyScore + sellScore;
    if (total > 0 && opp / total >= 0.35) return prelimDir === "BUY" ? "SELL" : "BUY";
  }
  return prelimDir;
}

// ── Bollinger Band core logic (primary indicator) ─────────────────────────────
function scoreBollingerBands(closes: number[]): { buyScore: number; sellScore: number; weight: number; label: string; signal: "BUY" | "SELL" | "NEUTRAL" } {
  const bb = calculateBollingerBands(closes);
  const weight = 32; // Highest weight — BB is primary indicator
  let buyScore = 0, sellScore = 0, signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let label = `%B:${(bb.percentB * 100).toFixed(1)}%`;

  if (bb.bbSignal === "STRONG_BUY") {
    buyScore = weight;
    signal = "BUY";
    label += bb.squeeze ? " (Squeeze↑)" : bb.breakout === "LOWER" ? " (Breakout↓→CALL)" : " (Oversold)";
  } else if (bb.bbSignal === "STRONG_SELL") {
    sellScore = weight;
    signal = "SELL";
    label += bb.squeeze ? " (Squeeze↓)" : bb.breakout === "UPPER" ? " (Breakout↑→PUT)" : " (Overbought)";
  } else if (bb.bbSignal === "BUY") {
    buyScore = weight * 0.82;
    signal = "BUY";
    label += bb.walkingBand === "LOWER" ? " (Walk↓)" : bb.squeeze ? " (SQZ BUY)" : "";
  } else if (bb.bbSignal === "SELL") {
    sellScore = weight * 0.82;
    signal = "SELL";
    label += bb.walkingBand === "UPPER" ? " (Walk↑)" : bb.squeeze ? " (SQZ SELL)" : "";
  } else {
    // Resolve NEUTRAL via %B position
    if (bb.percentB < 0.5) { buyScore = weight * 0.4; signal = "BUY"; }
    else { sellScore = weight * 0.4; signal = "SELL"; }
  }

  return { buyScore, sellScore, weight, label, signal };
}

export function generateSignal(pair: string, candles: CandleData[]): Signal | null {
  if (!candles || candles.length < 20) return null;

  const closes = candles.map(c => c.close);
  const { session, label: sessionLabel } = getMarketSession();
  const sessionQuality = getSessionQuality(session);
  const atr = calculateATR(candles);

  let buyRaw = 0, sellRaw = 0, totalWeight = 0;

  // ── 1. Bollinger Bands (PRIMARY — highest weight 32) ─────────────────────
  const bbScore = scoreBollingerBands(closes);
  totalWeight += bbScore.weight;
  buyRaw += bbScore.buyScore;
  sellRaw += bbScore.sellScore;

  // ── 2. All other indicators (weighted) ────────────────────────────────────
  const indicators = runAllIndicators(candles);
  for (const ind of indicators) {
    totalWeight += ind.weight;
    if (ind.signal === "BUY") buyRaw += ind.weight;
    else if (ind.signal === "SELL") sellRaw += ind.weight;
    else {
      // NEUTRAL → micro-bias resolution
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      const microBull = last.close > last.open && last.close > prev.close;
      if (microBull) buyRaw += ind.weight * 0.40;
      else sellRaw += ind.weight * 0.40;
    }
  }

  // ── 3. Candlestick pattern ─────────────────────────────────────────────────
  const pattern = detectCandlePattern(candles);
  const patternWeight = 22;
  totalWeight += patternWeight;
  if (pattern.bias === "BULLISH") buyRaw += (pattern.strength / 100) * patternWeight;
  else if (pattern.bias === "BEARISH") sellRaw += (pattern.strength / 100) * patternWeight;
  else {
    const lc = candles[candles.length - 1];
    if (lc.close > lc.open) buyRaw += patternWeight * 0.38; else sellRaw += patternWeight * 0.38;
  }

  // ── 4. Trend ──────────────────────────────────────────────────────────────
  const trend = detectTrend(closes);
  const trendWeight = 18;
  totalWeight += trendWeight;
  if (trend.trend === "UPTREND") buyRaw += trendWeight;
  else if (trend.trend === "DOWNTREND") sellRaw += trendWeight;
  else {
    const n = closes.length;
    const micro = closes[n - 1] - closes[n - 4];
    if (micro > 0) buyRaw += trendWeight * 0.50; else if (micro < 0) sellRaw += trendWeight * 0.50;
    else buyRaw += trendWeight * 0.25;
  }

  // ── 5. Liquidity ──────────────────────────────────────────────────────────
  const liquidity = detectLiquidityZones(candles, atr);
  const liqWeight = 18;
  totalWeight += liqWeight;
  if (liquidity.buyLiquidity) buyRaw += (liquidity.strength / 100) * liqWeight;
  else if (liquidity.sellLiquidity) sellRaw += (liquidity.strength / 100) * liqWeight;
  else { const lc = candles[candles.length - 1]; if (lc.close > lc.open) buyRaw += liqWeight * 0.28; else sellRaw += liqWeight * 0.28; }

  // ── 6. Market Structure BOS/CHoCH ────────────────────────────────────────
  const structure = detectMarketStructure(candles);
  const bosWeight = 16;
  totalWeight += bosWeight;
  if (structure.bos === "BULLISH" || structure.choch === "BULLISH") buyRaw += bosWeight;
  else if (structure.bos === "BEARISH" || structure.choch === "BEARISH") sellRaw += bosWeight;
  else { const lc = candles[candles.length - 1]; if (lc.close > lc.open) buyRaw += bosWeight * 0.38; else sellRaw += bosWeight * 0.38; }

  // ── 7. Price Action ───────────────────────────────────────────────────────
  const priceAction = analyzePriceAction(candles, atr);
  const paWeight = 26;
  totalWeight += paWeight;
  if (priceAction.priceActionSignal === "BUY") buyRaw += paWeight * (1 + priceAction.zoneStrength / 200);
  else if (priceAction.priceActionSignal === "SELL") sellRaw += paWeight * (1 + priceAction.zoneStrength / 200);
  else {
    if (priceAction.momentum > 5) buyRaw += paWeight * 0.50;
    else if (priceAction.momentum < -5) sellRaw += paWeight * 0.50;
    else if (priceAction.momentum >= 0) buyRaw += paWeight * 0.36; else sellRaw += paWeight * 0.36;
  }

  // ── 8. Candle Power ───────────────────────────────────────────────────────
  const candlePowerData = analyzeCandlePower(candles);
  const cpWeight = 16;
  totalWeight += cpWeight;
  if (candlePowerData.dominance === "BUYER") buyRaw += cpWeight * (candlePowerData.buyerStrength / 100);
  else if (candlePowerData.dominance === "SELLER") sellRaw += cpWeight * (candlePowerData.sellerStrength / 100);
  else { buyRaw += cpWeight * (candlePowerData.buyerStrength / 100); sellRaw += cpWeight * (candlePowerData.sellerStrength / 100); }

  // ── 9. Market Zone ────────────────────────────────────────────────────────
  const marketZone = detectMarketZone(candles, atr);
  const mzWeight = 14;
  totalWeight += mzWeight;
  if (marketZone.zone === "SUPPORT") buyRaw += mzWeight * (Math.max(30, marketZone.zoneStrength) / 100);
  else if (marketZone.zone === "RESISTANCE") sellRaw += mzWeight * (Math.max(30, marketZone.zoneStrength) / 100);
  else { if (priceAction.momentum >= 0) buyRaw += mzWeight * 0.38; else sellRaw += mzWeight * 0.38; }

  // ── 10. S/R Proximity ────────────────────────────────────────────────────
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

  // ── 11. Volume ────────────────────────────────────────────────────────────
  const volume = analyzeVolume(candles);
  const volWeight = 10;
  totalWeight += volWeight;
  const lastC = candles[candles.length - 1];
  if (volume.trend === "INCREASING") { if (lastC.close > lastC.open) buyRaw += volWeight; else sellRaw += volWeight; }
  else { if (lastC.close > lastC.open) buyRaw += volWeight * 0.42; else sellRaw += volWeight * 0.42; }

  // ── Manipulation guard ────────────────────────────────────────────────────
  const manip = detectManipulation(candles, atr);
  if (manip.detected) { buyRaw *= 0.62; sellRaw *= 0.62; }

  // ── Session quality ───────────────────────────────────────────────────────
  const buyScore = buyRaw * sessionQuality;
  const sellScore = sellRaw * sessionQuality;
  const buyPct = (buyScore / totalWeight) * 100;
  const sellPct = (sellScore / totalWeight) * 100;
  const diff = Math.abs(buyPct - sellPct);

  // ── Force direction ───────────────────────────────────────────────────────
  let prelimDir = forceDirection(buyScore, sellScore, candles);
  prelimDir = applyStreakPenalty(pair, buyScore, sellScore, prelimDir);

  // ── 5-Second Confirmation ─────────────────────────────────────────────────
  const confirmation = runConfirmation(candles, prelimDir);
  if (!confirmation.confirmed && confirmation.score < 30 && diff < 8) {
    prelimDir = prelimDir === "BUY" ? "SELL" : "BUY";
  }

  const direction: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";

  // ── Confidence ────────────────────────────────────────────────────────────
  // Bollinger Band strength bonus
  const bb = calculateBollingerBands(closes);
  const bbBonus = bb.bbSignal === "STRONG_BUY" || bb.bbSignal === "STRONG_SELL" ? 6 : bb.bbSignal === "BUY" || bb.bbSignal === "SELL" ? 3 : 0;
  const squeezeBonus = bb.squeeze ? 4 : 0;

  const rawConf = 56 + diff * 1.8 + confirmation.score * 0.14 + bbBonus + squeezeBonus;
  const manipPenalty = manip.detected ? 7 : 0;
  const sessionBonus = session === "OVERLAP" ? 5 : session === "LONDON" || session === "NEW_YORK" ? 3 : 1;
  const streakDir: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, streakDir);
  const streakPenalty = streak >= 2 ? streak * 2 : 0;
  const confidence = Math.min(97, Math.max(63, rawConf - manipPenalty + sessionBonus - streakPenalty));
  const roundedConf = Math.round(confidence);

  const strength: SignalStrength = roundedConf >= 83 ? "STRONG" : roundedConf >= 71 ? "MODERATE" : "WEAK";

  const rsi = calculateRSI(closes);
  const now = new Date();

  // ── Future live timezone — Bangladesh (UTC+6) ─────────────────────────────
  const bdNow = getBangladeshTime();
  const secondsLeft = 60 - bdNow.getSeconds();
  const nextCandleOpenBD = new Date(bdNow.getTime() + secondsLeft * 1000);
  const expiryBD = new Date(nextCandleOpenBD.getTime() + 60 * 1000);

  const liqSuffix = liquidity.liquidityType !== "None" ? ` • ${liquidity.liquidityType}` : "";
  const manipSuffix = manip.detected ? ` ⚠️${manip.reason}` : "";
  const bbSuffix = bb.squeeze ? " • BB Squeeze" : bb.breakout !== "NONE" ? ` • BB ${bb.breakout === "UPPER" ? "↑Break" : "↓Break"}` : "";

  // Add BB indicator to indicator list with its result
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
  const seed = (pairSeed * 9973 + minuteSeed * 6991 + 314159) % 1000003;
  const rand = (offset = 0) => ((seed * 9301 + offset * 49297 + 233917) % 233280) / 233280;

  const rawBias = rand(1);
  const demoHistory = demoDirectionHistory.get(pair) || [];
  let direction: SignalDirection;
  const lastTwo = demoHistory.slice(-2);
  const allSame = lastTwo.length === 2 && lastTwo[0] === lastTwo[1];

  if (allSame && rand(15) > 0.45) direction = lastTwo[0] === "CALL" ? "PUT" : "CALL";
  else direction = rawBias < 0.52 ? "CALL" : "PUT";

  demoHistory.push(direction);
  if (demoHistory.length > MAX_HISTORY) demoHistory.shift();
  demoDirectionHistory.set(pair, demoHistory);

  const confidence = Math.round(66 + rand(2) * 28);
  const strength: SignalStrength = confidence >= 83 ? "STRONG" : confidence >= 71 ? "MODERATE" : "WEAK";
  const s: "BUY" | "SELL" = direction === "CALL" ? "BUY" : "SELL";

  const rsiVal = direction === "CALL" ? parseFloat((22 + rand(3) * 24).toFixed(2)) : parseFloat((54 + rand(3) * 24).toFixed(2));
  const buyerStr = direction === "CALL" ? Math.round(58 + rand(8) * 28) : Math.round(22 + rand(8) * 24);
  const sellerStr = 100 - buyerStr;
  const candlePwr = Math.round(50 + rand(9) * 42);
  const confirmScore = Math.round(60 + rand(10) * 30);

  // BB demo data
  const bbPctB = direction === "CALL" ? rand(20) * 0.25 : 0.75 + rand(20) * 0.25;
  const bbSqueeze = rand(21) > 0.6;
  const bbLabel = `%B:${(bbPctB * 100).toFixed(1)}%${bbSqueeze ? " (Squeeze)" : ""}`;

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

  const indicators: IndicatorResult[] = [
    { name: "Bollinger Bands ★", value: bbLabel, signal: s, weight: 32 },
    { name: "RSI (14)", value: rsiVal.toString(), signal: s, weight: 18 },
    { name: "MACD", value: direction === "CALL" ? "0.000148" : "-0.000102", signal: s, weight: 16 },
    { name: "Stochastic", value: `K:${direction === "CALL" ? "18.7" : "82.4"} D:${direction === "CALL" ? "15.2" : "79.1"}`, signal: s, weight: 14 },
    { name: "Williams %R", value: direction === "CALL" ? "-88.1" : "-10.4", signal: s, weight: 10 },
    { name: "CCI (20)", value: direction === "CALL" ? "-128.3" : "134.7", signal: s, weight: 10 },
    { name: "ADX/DI", value: `ADX:${(24 + rand(5) * 18).toFixed(1)} +DI:${direction === "CALL" ? "29.2" : "13.7"}`, signal: s, weight: 9 },
    { name: "Ichimoku", value: direction === "CALL" ? "T>K Bull" : "T<K Bear", signal: s, weight: 9 },
    { name: "EMA Trend", value: direction === "CALL" ? "UPTREND" : "DOWNTREND", signal: s, weight: 7 },
    { name: "ROC (10)", value: direction === "CALL" ? "0.0834" : "-0.0761", signal: s, weight: 6 },
    { name: "Price Action", value: paLabel, signal: s, weight: 26 },
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
    sessionName: `${sessionLabel}`,
    entryTime: formatBDTime(nextCandleOpenBD) + " BDT",
    expiryTime: formatBDTime(expiryBD) + " BDT",
    rsi: rsiVal,
    trend: direction === "CALL" ? "UPTREND" : "DOWNTREND",
    pattern: `${patternName} • ${liqType}${bbSqueeze ? " • BB Squeeze" : ""}`,
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
