import {
  CandleData, Signal, SignalDirection, SignalStrength, IndicatorResult,
} from "@/types";
import {
  calculateRSI, calculateATR, findSupportResistance, detectCandlePattern,
  detectManipulation, detectTrend, runAllIndicators,
  detectLiquidityZones, detectMarketStructure, analyzeVolume,
  calculateBollingerBands, calculateStochastic, calculateWilliamsR,
  calculateCCI, calculateMACD, getMACDCross, calculateADX,
  calculateIchimoku, calculateROC, calculateEMA,
} from "@/lib/indicators";
import { analyzePriceAction, runConfirmation, analyzeCandlePower, detectMarketZone } from "@/lib/priceAction";
import { getMarketSession, getSessionQuality, formatBDTime, getBangladeshTime } from "@/lib/marketUtils";
import { MarketSession } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ── Direction History (anti-repetition per pair) ──────────────────────────────
const pairDirectionHistory = new Map<string, SignalDirection[]>();
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
  const last3 = candles.slice(-3);
  const bullCount = last3.filter(c => c.close > c.open).length;
  return bullCount >= 2 ? "BUY" : "SELL";
}

function applyStreakPenalty(pair: string, buyScore: number, sellScore: number, dir: "BUY" | "SELL"): "BUY" | "SELL" {
  const signalDir: SignalDirection = dir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, signalDir);
  if (streak >= 3) {
    const opp = dir === "BUY" ? sellScore : buyScore;
    const total = buyScore + sellScore;
    if (total > 0 && opp / total >= 0.32) return dir === "BUY" ? "SELL" : "BUY";
  }
  return dir;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION-SPECIFIC INDICATOR WEIGHT PROFILES
// Each session has unique market behavior — we weight indicators accordingly
// ─────────────────────────────────────────────────────────────────────────────
interface SessionProfile {
  // Individual indicator weights
  bbWeight: number;           // Bollinger Bands
  rsiWeight: number;          // RSI
  macdWeight: number;         // MACD cross
  stochWeight: number;        // Stochastic
  williamsRWeight: number;    // Williams %R
  cciWeight: number;          // CCI
  adxWeight: number;          // ADX/DI
  ichiWeight: number;         // Ichimoku
  emaWeight: number;          // EMA Trend
  rocWeight: number;          // ROC
  patternWeight: number;      // Candlestick patterns
  trendWeight: number;        // Trend detection
  liquidityWeight: number;    // Liquidity zones
  bosWeight: number;          // Market structure BOS/CHoCH
  priceActionWeight: number;  // Price action
  candlePowerWeight: number;  // Candle power
  marketZoneWeight: number;   // Market zone S/R
  srWeight: number;           // S/R proximity
  volumeWeight: number;       // Volume
  // BB thresholds per session
  bbOversold: number;
  bbOverbought: number;
  bbMidLow: number;
  bbMidHigh: number;
  // RSI thresholds
  rsiOversold: number;
  rsiOverbought: number;
  // Confidence boost
  sessionConfBonus: number;
  // Description
  label: string;
  strategy: string;
}

