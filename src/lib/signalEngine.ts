import {
  CandleData, Signal, SignalDirection, SignalStrength, IndicatorResult,
} from "@/types";
import {
  calculateRSI, calculateATR, findSupportResistance, detectCandlePattern,
  detectManipulation, detectTrend, calculatePivotPoints, runAllIndicators,
  detectLiquidityZones, detectMarketStructure, analyzeVolume,
} from "@/lib/indicators";
import { analyzePriceAction, runConfirmation, analyzeCandlePower, detectMarketZone } from "@/lib/priceAction";
import { getMarketSession, getSessionQuality } from "@/lib/marketUtils";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Direction History for anti-repetition ────────────────────────────────────
// Tracks last signals per pair to prevent same direction spam
const pairDirectionHistory: Map<string, SignalDirection[]> = new Map();
const MAX_HISTORY = 5;

function getDirectionHistory(pair: string): SignalDirection[] {
  return pairDirectionHistory.get(pair) || [];
}

function updateDirectionHistory(pair: string, direction: SignalDirection): void {
  const history = getDirectionHistory(pair);
  history.push(direction);
  if (history.length > MAX_HISTORY) history.shift();
  pairDirectionHistory.set(pair, history);
}

function getSameDirectionStreak(pair: string, direction: SignalDirection): number {
  const history = getDirectionHistory(pair);
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] === direction) streak++;
    else break;
  }
  return streak;
}

// ── Force direction when scores are close ─────────────────────────────────────
function forceDirection(buyScore: number, sellScore: number, candles: CandleData[]): "BUY" | "SELL" {
  if (buyScore !== sellScore) return buyScore > sellScore ? "BUY" : "SELL";
  const last = candles[candles.length - 1];
  return last.close >= last.open ? "BUY" : "SELL";
}

// ── Apply streak penalty to prevent continuous same-direction signals ─────────
function applyStreakPenalty(
  pair: string,
  buyScore: number,
  sellScore: number,
  prelimDir: "BUY" | "SELL",
  candles: CandleData[]
): "BUY" | "SELL" {
  const signalDir: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, signalDir);

  // If same direction ≥ 3 times in a row AND the opposite has a reasonable score
  if (streak >= 3) {
    const oppositeScore = prelimDir === "BUY" ? sellScore : buyScore;
    const currentScore = prelimDir === "BUY" ? buyScore : sellScore;
    const totalScore = buyScore + sellScore;

    // Opposite direction has at least 35% of total score → switch to prevent spam
    if (totalScore > 0 && oppositeScore / totalScore >= 0.35) {
      console.log(`[Anti-streak] ${pair}: Streak ${streak} for ${signalDir}, forcing opposite direction`);
      return prelimDir === "BUY" ? "SELL" : "BUY";
    }
  }

  return prelimDir;
}

