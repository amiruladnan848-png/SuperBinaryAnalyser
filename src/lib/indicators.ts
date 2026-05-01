import { CandleData, IndicatorResult } from "@/types";

// ─── RSI (Wilder's Smoothed) ──────────────────────────────────────────────────
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// ─── EMA ──────────────────────────────────────────────────────────────────────
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return values.slice();
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

// ─── SMA ──────────────────────────────────────────────────────────────────────
export function calculateSMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ─── MACD ────────────────────────────────────────────────────────────────────
export function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signalLine = calculateEMA(macdLine, 9);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return { macd: lastMacd, signal: lastSignal, histogram: lastMacd - lastSignal };
}

export function getMACDCross(closes: number[]): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (closes.length < 40) return "NEUTRAL";
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signalLine = calculateEMA(macdLine, 9);
  const mLen = macdLine.length, sLen = signalLine.length;
  const prevMacd = macdLine[mLen - 2], prevSig = signalLine[sLen - 2];
  const currMacd = macdLine[mLen - 1], currSig = signalLine[sLen - 1];
  if (prevMacd <= prevSig && currMacd > currSig) return "BULLISH";
  if (prevMacd >= prevSig && currMacd < currSig) return "BEARISH";
  if (currMacd > currSig) return "BULLISH";
  if (currMacd < currSig) return "BEARISH";
  return "NEUTRAL";
}

// ─── BOLLINGER BANDS (Enhanced — core indicator) ──────────────────────────────
export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
  squeeze: boolean;
  squeezeMomentum: number; // positive = bullish, negative = bearish
  breakout: "UPPER" | "LOWER" | "NONE";
  walkingBand: "UPPER" | "LOWER" | "NONE";
  bbSignal: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL" | "NEUTRAL";
  expansion: boolean;
  contraction: boolean;
}