function getSessionProfile(session: MarketSession): SessionProfile {
  switch (session) {
    // ── TOKYO (Asian): Range-bound, mean reversion, oscillators rule ─────────
    case "TOKYO":
      return {
        bbWeight: 32, rsiWeight: 26, macdWeight: 10, stochWeight: 24,
        williamsRWeight: 20, cciWeight: 18, adxWeight: 7, ichiWeight: 10,
        emaWeight: 6, rocWeight: 5,
        patternWeight: 20, trendWeight: 12, liquidityWeight: 14,
        bosWeight: 12, priceActionWeight: 22, candlePowerWeight: 14,
        marketZoneWeight: 16, srWeight: 14, volumeWeight: 8,
        bbOversold: 0.12, bbOverbought: 0.88, bbMidLow: 0.38, bbMidHigh: 0.62,
        rsiOversold: 32, rsiOverbought: 68,
        sessionConfBonus: 2,
        label: "Tokyo (Asian)", strategy: "Mean-Reversion · Oscillator-Led · Range-Bound",
      };

    // ── SYDNEY (Pacific): Quiet, low volatility, conservative entries ────────
    case "SYDNEY":
      return {
        bbWeight: 34, rsiWeight: 24, macdWeight: 9, stochWeight: 22,
        williamsRWeight: 18, cciWeight: 16, adxWeight: 6, ichiWeight: 8,
        emaWeight: 7, rocWeight: 5,
        patternWeight: 18, trendWeight: 10, liquidityWeight: 12,
        bosWeight: 10, priceActionWeight: 20, candlePowerWeight: 14,
        marketZoneWeight: 18, srWeight: 16, volumeWeight: 7,
        bbOversold: 0.14, bbOverbought: 0.86, bbMidLow: 0.40, bbMidHigh: 0.60,
        rsiOversold: 30, rsiOverbought: 70,
        sessionConfBonus: 0,
        label: "Sydney (Pacific)", strategy: "Conservative · Mean-Reversion · Wide-Band",
      };

    // ── LONDON: Trending, breakout-driven, MACD/EMA momentum rules ──────────
    case "LONDON":
      return {
        bbWeight: 30, rsiWeight: 16, macdWeight: 26, stochWeight: 12,
        williamsRWeight: 10, cciWeight: 10, adxWeight: 22, ichiWeight: 12,
        emaWeight: 22, rocWeight: 9,
        patternWeight: 24, trendWeight: 26, liquidityWeight: 18,
        bosWeight: 20, priceActionWeight: 26, candlePowerWeight: 16,
        marketZoneWeight: 12, srWeight: 10, volumeWeight: 14,
        bbOversold: 0.08, bbOverbought: 0.92, bbMidLow: 0.36, bbMidHigh: 0.64,
        rsiOversold: 38, rsiOverbought: 62,
        sessionConfBonus: 4,
        label: "London", strategy: "Breakout · Momentum · Trend-Following",
      };

    // ── NEW YORK: High volatility, fast moves, BB breakouts + momentum ───────
    case "NEW_YORK":
      return {
        bbWeight: 36, rsiWeight: 16, macdWeight: 24, stochWeight: 10,
        williamsRWeight: 8, cciWeight: 8, adxWeight: 22, ichiWeight: 10,
        emaWeight: 20, rocWeight: 10,
        patternWeight: 24, trendWeight: 22, liquidityWeight: 18,
        bosWeight: 18, priceActionWeight: 26, candlePowerWeight: 16,
        marketZoneWeight: 10, srWeight: 8, volumeWeight: 16,
        bbOversold: 0.07, bbOverbought: 0.93, bbMidLow: 0.34, bbMidHigh: 0.66,
        rsiOversold: 40, rsiOverbought: 60,
        sessionConfBonus: 4,
        label: "New York", strategy: "Volatility · Breakout · Volume-Confirmed",
      };

    // ── OVERLAP (London+NY): Maximum liquidity, all indicators reliable ───────
    case "OVERLAP":
      return {
        bbWeight: 36, rsiWeight: 20, macdWeight: 26, stochWeight: 14,
        williamsRWeight: 12, cciWeight: 12, adxWeight: 24, ichiWeight: 14,
        emaWeight: 24, rocWeight: 10,
        patternWeight: 28, trendWeight: 28, liquidityWeight: 22,
        bosWeight: 22, priceActionWeight: 30, candlePowerWeight: 18,
        marketZoneWeight: 12, srWeight: 10, volumeWeight: 18,
        bbOversold: 0.06, bbOverbought: 0.94, bbMidLow: 0.32, bbMidHigh: 0.68,
        rsiOversold: 38, rsiOverbought: 62,
        sessionConfBonus: 8,
        label: "London+NY Overlap ⚡", strategy: "Peak Liquidity · All-Indicator · Highest Accuracy",
      };

    default:
      return {
        bbWeight: 30, rsiWeight: 18, macdWeight: 14, stochWeight: 14,
        williamsRWeight: 12, cciWeight: 10, adxWeight: 9, ichiWeight: 9,
        emaWeight: 7, rocWeight: 6,
        patternWeight: 20, trendWeight: 16, liquidityWeight: 14,
        bosWeight: 14, priceActionWeight: 22, candlePowerWeight: 14,
        marketZoneWeight: 14, srWeight: 12, volumeWeight: 10,
        bbOversold: 0.15, bbOverbought: 0.85, bbMidLow: 0.42, bbMidHigh: 0.58,
        rsiOversold: 30, rsiOverbought: 70,
        sessionConfBonus: 0,
        label: "Off-Hours", strategy: "Conservative · Multi-Indicator",
      };
  }
}

// ── Session-aware Bollinger Band scoring ──────────────────────────────────────
function scoreBB(closes: number[], p: SessionProfile): { buy: number; sell: number; label: string; signal: "BUY" | "SELL" | "NEUTRAL" } {
  const bb = calculateBollingerBands(closes);
  const w = p.bbWeight;
  let buy = 0, sell = 0;
  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let label = `%B:${(bb.percentB * 100).toFixed(1)}%`;

  if (bb.breakout === "LOWER" || bb.percentB <= p.bbOversold) {
    buy = w; signal = "BUY";
    label += bb.squeeze ? " (SqzBrk↑)" : " (Oversold)";
  } else if (bb.breakout === "UPPER" || bb.percentB >= p.bbOverbought) {
    sell = w; signal = "SELL";
    label += bb.squeeze ? " (SqzBrk↓)" : " (Overbought)";
  } else if (bb.bbSignal === "STRONG_BUY") {
    buy = w; signal = "BUY"; label += " (StrongBUY)";
  } else if (bb.bbSignal === "STRONG_SELL") {
    sell = w; signal = "SELL"; label += " (StrongSELL)";
  } else if (bb.bbSignal === "BUY" || bb.percentB < p.bbMidLow) {
    buy = w * 0.85; signal = "BUY";
    label += bb.squeeze ? " (SQZ↑)" : bb.walkingBand === "LOWER" ? " (Walk↓)" : "";
  } else if (bb.bbSignal === "SELL" || bb.percentB > p.bbMidHigh) {
    sell = w * 0.85; signal = "SELL";
    label += bb.squeeze ? " (SQZ↓)" : bb.walkingBand === "UPPER" ? " (Walk↑)" : "";
  } else {
    // Neutral zone — use squeeze momentum
    if (bb.squeezeMomentum > 0) { buy = w * 0.52; signal = "BUY"; }
    else if (bb.squeezeMomentum < 0) { sell = w * 0.52; signal = "SELL"; }
    else {
      if (bb.percentB < 0.5) { buy = w * 0.44; signal = "BUY"; }
      else { sell = w * 0.44; signal = "SELL"; }
    }
  }
  if (bb.squeeze && bb.breakout !== "NONE") {
    if (signal === "BUY") buy = Math.min(w, buy * 1.18);
    else if (signal === "SELL") sell = Math.min(w, sell * 1.18);
  }
  return { buy, sell, label, signal };
}