export function generateSignal(pair: string, candles: CandleData[]): Signal | null {
  if (!candles || candles.length < 20) {
    console.warn(`[Signal] ${pair}: insufficient candles (${candles?.length ?? 0})`);
    return null;
  }

  const closes = candles.map(c => c.close);
  const { session, label: sessionLabel } = getMarketSession();
  const sessionQuality = getSessionQuality(session);
  const atr = calculateATR(candles);

  // ── Run all 10 base indicators ─────────────────────────────────────────────
  const indicators = runAllIndicators(candles);

  let buyRaw = 0, sellRaw = 0, totalWeight = 0;
  for (const ind of indicators) {
    totalWeight += ind.weight;
    if (ind.signal === "BUY") buyRaw += ind.weight;
    else if (ind.signal === "SELL") sellRaw += ind.weight;
    else {
      // Resolve NEUTRAL via micro-bias — never leave it at zero
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      const microBull = last.close > last.open && last.close > prev.close;
      if (microBull) buyRaw += ind.weight * 0.42;
      else sellRaw += ind.weight * 0.42;
    }
  }

  // ── Candlestick pattern ────────────────────────────────────────────────────
  const pattern = detectCandlePattern(candles);
  const patternWeight = 22;
  totalWeight += patternWeight;
  if (pattern.bias === "BULLISH") buyRaw += (pattern.strength / 100) * patternWeight;
  else if (pattern.bias === "BEARISH") sellRaw += (pattern.strength / 100) * patternWeight;
  else {
    // NEUTRAL pattern → resolve by recent close direction
    const last = candles[candles.length - 1];
    if (last.close > last.open) buyRaw += patternWeight * 0.38;
    else sellRaw += patternWeight * 0.38;
  }

  // ── Trend alignment ────────────────────────────────────────────────────────
  const trend = detectTrend(closes);
  const trendWeight = 18;
  totalWeight += trendWeight;
  if (trend.trend === "UPTREND") buyRaw += trendWeight;
  else if (trend.trend === "DOWNTREND") sellRaw += trendWeight;
  else {
    // SIDEWAYS → 3-candle micro trend
    const n = closes.length;
    const micro = closes[n - 1] - closes[n - 4];
    if (micro > 0) buyRaw += trendWeight * 0.52;
    else if (micro < 0) sellRaw += trendWeight * 0.52;
    else buyRaw += trendWeight * 0.26;
  }

  // ── Liquidity zone ─────────────────────────────────────────────────────────
  const liquidity = detectLiquidityZones(candles, atr);
  const liqWeight = 18;
  totalWeight += liqWeight;
  if (liquidity.buyLiquidity) buyRaw += (liquidity.strength / 100) * liqWeight;
  else if (liquidity.sellLiquidity) sellRaw += (liquidity.strength / 100) * liqWeight;
  else {
    // No liquidity zone — tilt by last candle color
    const lc = candles[candles.length - 1];
    if (lc.close > lc.open) buyRaw += liqWeight * 0.3;
    else sellRaw += liqWeight * 0.3;
  }

  // ── Market Structure BOS/CHoCH ────────────────────────────────────────────
  const structure = detectMarketStructure(candles);
  const bosWeight = 16;
  totalWeight += bosWeight;
  if (structure.bos === "BULLISH" || structure.choch === "BULLISH") buyRaw += bosWeight;
  else if (structure.bos === "BEARISH" || structure.choch === "BEARISH") sellRaw += bosWeight;
  else {
    // No BOS/CHoCH → tilt by close vs open
    const lc = candles[candles.length - 1];
    if (lc.close > lc.open) buyRaw += bosWeight * 0.4;
    else sellRaw += bosWeight * 0.4;
  }

  // ── PRICE ACTION ──────────────────────────────────────────────────────────
  const priceAction = analyzePriceAction(candles, atr);
  const paWeight = 26;
  totalWeight += paWeight;
  if (priceAction.priceActionSignal === "BUY") {
    buyRaw += paWeight * (1 + priceAction.zoneStrength / 200);
  } else if (priceAction.priceActionSignal === "SELL") {
    sellRaw += paWeight * (1 + priceAction.zoneStrength / 200);
  } else {
    // NEUTRAL PA → resolve via momentum direction
    if (priceAction.momentum > 5) buyRaw += paWeight * 0.52;
    else if (priceAction.momentum < -5) sellRaw += paWeight * 0.52;
    else if (priceAction.momentum >= 0) buyRaw += paWeight * 0.38;
    else sellRaw += paWeight * 0.38;
  }

  // ── Candle Power ──────────────────────────────────────────────────────────
  const candlePowerData = analyzeCandlePower(candles);
  const cpWeight = 16;
  totalWeight += cpWeight;
  if (candlePowerData.dominance === "BUYER") buyRaw += cpWeight * (candlePowerData.buyerStrength / 100);
  else if (candlePowerData.dominance === "SELLER") sellRaw += cpWeight * (candlePowerData.sellerStrength / 100);
  else {
    buyRaw += cpWeight * (candlePowerData.buyerStrength / 100);
    sellRaw += cpWeight * (candlePowerData.sellerStrength / 100);
  }

  // ── Market Zone ───────────────────────────────────────────────────────────
  const marketZone = detectMarketZone(candles, atr);
  const mzWeight = 14;
  totalWeight += mzWeight;
  if (marketZone.zone === "SUPPORT") buyRaw += mzWeight * (Math.max(30, marketZone.zoneStrength) / 100);
  else if (marketZone.zone === "RESISTANCE") sellRaw += mzWeight * (Math.max(30, marketZone.zoneStrength) / 100);
  else {
    // Mid zone → momentum direction
    if (priceAction.momentum >= 0) buyRaw += mzWeight * 0.4;
    else sellRaw += mzWeight * 0.4;
  }

  // ── Support/Resistance proximity ──────────────────────────────────────────
  const sr = findSupportResistance(candles);
  const srWeight = 12;
  totalWeight += srWeight;
  const lastClose = closes[closes.length - 1];
  if (atr > 0) {
    const distSup = lastClose - sr.support;
    const distRes = sr.resistance - lastClose;
    if (distSup < atr * 0.7 && distSup < distRes) buyRaw += srWeight;
    else if (distRes < atr * 0.7 && distRes < distSup) sellRaw += srWeight;
    else {
      if (trend.trend === "UPTREND") buyRaw += srWeight * 0.5;
      else if (trend.trend === "DOWNTREND") sellRaw += srWeight * 0.5;
      else if (lastClose > (sr.support + sr.resistance) / 2) buyRaw += srWeight * 0.35;
      else sellRaw += srWeight * 0.35;
    }
  }

  // ── Pivot Points ──────────────────────────────────────────────────────────
  const pivots = calculatePivotPoints(candles);
  const pivotWeight = 10;
  totalWeight += pivotWeight;
  if (atr > 0) {
    if (Math.abs(lastClose - pivots.s1) < atr * 0.4) buyRaw += pivotWeight;
    else if (Math.abs(lastClose - pivots.r1) < atr * 0.4) sellRaw += pivotWeight;
    else if (Math.abs(lastClose - pivots.s2) < atr * 0.4) buyRaw += pivotWeight * 0.7;
    else if (Math.abs(lastClose - pivots.r2) < atr * 0.4) sellRaw += pivotWeight * 0.7;
    else if (lastClose < pivots.pp) sellRaw += pivotWeight * 0.35;
    else buyRaw += pivotWeight * 0.35;
  }

  // ── Volume confirmation ───────────────────────────────────────────────────
  const volume = analyzeVolume(candles);
  const volWeight = 10;
  totalWeight += volWeight;
  const lastCandle = candles[candles.length - 1];
  if (volume.trend === "INCREASING") {
    if (lastCandle.close > lastCandle.open) buyRaw += volWeight;
    else sellRaw += volWeight;
  } else if (volume.trend === "DECREASING") {
    // Fading volume — slight opposite bias
    if (lastCandle.close > lastCandle.open) buyRaw += volWeight * 0.3;
    else sellRaw += volWeight * 0.3;
  } else {
    if (lastCandle.close > lastCandle.open) buyRaw += volWeight * 0.45;
    else sellRaw += volWeight * 0.45;
  }

  // ── Momentum ──────────────────────────────────────────────────────────────
  const momentumWeight = 12;
  totalWeight += momentumWeight;
  if (priceAction.momentum > 20) buyRaw += momentumWeight;
  else if (priceAction.momentum > 8) buyRaw += momentumWeight * 0.65;
  else if (priceAction.momentum < -20) sellRaw += momentumWeight;
  else if (priceAction.momentum < -8) sellRaw += momentumWeight * 0.65;
  else {
    // Near zero → tilt by 3-candle close average
    const recent3 = closes.slice(-3);
    const avg3 = recent3.reduce((a, b) => a + b, 0) / 3;
    if (closes[closes.length - 1] > avg3) buyRaw += momentumWeight * 0.42;
    else sellRaw += momentumWeight * 0.42;
  }

  // ── Manipulation guard ────────────────────────────────────────────────────
  const manip = detectManipulation(candles, atr);
  if (manip.detected) {
    buyRaw *= 0.62;
    sellRaw *= 0.62;
  }

  // ── Apply session quality ─────────────────────────────────────────────────
  const buyScore = buyRaw * sessionQuality;
  const sellScore = sellRaw * sessionQuality;

  const buyPct = (buyScore / totalWeight) * 100;
  const sellPct = (sellScore / totalWeight) * 100;
  const diff = Math.abs(buyPct - sellPct);

  console.log(`[Engine] ${pair}: BUY=${buyPct.toFixed(1)}% SELL=${sellPct.toFixed(1)}% diff=${diff.toFixed(1)}%`);

  // ── Force direction — NO neutral output ever ──────────────────────────────
  let prelimDir = forceDirection(buyScore, sellScore, candles);

  // ── Anti-streak: prevent 3+ consecutive same-direction signals ───────────
  prelimDir = applyStreakPenalty(pair, buyScore, sellScore, prelimDir, candles);

  // ── 5-Second Confirmation Pass ────────────────────────────────────────────
  const confirmation = runConfirmation(candles, prelimDir);

  // If confirmation contradicts preliminary direction and is strong (>70%), flip direction
  if (!confirmation.confirmed && confirmation.score < 30 && diff < 8) {
    prelimDir = prelimDir === "BUY" ? "SELL" : "BUY";
    console.log(`[Confirmation flip] ${pair}: direction reversed by confirmation score ${confirmation.score}`);
  }

  const direction: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";

  // ── Confidence calculation ────────────────────────────────────────────────
  // Solid base + differential amplification + confirmation + session bonus
  const rawConf = 56 + diff * 1.8 + confirmation.score * 0.14;
  const manipPenalty = manip.detected ? 7 : 0;
  const sessionBonus = session === "OVERLAP" ? 5 : session === "LONDON" || session === "NEW_YORK" ? 3 : 1;
  const streakDir: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, streakDir);
  const streakPenalty = streak >= 2 ? streak * 2 : 0;

  const confidence = Math.min(97, Math.max(63, rawConf - manipPenalty + sessionBonus - streakPenalty));
  const roundedConf = Math.round(confidence);

  let strength: SignalStrength;
  if (roundedConf >= 83) strength = "STRONG";
  else if (roundedConf >= 71) strength = "MODERATE";
  else strength = "WEAK";

  const rsi = calculateRSI(closes);
  const now = new Date();
  const expiryDate = new Date(now.getTime() + 60 * 1000);

  const liqSuffix = liquidity.liquidityType !== "None" ? ` • ${liquidity.liquidityType}` : "";
  const manipSuffix = manip.detected ? ` ⚠️${manip.reason}` : "";

  // ── Update direction history ───────────────────────────────────────────────
  updateDirectionHistory(pair, direction);

  return {
    id: generateId(),
    pair,
    direction,
    strength,
    confidence: roundedConf,
    timestamp: now,
    expiry: "1 Min",
    indicators,
    sessionName: sessionLabel,
    entryTime: formatTime(now),
    expiryTime: formatTime(expiryDate),
    rsi: parseFloat(rsi.toFixed(2)),
    trend: trend.trend,
    pattern: pattern.pattern + liqSuffix + manipSuffix,
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
// Seeded by pair + minute so the same pair always gives consistent demo direction per minute
const demoDirectionHistory: Map<string, SignalDirection[]> = new Map();

export function generateDemoSignal(pair: string): Signal {
  const { label: sessionLabel } = getMarketSession();

  // Minute-based seed — consistent within same minute, changes each minute
  const minuteSeed = Math.floor(Date.now() / 60000);
  const pairSeed = pair.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = (pairSeed * 9973 + minuteSeed * 6991 + 314159) % 1000003;

  const rand = (offset = 0) => ((seed * 9301 + offset * 49297 + 233917) % 233280) / 233280;

  // Bias direction from recent TradingView chart trend — simulated by pair hash
  const rawBias = rand(1);

  // Get demo history for anti-streak
  const demoHistory = demoDirectionHistory.get(pair) || [];
  let direction: SignalDirection;

  // If last 2 demo signals were same direction, force opposite (50% of the time)
  const lastTwo = demoHistory.slice(-2);
  const allSame = lastTwo.length === 2 && lastTwo[0] === lastTwo[1];

  if (allSame && rand(15) > 0.45) {
    direction = lastTwo[0] === "CALL" ? "PUT" : "CALL";
  } else {
    direction = rawBias < 0.52 ? "CALL" : "PUT";
  }

  // Update demo history
  demoHistory.push(direction);
  if (demoHistory.length > MAX_HISTORY) demoHistory.shift();
  demoDirectionHistory.set(pair, demoHistory);

  const confidence = Math.round(66 + rand(2) * 28);
  const strength: SignalStrength = confidence >= 83 ? "STRONG" : confidence >= 71 ? "MODERATE" : "WEAK";

  const s: "BUY" | "SELL" = direction === "CALL" ? "BUY" : "SELL";
  const rsiVal = direction === "CALL"
    ? parseFloat((22 + rand(3) * 24).toFixed(2))
    : parseFloat((54 + rand(3) * 24).toFixed(2));

  const buyerStr = direction === "CALL" ? Math.round(58 + rand(8) * 28) : Math.round(22 + rand(8) * 24);
  const sellerStr = 100 - buyerStr;
  const candlePwr = Math.round(50 + rand(9) * 42);
  const confirmScore = Math.round(60 + rand(10) * 30);

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
    { name: "RSI (14)", value: rsiVal.toString(), signal: s, weight: 20 },
    { name: "MACD", value: direction === "CALL" ? "0.000148" : "-0.000102", signal: s, weight: 18 },
    { name: "Bollinger Bands", value: `%B:${direction === "CALL" ? "12.4" : "88.3"}%`, signal: s, weight: 15 },
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
  const expiryDate = new Date(now.getTime() + 60 * 1000);

  return {
    id: generateId(),
    pair,
    direction,
    strength,
    confidence,
    timestamp: now,
    expiry: "1 Min",
    indicators,
    sessionName: `${sessionLabel} (DEMO)`,
    entryTime: formatTime(now),
    expiryTime: formatTime(expiryDate),
    rsi: rsiVal,
    trend: direction === "CALL" ? "UPTREND" : "DOWNTREND",
    pattern: `${patternName} • ${liqType}`,
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