export function calculateBollingerBands(closes: number[], period = 20, stdDevMult = 2): BollingerResult {
  if (closes.length < period) {
    const last = closes[closes.length - 1] ?? 0;
    return {
      upper: last, middle: last, lower: last, bandwidth: 0, percentB: 0.5,
      squeeze: false, squeezeMomentum: 0, breakout: "NONE", walkingBand: "NONE",
      bbSignal: "NEUTRAL", expansion: false, contraction: false,
    };
  }

  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + stdDevMult * sd;
  const lower = mean - stdDevMult * sd;
  const bandwidth = mean > 0 ? ((upper - lower) / mean) * 100 : 0;
  const last = closes[closes.length - 1];
  const percentB = upper === lower ? 0.5 : (last - lower) / (upper - lower);

  // ── Squeeze detection: BB narrower than recent 20-period average bandwidth ─
  let squeeze = false;
  let avgBW = bandwidth;
  if (closes.length >= period + 10) {
    const bwHistory: number[] = [];
    for (let i = 0; i < 10; i++) {
      const s = closes.slice(-(period + i + 1), -(i + 1) || undefined);
      if (s.length < period) continue;
      const m2 = s.reduce((a, b) => a + b, 0) / period;
      const v2 = s.reduce((a, b) => a + Math.pow(b - m2, 2), 0) / period;
      const sd2 = Math.sqrt(v2);
      const bw2 = m2 > 0 ? ((m2 + stdDevMult * sd2 - (m2 - stdDevMult * sd2)) / m2) * 100 : 0;
      bwHistory.push(bw2);
    }
    avgBW = bwHistory.reduce((a, b) => a + b, 0) / bwHistory.length || bandwidth;
    squeeze = bandwidth < avgBW * 0.75;
  }

  // ── Squeeze momentum: EMA of (close - midline) during squeeze ──────────────
  const recentCloses = closes.slice(-5);
  const squeezeMomentum = recentCloses.reduce((sum, c) => sum + (c - mean), 0) / recentCloses.length;

  // ── Breakout detection ─────────────────────────────────────────────────────
  let breakout: "UPPER" | "LOWER" | "NONE" = "NONE";
  const prevClose = closes[closes.length - 2] ?? last;
  if (last > upper && prevClose <= upper) breakout = "UPPER";
  else if (last < lower && prevClose >= lower) breakout = "LOWER";

  // ── Walking the bands: 3 consecutive closes above/below band ──────────────
  let walkingBand: "UPPER" | "LOWER" | "NONE" = "NONE";
  if (closes.length >= period + 3) {
    const last3 = closes.slice(-3);
    // Recalculate bands for last 3 positions
    const walkUpper = (i: number) => {
      const s = closes.slice(-(period + (2 - i)), -(2 - i) || undefined);
      if (!s.length) return upper;
      const m = s.reduce((a, b) => a + b, 0) / s.length;
      const v = s.reduce((a, b) => a + Math.pow(b - m, 2), 0) / s.length;
      return m + stdDevMult * Math.sqrt(v);
    };
    const walkLower = (i: number) => {
      const s = closes.slice(-(period + (2 - i)), -(2 - i) || undefined);
      if (!s.length) return lower;
      const m = s.reduce((a, b) => a + b, 0) / s.length;
      const v = s.reduce((a, b) => a + Math.pow(b - m, 2), 0) / s.length;
      return m - stdDevMult * Math.sqrt(v);
    };
    const allAboveUpper = last3.every((c, i) => c >= walkUpper(i) * 0.9995);
    const allBelowLower = last3.every((c, i) => c <= walkLower(i) * 1.0005);
    if (allAboveUpper) walkingBand = "UPPER";
    else if (allBelowLower) walkingBand = "LOWER";
  }

  // ── Bandwidth expansion/contraction ───────────────────────────────────────
  const expansion = bandwidth > avgBW * 1.25;
  const contraction = bandwidth < avgBW * 0.85;

  // ── Composite BB signal ────────────────────────────────────────────────────
  let bbSignal: BollingerResult["bbSignal"] = "NEUTRAL";

  if (breakout === "LOWER" && squeezeMomentum < 0) bbSignal = "STRONG_BUY";
  else if (percentB <= 0.05 && sd > 0) bbSignal = "STRONG_BUY";
  else if (breakout === "UPPER" && squeezeMomentum > 0) bbSignal = "STRONG_SELL";
  else if (percentB >= 0.95 && sd > 0) bbSignal = "STRONG_SELL";
  else if (walkingBand === "UPPER" && expansion) bbSignal = "SELL"; // overbought walk
  else if (walkingBand === "LOWER" && expansion) bbSignal = "BUY"; // oversold walk
  else if (squeeze && squeezeMomentum > 0) bbSignal = "BUY";
  else if (squeeze && squeezeMomentum < 0) bbSignal = "SELL";
  else if (percentB <= 0.2) bbSignal = "BUY";
  else if (percentB >= 0.8) bbSignal = "SELL";
  else if (percentB < 0.42) bbSignal = "BUY";
  else if (percentB > 0.58) bbSignal = "SELL";

  return {
    upper, middle: mean, lower, bandwidth, percentB,
    squeeze, squeezeMomentum, breakout, walkingBand,
    bbSignal, expansion, contraction,
  };
}

// ─── Stochastic ───────────────────────────────────────────────────────────────
export function calculateStochastic(candles: CandleData[], kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod) return { k: 50, d: 50 };
  const kValues: number[] = [];
  for (let end = candles.length - dPeriod; end <= candles.length; end++) {
    const slice = candles.slice(Math.max(0, end - kPeriod), end);
    if (!slice.length) continue;
    const hh = Math.max(...slice.map(c => c.high));
    const ll = Math.min(...slice.map(c => c.low));
    const cc = slice[slice.length - 1].close;
    kValues.push(hh === ll ? 50 : ((cc - ll) / (hh - ll)) * 100);
  }
  const k = kValues[kValues.length - 1] ?? 50;
  const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / Math.min(dPeriod, kValues.length);
  return { k, d };
}