// ── Session-aware RSI scoring ─────────────────────────────────────────────────
function scoreRSI(rsi: number, p: SessionProfile, w: number): { buy: number; sell: number; signal: "BUY" | "SELL" | "NEUTRAL" } {
  if (rsi <= p.rsiOversold) return { buy: w, sell: 0, signal: "BUY" };
  if (rsi >= p.rsiOverbought) return { buy: 0, sell: w, signal: "SELL" };
  // Mid-zone momentum bias
  const midpoint = (p.rsiOversold + p.rsiOverbought) / 2;
  if (rsi < midpoint - 2) return { buy: w * 0.65, sell: 0, signal: "BUY" };
  if (rsi > midpoint + 2) return { buy: 0, sell: w * 0.65, signal: "SELL" };
  return { buy: w * 0.30, sell: 0, signal: "NEUTRAL" };
}

// ── Session-aware MACD scoring ────────────────────────────────────────────────
function scoreMACD(closes: number[], p: SessionProfile, w: number): { buy: number; sell: number; signal: "BUY" | "SELL" | "NEUTRAL" } {
  const cross = getMACDCross(closes);
  const { histogram } = calculateMACD(closes);
  if (cross === "BULLISH") {
    const boost = histogram > 0 ? 1.15 : 1.0;
    return { buy: w * boost, sell: 0, signal: "BUY" };
  }
  if (cross === "BEARISH") {
    const boost = histogram < 0 ? 1.15 : 1.0;
    return { buy: 0, sell: w * boost, signal: "SELL" };
  }
  // No cross — use histogram momentum
  if (histogram > 0) return { buy: w * 0.55, sell: 0, signal: "BUY" };
  if (histogram < 0) return { buy: 0, sell: w * 0.55, signal: "SELL" };
  return { buy: w * 0.25, sell: 0, signal: "NEUTRAL" };
}

// ── Session-aware Stochastic scoring ─────────────────────────────────────────
function scoreStochastic(candles: CandleData[], p: SessionProfile, w: number): { buy: number; sell: number; signal: "BUY" | "SELL" | "NEUTRAL" } {
  const stoch = calculateStochastic(candles);
  // For Tokyo/Sydney (range sessions): wider oversold/overbought zones
  const isRange = p.label.includes("Tokyo") || p.label.includes("Sydney");
  const osLevel = isRange ? 28 : 22;
  const obLevel = isRange ? 72 : 78;
  if (stoch.k < osLevel && stoch.d < osLevel + 4) {
    const kCross = stoch.k > stoch.d;
    return { buy: w * (kCross ? 1.15 : 0.9), sell: 0, signal: "BUY" };
  }
  if (stoch.k > obLevel && stoch.d > obLevel - 4) {
    const kCross = stoch.k < stoch.d;
    return { buy: 0, sell: w * (kCross ? 1.15 : 0.9), signal: "SELL" };
  }
  // Mid zone momentum
  if (stoch.k < 45 && stoch.k > stoch.d) return { buy: w * 0.55, sell: 0, signal: "BUY" };
  if (stoch.k > 55 && stoch.k < stoch.d) return { buy: 0, sell: w * 0.55, signal: "SELL" };
  return { buy: w * 0.28, sell: 0, signal: "NEUTRAL" };
}

// ── ADX scoring (trend sessions get extra weight) ─────────────────────────────
function scoreADX(candles: CandleData[], session: MarketSession, w: number): { buy: number; sell: number; signal: "BUY" | "SELL" | "NEUTRAL" } {
  const adx = calculateADX(candles);
  // For trending sessions (London, NY, Overlap), ADX > 18 is enough
  const isTrending = session === "LONDON" || session === "NEW_YORK" || session === "OVERLAP";
  const adxThreshold = isTrending ? 16 : 22;
  if (adx.adx > adxThreshold) {
    if (adx.plusDI > adx.minusDI) {
      const boost = adx.adx > 30 ? 1.2 : 1.0;
      return { buy: w * boost, sell: 0, signal: "BUY" };
    } else {
      const boost = adx.adx > 30 ? 1.2 : 1.0;
      return { buy: 0, sell: w * boost, signal: "SELL" };
    }
  }
  // Weak trend — use DI direction with reduced confidence
  if (adx.plusDI > adx.minusDI) return { buy: w * 0.42, sell: 0, signal: "NEUTRAL" };
  return { buy: 0, sell: w * 0.42, signal: "NEUTRAL" };
}