// ─── Williams %R ──────────────────────────────────────────────────────────────
export function calculateWilliamsR(candles: CandleData[], period = 14): number {
  if (candles.length < period) return -50;
  const slice = candles.slice(-period);
  const hh = Math.max(...slice.map(c => c.high));
  const ll = Math.min(...slice.map(c => c.low));
  const close = candles[candles.length - 1].close;
  if (hh === ll) return -50;
  return ((hh - close) / (hh - ll)) * -100;
}

// ─── CCI ─────────────────────────────────────────────────────────────────────
export function calculateCCI(candles: CandleData[], period = 20): number {
  if (candles.length < period) return 0;
  const slice = candles.slice(-period);
  const tps = slice.map(c => (c.high + c.low + c.close) / 3);
  const mean = tps.reduce((a, b) => a + b, 0) / period;
  const md = tps.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  const lastTp = tps[tps.length - 1];
  if (md === 0) return 0;
  return (lastTp - mean) / (0.015 * md);
}

// ─── ATR ─────────────────────────────────────────────────────────────────────
export function calculateATR(candles: CandleData[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
}

// ─── ROC ─────────────────────────────────────────────────────────────────────
export function calculateROC(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 0;
  const past = closes[closes.length - 1 - period];
  if (past === 0) return 0;
  return ((closes[closes.length - 1] - past) / past) * 100;
}

// ─── ADX ─────────────────────────────────────────────────────────────────────
export function calculateADX(candles: CandleData[], period = 14): { adx: number; plusDI: number; minusDI: number } {
  if (candles.length < period + 2) return { adx: 0, plusDI: 0, minusDI: 0 };
  let plusDM = 0, minusDM = 0, tr = 0;
  for (let i = 1; i <= period; i++) {
    const c = candles[candles.length - period - 1 + i];
    const p = candles[candles.length - period - 2 + i];
    const up = c.high - p.high, down = p.low - c.low;
    plusDM += up > down && up > 0 ? up : 0;
    minusDM += down > up && down > 0 ? down : 0;
    tr += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  if (tr === 0) return { adx: 0, plusDI: 0, minusDI: 0 };
  const plusDI = (plusDM / tr) * 100;
  const minusDI = (minusDM / tr) * 100;
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI + 0.001) * 100;
  return { adx: dx, plusDI, minusDI };
}

// ─── Pivot Points ─────────────────────────────────────────────────────────────
export function calculatePivotPoints(candles: CandleData[]) {
  if (candles.length < 2) {
    const c = candles[0] ?? { high: 0, low: 0, close: 0 };
    return { pp: c.close, r1: c.close, r2: c.close, r3: c.close, s1: c.close, s2: c.close, s3: c.close };
  }
  const prev = candles[candles.length - 2];
  const h = prev.high, l = prev.low, c = prev.close;
  const pp = (h + l + c) / 3;
  return {
    pp, r1: 2 * pp - l, r2: pp + (h - l), r3: h + 2 * (pp - l),
    s1: 2 * pp - h, s2: pp - (h - l), s3: l - 2 * (h - pp),
  };
}

// ─── Ichimoku ─────────────────────────────────────────────────────────────────
export function calculateIchimoku(candles: CandleData[]) {
  const getMiddle = (c: CandleData[], period: number) => {
    const slice = c.slice(-period);
    return (Math.max(...slice.map(x => x.high)) + Math.min(...slice.map(x => x.low))) / 2;
  };
  if (candles.length < 52) return { tenkan: 0, kijun: 0, signal: "NEUTRAL" as const };
  const tenkan = getMiddle(candles, 9);
  const kijun = getMiddle(candles, 26);
  const close = candles[candles.length - 1].close;
  let signal: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (tenkan > kijun && close > kijun) signal = "BULLISH";
  else if (tenkan < kijun && close < kijun) signal = "BEARISH";
  return { tenkan, kijun, signal };
}

// ─── Liquidity Zone Detection ─────────────────────────────────────────────────
export function detectLiquidityZones(candles: CandleData[], atr: number): {
  buyLiquidity: boolean;
  sellLiquidity: boolean;
  liquidityType: string;
  strength: number;
} {
  if (candles.length < 20 || atr === 0) return { buyLiquidity: false, sellLiquidity: false, liquidityType: "None", strength: 0 };

  const last = candles[candles.length - 1];
  const prev20 = candles.slice(-20, -1);

  const swingHighs = prev20.filter((c, i) =>
    i > 0 && i < prev20.length - 1 &&
    c.high > prev20[i - 1].high && c.high > prev20[i + 1].high
  ).map(c => c.high);

  const swingLows = prev20.filter((c, i) =>
    i > 0 && i < prev20.length - 1 &&
    c.low < prev20[i - 1].low && c.low < prev20[i + 1].low
  ).map(c => c.low);

  const closePrice = last.close;
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  let buyLiquidity = false, sellLiquidity = false, liquidityType = "None", strength = 0;

  const nearSwingLow = swingLows.some(l => Math.abs(closePrice - l) < atr * 0.8);
  const nearSwingHigh = swingHighs.some(h => Math.abs(closePrice - h) < atr * 0.8);

  if (lowerWick > atr * 1.2 && nearSwingLow) {
    buyLiquidity = true; liquidityType = "Liquidity Grab (Bullish)";
    strength = Math.min(100, (lowerWick / atr) * 40);
  } else if (upperWick > atr * 1.2 && nearSwingHigh) {
    sellLiquidity = true; liquidityType = "Liquidity Grab (Bearish)";
    strength = Math.min(100, (upperWick / atr) * 40);
  }

  const prevCandle = candles[candles.length - 2];
  const prevBody = Math.abs(prevCandle.close - prevCandle.open);
  if (prevBody > atr * 1.5) {
    if (prevCandle.close < prevCandle.open && last.close > last.open) {
      buyLiquidity = true; liquidityType = "Bullish Order Block"; strength = Math.max(strength, 75);
    } else if (prevCandle.close > prevCandle.open && last.close < last.open) {
      sellLiquidity = true; liquidityType = "Bearish Order Block"; strength = Math.max(strength, 75);
    }
  }

  return { buyLiquidity, sellLiquidity, liquidityType, strength };
}

// ─── Market Structure ────────────────────────────────────────────────────────
export function detectMarketStructure(candles: CandleData[]): {
  bos: "BULLISH" | "BEARISH" | "NONE";
  choch: "BULLISH" | "BEARISH" | "NONE";
} {
  if (candles.length < 10) return { bos: "NONE", choch: "NONE" };
  const recent = candles.slice(-10);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  const prevHigh = Math.max(...highs.slice(0, -1));
  const prevLow = Math.min(...lows.slice(0, -1));
  let bos: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  let choch: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  if (lastHigh > prevHigh) bos = "BULLISH";
  else if (lastLow < prevLow) bos = "BEARISH";
  const midHigh = Math.max(...highs.slice(2, 6));
  const midLow = Math.min(...lows.slice(2, 6));
  if (lastHigh > midHigh && lows[lows.length - 3] < lows[lows.length - 5]) choch = "BULLISH";
  else if (lastLow < midLow && highs[highs.length - 3] > highs[highs.length - 5]) choch = "BEARISH";
  return { bos, choch };
}

// ─── Volume ───────────────────────────────────────────────────────────────────
export function analyzeVolume(candles: CandleData[]): { trend: "INCREASING" | "DECREASING" | "NEUTRAL"; ratio: number } {
  if (candles.length < 10) return { trend: "NEUTRAL", ratio: 1 };
  const recent = candles.slice(-5).map(c => c.volume).filter(v => v > 0);
  const older = candles.slice(-10, -5).map(c => c.volume).filter(v => v > 0);
  if (!recent.length || !older.length) return { trend: "NEUTRAL", ratio: 1 };
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
  if (avgOlder === 0) return { trend: "NEUTRAL", ratio: 1 };
  const ratio = avgRecent / avgOlder;
  if (ratio > 1.3) return { trend: "INCREASING", ratio };
  if (ratio < 0.7) return { trend: "DECREASING", ratio };
  return { trend: "NEUTRAL", ratio };
}

// ─── Candlestick Pattern Detection ───────────────────────────────────────────
export function detectCandlePattern(candles: CandleData[]): {
  pattern: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number;
} {
  if (candles.length < 3) return { pattern: "No Data", bias: "NEUTRAL", strength: 0 };
  const c = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];
  const body = Math.abs(c.close - c.open);
  const prevBody = Math.abs(prev.close - prev.open);
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const totalRange = c.high - c.low;
  const isBullish = c.close > c.open;
  const isBearish = c.close < c.open;

  const p3 = candles.length > 3 ? candles[candles.length - 4] : null;

  if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < prevBody * 0.4 && c.close > c.open && c.close > (prev2.open + prev2.close) / 2)
    return { pattern: "Morning Star", bias: "BULLISH", strength: 92 };
  if (prev2.close > prev2.open && Math.abs(prev.close - prev.open) < prevBody * 0.4 && c.close < c.open && c.close < (prev2.open + prev2.close) / 2)
    return { pattern: "Evening Star", bias: "BEARISH", strength: 92 };
  if (p3 && prev2.close > prev2.open && prev.close > prev.open && c.close > c.open && prev2.close > p3.close && prev.close > prev2.close && c.close > prev.close)
    return { pattern: "Three White Soldiers", bias: "BULLISH", strength: 96 };
  if (p3 && prev2.close < prev2.open && prev.close < prev.open && c.close < c.open && prev2.close < p3.close && prev.close < prev2.close && c.close < prev.close)
    return { pattern: "Three Black Crows", bias: "BEARISH", strength: 96 };
  if (prev.close < prev.open && isBullish && c.open <= prev.close && c.close >= prev.open)
    return { pattern: "Bullish Engulfing", bias: "BULLISH", strength: 88 };
  if (prev.close > prev.open && isBearish && c.open >= prev.close && c.close <= prev.open)
    return { pattern: "Bearish Engulfing", bias: "BEARISH", strength: 88 };
  if (prev.close < prev.open && isBullish && c.open < prev.low && c.close > (prev.open + prev.close) / 2)
    return { pattern: "Piercing Line", bias: "BULLISH", strength: 80 };
  if (prev.close > prev.open && isBearish && c.open > prev.high && c.close < (prev.open + prev.close) / 2)
    return { pattern: "Dark Cloud Cover", bias: "BEARISH", strength: 80 };
  if (prev.close < prev.open && isBullish && c.open > prev.close && c.close < prev.open && body < prevBody * 0.5)
    return { pattern: "Bullish Harami", bias: "BULLISH", strength: 72 };
  if (prev.close > prev.open && isBearish && c.open < prev.close && c.close > prev.open && body < prevBody * 0.5)
    return { pattern: "Bearish Harami", bias: "BEARISH", strength: 72 };
  if (lowerWick >= body * 2 && upperWick <= body * 0.5 && isBullish && totalRange > 0)
    return { pattern: "Hammer", bias: "BULLISH", strength: 77 };
  if (upperWick >= body * 2 && lowerWick <= body * 0.5 && isBearish && totalRange > 0)
    return { pattern: "Shooting Star", bias: "BEARISH", strength: 77 };
  if (upperWick >= body * 2 && lowerWick <= body * 0.5 && isBullish)
    return { pattern: "Inverted Hammer", bias: "BULLISH", strength: 65 };
  if (lowerWick >= body * 2 && upperWick <= body * 0.5 && isBearish)
    return { pattern: "Hanging Man", bias: "BEARISH", strength: 65 };
  if (isBullish && upperWick < body * 0.05 && lowerWick < body * 0.05)
    return { pattern: "Bullish Marubozu", bias: "BULLISH", strength: 82 };
  if (isBearish && upperWick < body * 0.05 && lowerWick < body * 0.05)
    return { pattern: "Bearish Marubozu", bias: "BEARISH", strength: 82 };
  if (totalRange > 0 && body < totalRange * 0.08)
    return { pattern: "Doji", bias: "NEUTRAL", strength: 50 };
  if (body < totalRange * 0.25 && upperWick > body && lowerWick > body)
    return { pattern: "Spinning Top", bias: "NEUTRAL", strength: 30 };
  if (isBullish) return { pattern: "Bullish Candle", bias: "BULLISH", strength: 45 };
  if (isBearish) return { pattern: "Bearish Candle", bias: "BEARISH", strength: 45 };
  return { pattern: "Neutral Candle", bias: "NEUTRAL", strength: 15 };
}