// ── EMA Trend scoring (trending sessions more reliable) ───────────────────────
function scoreEMATrend(closes: number[], session: MarketSession, w: number): { buy: number; sell: number; signal: "BUY" | "SELL" | "NEUTRAL" } {
  const trend = detectTrend(closes);
  const isTrending = session === "LONDON" || session === "NEW_YORK" || session === "OVERLAP";
  const mult = isTrending ? 1.15 : 0.85;
  if (trend.trend === "UPTREND") return { buy: w * mult * (1 + trend.strength / 200), sell: 0, signal: "BUY" };
  if (trend.trend === "DOWNTREND") return { buy: 0, sell: w * mult * (1 + trend.strength / 200), signal: "SELL" };
  // Sideways — micro momentum
  const n = closes.length;
  const micro = closes[n - 1] - closes[n - 4];
  if (micro > 0) return { buy: w * 0.42, sell: 0, signal: "NEUTRAL" };
  if (micro < 0) return { buy: 0, sell: w * 0.42, signal: "NEUTRAL" };
  return { buy: w * 0.20, sell: 0, signal: "NEUTRAL" };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SIGNAL GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generateSignal(pair: string, candles: CandleData[]): Signal | null {
  if (!candles || candles.length < 22) return null;

  const closes = candles.map(c => c.close);
  const { session, label: sessionLabel } = getMarketSession();
  const sessionQuality = getSessionQuality(session);
  const atr = calculateATR(candles);
  const p = getSessionProfile(session);

  let buyRaw = 0, sellRaw = 0, totalWeight = 0;
  const fullIndicators: IndicatorResult[] = [];

  // ── 1. Bollinger Bands (PRIMARY) ─────────────────────────────────────────
  const bbScore = scoreBB(closes, p);
  totalWeight += p.bbWeight;
  buyRaw += bbScore.buy;
  sellRaw += bbScore.sell;
  fullIndicators.push({ name: "Bollinger Bands ★", value: bbScore.label, signal: bbScore.signal, weight: p.bbWeight });

  // ── 2. RSI ────────────────────────────────────────────────────────────────
  const rsiVal = calculateRSI(closes);
  const rsiScore = scoreRSI(rsiVal, p, p.rsiWeight);
  totalWeight += p.rsiWeight;
  buyRaw += rsiScore.buy;
  sellRaw += rsiScore.sell;
  fullIndicators.push({ name: "RSI (14)", value: rsiVal.toFixed(2), signal: rsiScore.signal, weight: p.rsiWeight });

  // ── 3. MACD ───────────────────────────────────────────────────────────────
  const macdScore = scoreMACD(closes, p, p.macdWeight);
  const { histogram } = calculateMACD(closes);
  totalWeight += p.macdWeight;
  buyRaw += macdScore.buy;
  sellRaw += macdScore.sell;
  fullIndicators.push({ name: "MACD", value: histogram.toFixed(6), signal: macdScore.signal, weight: p.macdWeight });

  // ── 4. Stochastic ─────────────────────────────────────────────────────────
  const stochScore = scoreStochastic(candles, p, p.stochWeight);
  const stoch = calculateStochastic(candles);
  totalWeight += p.stochWeight;
  buyRaw += stochScore.buy;
  sellRaw += stochScore.sell;
  fullIndicators.push({ name: "Stochastic", value: `K:${stoch.k.toFixed(1)} D:${stoch.d.toFixed(1)}`, signal: stochScore.signal, weight: p.stochWeight });

  // ── 5. Williams %R ────────────────────────────────────────────────────────
  const willR = calculateWilliamsR(candles);
  const wrSig: "BUY" | "SELL" | "NEUTRAL" = willR <= -82 ? "BUY" : willR >= -18 ? "SELL" : willR < -60 ? "BUY" : willR > -40 ? "SELL" : "NEUTRAL";
  const wrBuy = wrSig === "BUY" ? p.williamsRWeight * (willR <= -82 ? 1 : 0.65) : 0;
  const wrSell = wrSig === "SELL" ? p.williamsRWeight * (willR >= -18 ? 1 : 0.65) : p.williamsRWeight * 0.25;
  totalWeight += p.williamsRWeight;
  buyRaw += wrBuy;
  sellRaw += wrSig === "SELL" ? wrSell : 0;
  fullIndicators.push({ name: "Williams %R", value: willR.toFixed(2), signal: wrSig, weight: p.williamsRWeight });

  // ── 6. CCI ────────────────────────────────────────────────────────────────
  const cci = calculateCCI(candles);
  const cciSig: "BUY" | "SELL" | "NEUTRAL" = cci <= -105 ? "BUY" : cci >= 105 ? "SELL" : cci < -48 ? "BUY" : cci > 48 ? "SELL" : "NEUTRAL";
  const cciBuy = cciSig === "BUY" ? p.cciWeight * (cci <= -105 ? 1 : 0.68) : cciSig === "NEUTRAL" ? p.cciWeight * 0.22 : 0;
  const cciSellV = cciSig === "SELL" ? p.cciWeight * (cci >= 105 ? 1 : 0.68) : 0;
  totalWeight += p.cciWeight;
  buyRaw += cciBuy;
  sellRaw += cciSellV;
  fullIndicators.push({ name: "CCI (20)", value: cci.toFixed(2), signal: cciSig, weight: p.cciWeight });

  // ── 7. ADX/DI (trend sessions boosted) ───────────────────────────────────
  const adxScore = scoreADX(candles, session, p.adxWeight);
  const adx = calculateADX(candles);
  totalWeight += p.adxWeight;
  buyRaw += adxScore.buy;
  sellRaw += adxScore.sell;
  fullIndicators.push({ name: "ADX/DI", value: `ADX:${adx.adx.toFixed(1)} +DI:${adx.plusDI.toFixed(1)}`, signal: adxScore.signal, weight: p.adxWeight });

  // ── 8. Ichimoku ───────────────────────────────────────────────────────────
  const ichi = calculateIchimoku(candles);
  const ichiSig: "BUY" | "SELL" | "NEUTRAL" = ichi.signal === "BULLISH" ? "BUY" : ichi.signal === "BEARISH" ? "SELL" : "NEUTRAL";
  const ichiBuy = ichiSig === "BUY" ? p.ichiWeight : ichiSig === "NEUTRAL" ? p.ichiWeight * 0.28 : 0;
  const ichiSell = ichiSig === "SELL" ? p.ichiWeight : 0;
  totalWeight += p.ichiWeight;
  buyRaw += ichiBuy;
  sellRaw += ichiSell;
  fullIndicators.push({ name: "Ichimoku", value: ichi.signal, signal: ichiSig, weight: p.ichiWeight });

  // ── 9. EMA Trend (trending sessions boosted) ──────────────────────────────
  const emaTrendScore = scoreEMATrend(closes, session, p.emaWeight);
  const trend = detectTrend(closes);
  totalWeight += p.emaWeight;
  buyRaw += emaTrendScore.buy;
  sellRaw += emaTrendScore.sell;
  fullIndicators.push({ name: "EMA Trend", value: trend.trend, signal: emaTrendScore.signal, weight: p.emaWeight });

  // ── 10. ROC ───────────────────────────────────────────────────────────────
  const roc = calculateROC(closes);
  const rocSig: "BUY" | "SELL" | "NEUTRAL" = roc > 0.04 ? "BUY" : roc < -0.04 ? "SELL" : "NEUTRAL";
  const rocBuy = rocSig === "BUY" ? p.rocWeight : rocSig === "NEUTRAL" ? p.rocWeight * 0.30 : 0;
  const rocSell = rocSig === "SELL" ? p.rocWeight : 0;
  totalWeight += p.rocWeight;
  buyRaw += rocBuy;
  sellRaw += rocSell;
  fullIndicators.push({ name: "ROC (10)", value: roc.toFixed(4), signal: rocSig, weight: p.rocWeight });

  // ── 11. Candlestick Pattern ───────────────────────────────────────────────
  const pattern = detectCandlePattern(candles);
  totalWeight += p.patternWeight;
  if (pattern.bias === "BULLISH") buyRaw += (pattern.strength / 100) * p.patternWeight;
  else if (pattern.bias === "BEARISH") sellRaw += (pattern.strength / 100) * p.patternWeight;
  else {
    const lc = candles[candles.length - 1];
    if (lc.close > lc.open) buyRaw += p.patternWeight * 0.36; else sellRaw += p.patternWeight * 0.36;
  }

  // ── 12. Trend Detection ───────────────────────────────────────────────────
  totalWeight += p.trendWeight;
  if (trend.trend === "UPTREND") buyRaw += p.trendWeight * (1 + trend.strength / 200);
  else if (trend.trend === "DOWNTREND") sellRaw += p.trendWeight * (1 + trend.strength / 200);
  else {
    const n = closes.length;
    const micro = closes[n - 1] - closes[n - 4];
    if (micro > 0) buyRaw += p.trendWeight * 0.44; else if (micro < 0) sellRaw += p.trendWeight * 0.44;
    else buyRaw += p.trendWeight * 0.22;
  }

  // ── 13. Liquidity Zones ───────────────────────────────────────────────────
  const liquidity = detectLiquidityZones(candles, atr);
  totalWeight += p.liquidityWeight;
  if (liquidity.buyLiquidity) buyRaw += (liquidity.strength / 100) * p.liquidityWeight * 1.12;
  else if (liquidity.sellLiquidity) sellRaw += (liquidity.strength / 100) * p.liquidityWeight * 1.12;
  else {
    const lc = candles[candles.length - 1];
    if (lc.close > lc.open) buyRaw += p.liquidityWeight * 0.26; else sellRaw += p.liquidityWeight * 0.26;
  }

  // ── 14. Market Structure BOS/CHoCH ───────────────────────────────────────
  const structure = detectMarketStructure(candles);
  totalWeight += p.bosWeight;
  if (structure.bos === "BULLISH" || structure.choch === "BULLISH") buyRaw += p.bosWeight;
  else if (structure.bos === "BEARISH" || structure.choch === "BEARISH") sellRaw += p.bosWeight;
  else {
    const lc = candles[candles.length - 1];
    if (lc.close > lc.open) buyRaw += p.bosWeight * 0.36; else sellRaw += p.bosWeight * 0.36;
  }

  // ── 15. Price Action ──────────────────────────────────────────────────────
  const priceAction = analyzePriceAction(candles, atr);
  totalWeight += p.priceActionWeight;
  if (priceAction.priceActionSignal === "BUY") buyRaw += p.priceActionWeight * (1 + priceAction.zoneStrength / 180);
  else if (priceAction.priceActionSignal === "SELL") sellRaw += p.priceActionWeight * (1 + priceAction.zoneStrength / 180);
  else {
    if (priceAction.momentum > 5) buyRaw += p.priceActionWeight * 0.50;
    else if (priceAction.momentum < -5) sellRaw += p.priceActionWeight * 0.50;
    else if (priceAction.momentum >= 0) buyRaw += p.priceActionWeight * 0.34; else sellRaw += p.priceActionWeight * 0.34;
  }

  // ── 16. Candle Power ──────────────────────────────────────────────────────
  const candlePowerData = analyzeCandlePower(candles);
  totalWeight += p.candlePowerWeight;
  if (candlePowerData.dominance === "BUYER") buyRaw += p.candlePowerWeight * (candlePowerData.buyerStrength / 100);
  else if (candlePowerData.dominance === "SELLER") sellRaw += p.candlePowerWeight * (candlePowerData.sellerStrength / 100);
  else {
    buyRaw += p.candlePowerWeight * (candlePowerData.buyerStrength / 100);
    sellRaw += p.candlePowerWeight * (candlePowerData.sellerStrength / 100);
  }

  // ── 17. Market Zone ───────────────────────────────────────────────────────
  const marketZone = detectMarketZone(candles, atr);
  totalWeight += p.marketZoneWeight;
  if (marketZone.zone === "SUPPORT") buyRaw += p.marketZoneWeight * (Math.max(30, marketZone.zoneStrength) / 100);
  else if (marketZone.zone === "RESISTANCE") sellRaw += p.marketZoneWeight * (Math.max(30, marketZone.zoneStrength) / 100);
  else {
    if (priceAction.momentum >= 0) buyRaw += p.marketZoneWeight * 0.36; else sellRaw += p.marketZoneWeight * 0.36;
  }

  // ── 18. S/R Proximity ────────────────────────────────────────────────────
  const sr = findSupportResistance(candles);
  totalWeight += p.srWeight;
  const lastClose = closes[closes.length - 1];
  if (atr > 0) {
    const distSup = lastClose - sr.support;
    const distRes = sr.resistance - lastClose;
    if (distSup < atr * 0.7 && distSup < distRes) buyRaw += p.srWeight;
    else if (distRes < atr * 0.7 && distRes < distSup) sellRaw += p.srWeight;
    else if (lastClose > (sr.support + sr.resistance) / 2) buyRaw += p.srWeight * 0.30;
    else sellRaw += p.srWeight * 0.30;
  }

  // ── 19. Volume ────────────────────────────────────────────────────────────
  const volume = analyzeVolume(candles);
  totalWeight += p.volumeWeight;
  const lastC = candles[candles.length - 1];
  if (volume.trend === "INCREASING") {
    if (lastC.close > lastC.open) buyRaw += p.volumeWeight * 1.12; else sellRaw += p.volumeWeight * 1.12;
  } else {
    if (lastC.close > lastC.open) buyRaw += p.volumeWeight * 0.40; else sellRaw += p.volumeWeight * 0.40;
  }

  // ── Manipulation guard ────────────────────────────────────────────────────
  const manip = detectManipulation(candles, atr);
  if (manip.detected) { buyRaw *= 0.58; sellRaw *= 0.58; }

  // ── Session quality multiplier ─────────────────────────────────────────────
  const buyScore = buyRaw * sessionQuality;
  const sellScore = sellRaw * sessionQuality;
  const buyPct = (buyScore / totalWeight) * 100;
  const sellPct = (sellScore / totalWeight) * 100;
  const diff = Math.abs(buyPct - sellPct);

  // ── Force direction — never neutral ──────────────────────────────────────
  let prelimDir = forceDirection(buyScore, sellScore, candles);
  prelimDir = applyStreakPenalty(pair, buyScore, sellScore, prelimDir);

  // ── Confirmation ─────────────────────────────────────────────────────────
  const confirmation = runConfirmation(candles, prelimDir);
  if (!confirmation.confirmed && confirmation.score < 25 && diff < 6) {
    prelimDir = prelimDir === "BUY" ? "SELL" : "BUY";
  }

  const direction: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";

  // ── Confidence calculation ────────────────────────────────────────────────
  const bb = calculateBollingerBands(closes);
  const bbBonus = bb.bbSignal === "STRONG_BUY" || bb.bbSignal === "STRONG_SELL" ? 7 : bb.bbSignal === "BUY" || bb.bbSignal === "SELL" ? 4 : 0;
  const squeezeBonus = bb.squeeze ? 5 : 0;
  const breakoutBonus = bb.breakout !== "NONE" ? 5 : 0;
  const trendBonus = trend.trend !== "SIDEWAYS" ? 3 : 0;
  const structureBonus = (structure.bos !== "NONE" || structure.choch !== "NONE") ? 4 : 0;
  const liquidityBonus = liquidity.liquidityType !== "None" ? 3 : 0;
  const adxBonus = adx.adx > 25 ? 3 : 0;
  const manipPenalty = manip.detected ? 8 : 0;
  const streakDir: SignalDirection = prelimDir === "BUY" ? "CALL" : "PUT";
  const streak = getSameDirectionStreak(pair, streakDir);
  const streakPenalty = streak >= 2 ? streak * 1.5 : 0;

  const rawConf = 58 + diff * 1.85 + confirmation.score * 0.14 + bbBonus + squeezeBonus + breakoutBonus + trendBonus + structureBonus + liquidityBonus + adxBonus + p.sessionConfBonus;
  const confidence = Math.min(97, Math.max(64, rawConf - manipPenalty - streakPenalty));
  const roundedConf = Math.round(confidence);
  const strength: SignalStrength = roundedConf >= 84 ? "STRONG" : roundedConf >= 72 ? "MODERATE" : "WEAK";

  // ── Bangladesh timezone entry/expiry (exact 1-minute future candle) ────────
  const now = new Date();
  const bdNow = getBangladeshTime();
  const secondsLeft = 60 - bdNow.getSeconds();
  // Entry = next candle open (exact minute boundary)
  const nextCandleOpenBD = new Date(bdNow.getTime() + secondsLeft * 1000);
  // Expiry = EXACTLY 1 minute after entry (binary option expires at next candle close)
  const expiryBD = new Date(nextCandleOpenBD.getTime() + 60 * 1000);

  const liqSuffix = liquidity.liquidityType !== "None" ? ` • ${liquidity.liquidityType}` : "";
  const manipSuffix = manip.detected ? ` ⚠️${manip.reason}` : "";
  const bbSuffix = bb.squeeze ? " • BB Squeeze" : bb.breakout !== "NONE" ? ` • BB ${bb.breakout === "UPPER" ? "↑Break" : "↓Break"}` : "";

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
    sessionName: `${p.label} • ${p.strategy}`,
    entryTime: formatBDTime(nextCandleOpenBD) + " BDT",
    expiryTime: formatBDTime(expiryBD) + " BDT",
    rsi: parseFloat(rsiVal.toFixed(2)),
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

// ─────────────────────────────────────────────────────────────────────────────
// DEMO SIGNAL GENERATOR (Session-Aware)
// ─────────────────────────────────────────────────────────────────────────────
const demoDirectionHistory = new Map<string, SignalDirection[]>();

export function generateDemoSignal(pair: string): Signal {
  const { session, label: sessionLabel } = getMarketSession();
  const p = getSessionProfile(session);
  const minuteSeed = Math.floor(Date.now() / 60000);
  const pairSeed = pair.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = (pairSeed * 9973 + minuteSeed * 6991 + 314159) % 1000003;
  const rand = (offset = 0) => ((seed * 9301 + offset * 49297 + 233917) % 233280) / 233280;

  // Session-aware directional bias
  const sessionBias = session === "OVERLAP" ? 0.54 :
                      session === "LONDON" || session === "NEW_YORK" ? 0.52 : 0.50;
  const rawBias = rand(1);
  const demoHistory = demoDirectionHistory.get(pair) || [];
  let direction: SignalDirection;
  const lastTwo = demoHistory.slice(-2);
  const allSame = lastTwo.length === 2 && lastTwo[0] === lastTwo[1];

  if (allSame && rand(15) > 0.42) direction = lastTwo[0] === "CALL" ? "PUT" : "CALL";
  else direction = rawBias < sessionBias ? "CALL" : "PUT";

  demoHistory.push(direction);
  if (demoHistory.length > MAX_HISTORY) demoHistory.shift();
  demoDirectionHistory.set(pair, demoHistory);

  // Session-tuned confidence ranges
  const confBase = session === "OVERLAP" ? 72 :
                   session === "LONDON" || session === "NEW_YORK" ? 70 :
                   session === "TOKYO" ? 66 : 64;
  const confidence = Math.round(Math.min(97, confBase + rand(2) * 24));
  const strength: SignalStrength = confidence >= 84 ? "STRONG" : confidence >= 72 ? "MODERATE" : "WEAK";
  const s: "BUY" | "SELL" = direction === "CALL" ? "BUY" : "SELL";

  // Session-specific RSI ranges
  const rsiOsBase = direction === "CALL" ? 18 : 56;
  const rsiRange = direction === "CALL" ? 16 : 28;
  const rsiVal = parseFloat((rsiOsBase + rand(3) * rsiRange).toFixed(2));

  const buyerStr = direction === "CALL" ? Math.round(58 + rand(8) * 30) : Math.round(18 + rand(8) * 24);
  const sellerStr = 100 - buyerStr;
  const candlePwr = Math.round(54 + rand(9) * 38);
  const confirmScore = Math.round(64 + rand(10) * 28);

  const bbPctB = direction === "CALL" ? rand(20) * 0.18 : 0.82 + rand(20) * 0.18;
  const bbSqueeze = rand(21) > 0.52;
  const bbBreakout = rand(22) > 0.68 ? (direction === "CALL" ? "↓Break" : "↑Break") : "";
  const bbLabel = `%B:${(bbPctB * 100).toFixed(1)}%${bbSqueeze ? " (Squeeze)" : ""}${bbBreakout ? ` ${bbBreakout}` : ""}`;

  // Session-specific indicator labels
  const macdVal = direction === "CALL"
    ? (0.00008 + rand(30) * 0.0002).toFixed(6)
    : `-${(0.00006 + rand(30) * 0.0002).toFixed(6)}`;

  const adxVal = session === "LONDON" || session === "NEW_YORK" || session === "OVERLAP"
    ? (24 + rand(5) * 18).toFixed(1) // stronger trends in trending sessions
    : (14 + rand(5) * 14).toFixed(1);
  const plusDI = direction === "CALL" ? (26 + rand(13) * 12).toFixed(1) : (10 + rand(13) * 9).toFixed(1);

  const stochK = direction === "CALL"
    ? (session === "TOKYO" || session === "SYDNEY" ? 12 + rand(14) * 16 : 15 + rand(14) * 14).toFixed(1)
    : (session === "TOKYO" || session === "SYDNEY" ? 76 + rand(14) * 12 : 78 + rand(14) * 10).toFixed(1);

  const liqTypes = ["Bullish Order Block", "Bearish Order Block", "Liquidity Grab (Bullish)", "Liquidity Grab (Bearish)"];
  const liqType = direction === "CALL" ? liqTypes[Math.floor(rand(7) * 2)] : liqTypes[1 + Math.floor(rand(7) * 2)];

  const zones = ["Support Zone", "Resistance Zone", "Supply Zone", "Demand Zone", "Key Level", "Fair Value Gap"];
  const zoneLabel = direction === "CALL" ? zones[Math.floor(rand(11) * 2)] : zones[1 + Math.floor(rand(11) * 3)];

  // Session-specific patterns
  const bullPatterns = session === "TOKYO" || session === "SYDNEY"
    ? ["Hammer", "Bullish Harami", "Morning Star", "Doji Reversal", "Piercing Line"]
    : ["Bullish Engulfing", "Three White Soldiers", "Bullish Marubozu", "Morning Star", "Momentum Breakout"];
  const bearPatterns = session === "TOKYO" || session === "SYDNEY"
    ? ["Shooting Star", "Bearish Harami", "Evening Star", "Dark Cloud Cover", "Hanging Man"]
    : ["Bearish Engulfing", "Three Black Crows", "Bearish Marubozu", "Evening Star", "Momentum Breakdown"];
  const patternName = direction === "CALL"
    ? bullPatterns[Math.floor(rand(6) * bullPatterns.length)]
    : bearPatterns[Math.floor(rand(6) * bearPatterns.length)];

  const indicators: IndicatorResult[] = [
    { name: "Bollinger Bands ★", value: bbLabel, signal: s, weight: p.bbWeight },
    { name: "RSI (14)", value: rsiVal.toString(), signal: s, weight: p.rsiWeight },
    { name: "MACD", value: macdVal, signal: s, weight: p.macdWeight },
    { name: "Stochastic", value: `K:${stochK} D:${direction === "CALL" ? "14.8" : "80.2"}`, signal: s, weight: p.stochWeight },
    { name: "Williams %R", value: direction === "CALL" ? (-84 - rand(15) * 14).toFixed(1) : (-7 - rand(15) * 12).toFixed(1), signal: s, weight: p.williamsRWeight },
    { name: "CCI (20)", value: direction === "CALL" ? (-118 - rand(16) * 45).toFixed(1) : (120 + rand(16) * 45).toFixed(1), signal: s, weight: p.cciWeight },
    { name: "ADX/DI", value: `ADX:${adxVal} +DI:${plusDI}`, signal: s, weight: p.adxWeight },
    { name: "Ichimoku", value: direction === "CALL" ? "T>K Bull" : "T<K Bear", signal: s, weight: p.ichiWeight },
    { name: "EMA Trend", value: direction === "CALL" ? "UPTREND" : "DOWNTREND", signal: s, weight: p.emaWeight },
    { name: "ROC (10)", value: direction === "CALL" ? (0.05 + rand(17) * 0.08).toFixed(4) : -(0.05 + rand(17) * 0.08).toFixed(4), signal: s, weight: p.rocWeight },
    { name: "Price Action", value: direction === "CALL" ? "Bullish Rejection" : "Bearish Rejection", signal: s, weight: p.priceActionWeight },
    { name: "Candle Power", value: `${candlePwr}% body`, signal: s, weight: p.candlePowerWeight },
  ];

  // Precise entry & expiry in BDT
  const now2 = new Date();
  const bdNow2 = getBangladeshTime();
  const secsLeft2 = 60 - bdNow2.getSeconds();
  const nextCandle2 = new Date(bdNow2.getTime() + secsLeft2 * 1000);
  const expiry2 = new Date(nextCandle2.getTime() + 60 * 1000);

  return {
    id: generateId(),
    pair,
    direction,
    strength,
    confidence,
    timestamp: now2,
    expiry: "1 Min",
    indicators,
    sessionName: `${p.label} • ${p.strategy}`,
    entryTime: formatBDTime(nextCandle2) + " BDT",
    expiryTime: formatBDTime(expiry2) + " BDT",
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