// ─── Manipulation Detection ───────────────────────────────────────────────────
export function detectManipulation(candles: CandleData[], atr: number): { detected: boolean; reason: string } {
  if (candles.length < 5 || atr === 0) return { detected: false, reason: "" };
  const c = candles[candles.length - 1];
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  if (upperWick > atr * 2.5) return { detected: true, reason: "Stop Hunt (Upper)" };
  if (lowerWick > atr * 2.5) return { detected: true, reason: "Liquidity Grab (Lower)" };
  const recentVols = candles.slice(-5, -1).map(c => c.volume);
  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  if (avgVol > 0 && c.volume > avgVol * 4) return { detected: true, reason: "Volume Spike Anomaly" };
  const prev = candles[candles.length - 2];
  if (Math.abs(c.open - prev.close) > atr * 2) return { detected: true, reason: "Price Gap Detected" };
  return { detected: false, reason: "" };
}

// ─── Trend Detection ──────────────────────────────────────────────────────────
export function detectTrend(closes: number[]): { trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS"; strength: number } {
  if (closes.length < 21) return { trend: "SIDEWAYS", strength: 0 };
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const lastEma9 = ema9[ema9.length - 1];
  const lastEma21 = ema21[ema21.length - 1];
  const recentEma9 = ema9.slice(-3);
  const recentEma21 = ema21.slice(-3);
  const allAbove = recentEma9.every((v, i) => v > recentEma21[i]);
  const allBelow = recentEma9.every((v, i) => v < recentEma21[i]);
  const diff = ((lastEma9 - lastEma21) / (lastEma21 || 1)) * 100;
  if (allAbove && diff > 0.015) return { trend: "UPTREND", strength: Math.min(100, Math.abs(diff) * 30) };
  if (allBelow && diff < -0.015) return { trend: "DOWNTREND", strength: Math.min(100, Math.abs(diff) * 30) };
  return { trend: "SIDEWAYS", strength: 0 };
}

// ─── Support/Resistance ───────────────────────────────────────────────────────
export function findSupportResistance(candles: CandleData[]) {
  const slice = candles.slice(-30);
  return {
    resistance: Math.max(...slice.map(c => c.high)),
    support: Math.min(...slice.map(c => c.low)),
  };
}

// ─── Main Indicator Runner ────────────────────────────────────────────────────
export function runAllIndicators(candles: CandleData[]): IndicatorResult[] {
  const closes = candles.map(c => c.close);
  const results: IndicatorResult[] = [];

  // 1. RSI (14) — weight 18
  const rsi = calculateRSI(closes, 14);
  const rsiSig: "BUY" | "SELL" | "NEUTRAL" = rsi <= 35 ? "BUY" : rsi >= 65 ? "SELL" : rsi < 47 ? "BUY" : rsi > 53 ? "SELL" : "NEUTRAL";
  results.push({ name: "RSI (14)", value: rsi.toFixed(2), signal: rsiSig, weight: 18 });

  // 2. MACD Cross — weight 16
  const macdCross = getMACDCross(closes);
  const { histogram } = calculateMACD(closes);
  results.push({ name: "MACD", value: histogram.toFixed(6), signal: macdCross === "BULLISH" ? "BUY" : macdCross === "BEARISH" ? "SELL" : "NEUTRAL", weight: 16 });

  // 3. Bollinger Bands (Enhanced — highest weight) — weight 28
  const bb = calculateBollingerBands(closes);
  const bbSig: "BUY" | "SELL" | "NEUTRAL" =
    bb.bbSignal === "STRONG_BUY" || bb.bbSignal === "BUY" ? "BUY" :
    bb.bbSignal === "STRONG_SELL" || bb.bbSignal === "SELL" ? "SELL" : "NEUTRAL";
  const bbLabel = `%B:${(bb.percentB * 100).toFixed(1)}% ${bb.squeeze ? "SQZ" : ""} ${bb.breakout !== "NONE" ? "BRK" : ""}`.trim();
  results.push({ name: "Bollinger Bands", value: bbLabel, signal: bbSig, weight: 28 });

  // 4. Stochastic — weight 14
  const stoch = calculateStochastic(candles);
  const stochSig: "BUY" | "SELL" | "NEUTRAL" = (stoch.k < 25 && stoch.d < 30) ? "BUY" : (stoch.k > 75 && stoch.d > 70) ? "SELL" : (stoch.k < 40 && stoch.k > stoch.d) ? "BUY" : (stoch.k > 60 && stoch.k < stoch.d) ? "SELL" : "NEUTRAL";
  results.push({ name: "Stochastic", value: `K:${stoch.k.toFixed(1)} D:${stoch.d.toFixed(1)}`, signal: stochSig, weight: 14 });

  // 5. Williams %R — weight 10
  const willR = calculateWilliamsR(candles);
  const wrSig: "BUY" | "SELL" | "NEUTRAL" = willR <= -80 ? "BUY" : willR >= -20 ? "SELL" : willR < -60 ? "BUY" : willR > -40 ? "SELL" : "NEUTRAL";
  results.push({ name: "Williams %R", value: willR.toFixed(2), signal: wrSig, weight: 10 });

  // 6. CCI (20) — weight 10
  const cci = calculateCCI(candles);
  const cciSig: "BUY" | "SELL" | "NEUTRAL" = cci <= -100 ? "BUY" : cci >= 100 ? "SELL" : cci < -50 ? "BUY" : cci > 50 ? "SELL" : "NEUTRAL";
  results.push({ name: "CCI (20)", value: cci.toFixed(2), signal: cciSig, weight: 10 });

  // 7. ADX/DI — weight 9
  const adx = calculateADX(candles);
  const adxSig: "BUY" | "SELL" | "NEUTRAL" = adx.adx > 18 ? (adx.plusDI > adx.minusDI ? "BUY" : "SELL") : "NEUTRAL";
  results.push({ name: "ADX/DI", value: `ADX:${adx.adx.toFixed(1)} +DI:${adx.plusDI.toFixed(1)}`, signal: adxSig, weight: 9 });

  // 8. Ichimoku — weight 9
  const ichi = calculateIchimoku(candles);
  results.push({ name: "Ichimoku", value: `T:${ichi.tenkan.toFixed(5)}`, signal: ichi.signal === "BULLISH" ? "BUY" : ichi.signal === "BEARISH" ? "SELL" : "NEUTRAL", weight: 9 });

  // 9. EMA Trend (9/21) — weight 7
  const trend = detectTrend(closes);
  results.push({ name: "EMA Trend", value: trend.trend, signal: trend.trend === "UPTREND" ? "BUY" : trend.trend === "DOWNTREND" ? "SELL" : "NEUTRAL", weight: 7 });

  // 10. ROC (10) — weight 6
  const roc = calculateROC(closes);
  const rocSig: "BUY" | "SELL" | "NEUTRAL" = roc > 0.05 ? "BUY" : roc < -0.05 ? "SELL" : "NEUTRAL";
  results.push({ name: "ROC (10)", value: roc.toFixed(4), signal: rocSig, weight: 6 });

  return results;
}
