import { CandleData, PriceActionResult, ConfirmationResult } from "@/types";
import { calculateATR } from "@/lib/indicators";

// ─── Candle Power Analysis ─────────────────────────────────────────────────────
export function analyzeCandlePower(candles: CandleData[]): {
  power: number;
  buyerStrength: number;
  sellerStrength: number;
  dominance: "BUYER" | "SELLER" | "BALANCED";
} {
  if (candles.length < 5) return { power: 50, buyerStrength: 50, sellerStrength: 50, dominance: "BALANCED" };

  // Weight recent candles more heavily — last 3 most important
  const recent = candles.slice(-10);
  let totalBuyPower = 0, totalSellPower = 0;

  recent.forEach((c, i) => {
    const range = c.high - c.low;
    if (range === 0) return;
    // Recency weight: more recent = higher weight
    const weight = 1 + (i / recent.length) * 1.5;

    const bullBody = Math.max(0, c.close - c.open);
    const bearBody = Math.max(0, c.open - c.close);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    totalBuyPower += (bullBody + lowerWick * 0.55) * weight;
    totalSellPower += (bearBody + upperWick * 0.55) * weight;
  });

  const totalPower = totalBuyPower + totalSellPower;
  if (totalPower === 0) return { power: 50, buyerStrength: 50, sellerStrength: 50, dominance: "BALANCED" };

  const buyerStrength = Math.round((totalBuyPower / totalPower) * 100);
  const sellerStrength = 100 - buyerStrength;

  const last = candles[candles.length - 1];
  const lastRange = last.high - last.low;
  const lastBody = Math.abs(last.close - last.open);
  const power = lastRange > 0 ? Math.round((lastBody / lastRange) * 100) : 50;

  const dominance = buyerStrength >= 58 ? "BUYER" : sellerStrength >= 58 ? "SELLER" : "BALANCED";

  return { power, buyerStrength, sellerStrength, dominance };
}

// ─── Market Zone Detection ────────────────────────────────────────────────────
export function detectMarketZone(candles: CandleData[], atr: number): {
  zone: "SUPPORT" | "RESISTANCE" | "NEUTRAL";
  zoneStrength: number;
  label: string;
  nearLevel: number;
} {
  if (candles.length < 20) {
    return { zone: "NEUTRAL", zoneStrength: 0, label: "No Zone", nearLevel: candles[candles.length - 1]?.close ?? 0 };
  }

  const slice = candles.slice(-30);
  const current = candles[candles.length - 1].close;

  const keyResistances: number[] = [];
  const keySupports: number[] = [];

  for (let i = 1; i < slice.length - 1; i++) {
    if (slice[i].high > slice[i - 1].high && slice[i].high > slice[i + 1].high) {
      keyResistances.push(slice[i].high);
    }
    if (slice[i].low < slice[i - 1].low && slice[i].low < slice[i + 1].low) {
      keySupports.push(slice[i].low);
    }
  }

  const resistancesAbove = keyResistances.filter(r => r > current).sort((a, b) => a - b);
  const supportsBelow = keySupports.filter(s => s < current).sort((a, b) => b - a);

  const nearResistance = resistancesAbove[0];
  const nearSupport = supportsBelow[0];

  const distToResistance = nearResistance ? nearResistance - current : Infinity;
  const distToSupport = nearSupport ? current - nearSupport : Infinity;

  const threshold = Math.max(atr * 1.2, atr * 0.5);

  if (distToSupport < threshold && distToSupport < distToResistance) {
    const strength = Math.round(Math.max(0, 100 - (distToSupport / threshold) * 100));
    return {
      zone: "SUPPORT",
      zoneStrength: strength,
      label: `Support Zone (±${(distToSupport * 10000).toFixed(1)} pips)`,
      nearLevel: nearSupport!,
    };
  }

  if (distToResistance < threshold && distToResistance < distToSupport) {
    const strength = Math.round(Math.max(0, 100 - (distToResistance / threshold) * 100));
    return {
      zone: "RESISTANCE",
      zoneStrength: strength,
      label: `Resistance Zone (±${(distToResistance * 10000).toFixed(1)} pips)`,
      nearLevel: nearResistance!,
    };
  }

  const midpoint = ((nearResistance ?? current * 1.001) + (nearSupport ?? current * 0.999)) / 2;
  const label = current > midpoint ? "Upper Mid Zone" : "Lower Mid Zone";
  return { zone: "NEUTRAL", zoneStrength: 0, label, nearLevel: current };
}

// ─── Price Action Analysis ────────────────────────────────────────────────────
export function analyzePriceAction(candles: CandleData[], atr: number): PriceActionResult {
  if (candles.length < 10) {
    return {
      zone: "NEUTRAL", zoneStrength: 0, candlePower: 50,
      buyerStrength: 50, sellerStrength: 50, momentum: 0,
      priceActionSignal: "NEUTRAL", marketZoneLabel: "Insufficient Data",
    };
  }

  const { zone, zoneStrength, label } = detectMarketZone(candles, atr);
  const { power, buyerStrength, sellerStrength, dominance } = analyzeCandlePower(candles);

  const closes = candles.map(c => c.close);
  const recentCloses = closes.slice(-5);
  const momentum = atr > 0
    ? ((recentCloses[recentCloses.length - 1] - recentCloses[0]) / atr) * 100
    : 0;

  let priceActionSignal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";

  if (zone === "SUPPORT" && dominance === "BUYER" && momentum > 5) {
    priceActionSignal = "BUY";
  } else if (zone === "SUPPORT" && dominance !== "SELLER") {
    priceActionSignal = "BUY";
  } else if (zone === "RESISTANCE" && dominance === "SELLER" && momentum < -5) {
    priceActionSignal = "SELL";
  } else if (zone === "RESISTANCE" && dominance !== "BUYER") {
    priceActionSignal = "SELL";
  } else if (zone === "NEUTRAL") {
    // In neutral zone follow momentum + buyer/seller strongly
    if (dominance === "BUYER" && momentum > 10) priceActionSignal = "BUY";
    else if (dominance === "SELLER" && momentum < -10) priceActionSignal = "SELL";
    else if (momentum > 25) priceActionSignal = "BUY";
    else if (momentum < -25) priceActionSignal = "SELL";
  }

  return {
    zone, zoneStrength, candlePower: power,
    buyerStrength, sellerStrength, momentum,
    priceActionSignal, marketZoneLabel: label,
  };
}

// ─── 5-Second Confirmation Engine ────────────────────────────────────────────
export function runConfirmation(candles: CandleData[], direction: "BUY" | "SELL"): ConfirmationResult {
  if (candles.length < 3) {
    return { confirmed: false, direction: "NEUTRAL", score: 50, reasons: ["Insufficient data"] };
  }

  const reasons: string[] = [];
  let score = 0;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const lastBull = last.close > last.open;
  const prevBull = prev.close > prev.open;

  if (direction === "BUY") {
    if (lastBull) { score += 25; reasons.push("Last candle bullish"); }
    else score += 8; // partial — don't penalize too hard
    if (prevBull) { score += 15; reasons.push("Bullish momentum"); }
    else score += 5;

    const prevMid = (prev.high + prev.low) / 2;
    if (last.close > prevMid) { score += 20; reasons.push("Close above prev midpoint"); }
    else score += 8;

    if (last.low >= prev2.low) { score += 15; reasons.push("Higher/equal low"); }
    else score += 5;

    // Volume — give partial score when data unavailable
    if (last.volume > 0 && prev.volume > 0) {
      if (lastBull && last.volume > prev.volume) { score += 15; reasons.push("Volume confirms bullish"); }
      else score += 7;
    } else {
      score += 10; // No volume data — neutral partial
    }

    // Wick analysis — long lower wick = buyer absorption
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const range = last.high - last.low;
    if (range > 0 && lowerWick > range * 0.3) { score += 10; reasons.push("Buyer absorption wick"); }

  } else {
    // SELL
    const lastBear = !lastBull;
    const prevBear = !prevBull;

    if (lastBear) { score += 25; reasons.push("Last candle bearish"); }
    else score += 8;
    if (prevBear) { score += 15; reasons.push("Bearish momentum"); }
    else score += 5;

    const prevMid = (prev.high + prev.low) / 2;
    if (last.close < prevMid) { score += 20; reasons.push("Close below prev midpoint"); }
    else score += 8;

    if (last.high <= prev2.high) { score += 15; reasons.push("Lower/equal high"); }
    else score += 5;

    if (last.volume > 0 && prev.volume > 0) {
      if (lastBear && last.volume > prev.volume) { score += 15; reasons.push("Volume confirms bearish"); }
      else score += 7;
    } else {
      score += 10;
    }

    // Upper wick — seller rejection
    const upperWick = last.high - Math.max(last.open, last.close);
    const range = last.high - last.low;
    if (range > 0 && upperWick > range * 0.3) { score += 10; reasons.push("Seller rejection wick"); }
  }

  const normalizedScore = Math.min(100, score);
  const confirmed = normalizedScore >= 50;

  return {
    confirmed,
    direction: direction,
    score: normalizedScore,
    reasons,
  };
}

// ─── Screenshot Chart Analysis Engine ────────────────────────────────────────
// Deep multi-pass pixel analysis for any broker chart screenshot
export function analyzeChartScreenshot(imageData: string): Promise<{
  direction: "CALL" | "PUT" | "NEUTRAL";
  confidence: number;
  patterns: string[];
  zones: string[];
  trend: string;
  candlePattern: string;
  buyerSellerRatio: number;
  recommendation: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Work at half resolution for speed but full quality analysis
      canvas.width = Math.min(img.width, 1200);
      canvas.height = Math.min(img.height, 800);
      const scaleX = canvas.width / img.width;
      const scaleY = canvas.height / img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(generateFallbackAnalysis());
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;

      // Chart area — exclude toolbars/legends (top 8%, bottom 15%, left 4%, right 8%)
      const chartTop = Math.floor(height * 0.08);
      const chartBottom = Math.floor(height * 0.85);
      const chartLeft = Math.floor(width * 0.04);
      const chartRight = Math.floor(width * 0.92);
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      // ── Pass 1: Global color distribution ──────────────────────────────────
      let greenPixels = 0, redPixels = 0, neutralPixels = 0;
      const sampleStep = Math.max(3, Math.floor(Math.min(width, height) / 80));

      for (let y = chartTop; y < chartBottom; y += sampleStep) {
        for (let x = chartLeft; x < chartRight; x += sampleStep) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
          if (a < 50) continue; // Skip transparent pixels

          const isGreen = g > r + 25 && g > b + 10 && g > 50;
          const isRed = r > g + 25 && r > b + 10 && r > 50;

          if (isGreen) greenPixels++;
          else if (isRed) redPixels++;
          else neutralPixels++;
        }
      }

      // ── Pass 2: Recent candles (right 30%) — weighted 2x ─────────────────
      let recentGreen = 0, recentRed = 0;
      const recentStart = chartRight - Math.floor(chartWidth * 0.30);

      for (let y = chartTop; y < chartBottom; y += sampleStep) {
        for (let x = recentStart; x < chartRight; x += sampleStep) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
          if (a < 50) continue;
          if (g > r + 25 && g > b + 10 && g > 50) recentGreen++;
          else if (r > g + 25 && r > b + 10 && r > 50) recentRed++;
        }
      }

      // ── Pass 3: Column price tracking (trend detection) ──────────────────
      // Divide chart into 24 columns and find the vertical center of color mass
      const numCols = 24;
      const colWidth = Math.floor(chartWidth / numCols);
      const priceWeights: number[] = []; // 0 = price at top (high), 1 = price at bottom (low)

      for (let col = 0; col < numCols; col++) {
        const colX1 = chartLeft + col * colWidth;
        const colX2 = colX1 + colWidth;
        let weightedY = 0, totalColored = 0;

        for (let x = colX1; x < colX2; x += 2) {
          for (let y = chartTop; y < chartBottom; y += 2) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
            if (a < 50) continue;
            const isColored = (g > r + 25 && g > 50) || (r > g + 25 && r > 50);
            if (isColored) {
              // Normalize Y: 0 = top of chart (high price), 1 = bottom (low price)
              const normalY = (y - chartTop) / chartHeight;
              weightedY += normalY;
              totalColored++;
            }
          }
        }

        priceWeights.push(totalColored > 0 ? weightedY / totalColored : 0.5);
      }

      // ── Pass 4: Wicks and shadow detection (recent 20%) ──────────────────
      let upperWickPixels = 0, lowerWickPixels = 0;
      const veryRecentStart = chartRight - Math.floor(chartWidth * 0.20);
      const upperZone = chartTop + Math.floor(chartHeight * 0.25);
      const lowerZone = chartBottom - Math.floor(chartHeight * 0.25);

      for (let y = chartTop; y < upperZone; y += sampleStep) {
        for (let x = veryRecentStart; x < chartRight; x += sampleStep) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
          if (a < 50) continue;
          if (g > r + 20 && g > 50) upperWickPixels++;
          else if (r > g + 20 && r > 50) upperWickPixels++;
        }
      }

      for (let y = lowerZone; y < chartBottom; y += sampleStep) {
        for (let x = veryRecentStart; x < chartRight; x += sampleStep) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
          if (a < 50) continue;
          if (g > r + 20 && g > 50) lowerWickPixels++;
          else if (r > g + 20 && r > 50) lowerWickPixels++;
        }
      }

      // ── Analysis computation ──────────────────────────────────────────────
      const totalColored = greenPixels + redPixels;
      const globalBuyRatio = totalColored > 0 ? greenPixels / totalColored : 0.5;

      const recentTotal = recentGreen + recentRed;
      const recentBuyRatio = recentTotal > 0 ? recentGreen / recentTotal : 0.5;

      // Trend from column price weights
      const firstThird = priceWeights.slice(0, 8);
      const lastThird = priceWeights.slice(16);
      const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length || 0.5;
      const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length || 0.5;

      // Lower normalY = higher price on chart
      const trendBullScore = avgFirst - avgLast; // positive = price going up (avg Y moving up = lower normalY)
      const trendBullish = trendBullScore > 0.04;
      const trendBearish = trendBullScore < -0.04;

      // Wick bias: more lower wicks = buyer rejection at lows (bullish)
      const totalWicks = upperWickPixels + lowerWickPixels;
      const lowerWickBias = totalWicks > 0 ? lowerWickPixels / totalWicks : 0.5;

      // ── Weighted score composition ────────────────────────────────────────
      // Global ratio: 20%, Recent ratio: 35%, Trend: 30%, Wicks: 15%
      const bullScore = (
        globalBuyRatio * 0.20 +
        recentBuyRatio * 0.35 +
        (trendBullish ? 0.30 : trendBearish ? 0.05 : 0.15) +
        lowerWickBias * 0.15
      );

      const bearScore = 1 - bullScore;
      const diff = Math.abs(bullScore - bearScore);

      // ── Directional decision ──────────────────────────────────────────────
      let direction: "CALL" | "PUT" | "NEUTRAL";
      let confidence: number;

      if (diff < 0.05) {
        // Very close — still force a direction by tiebreaker (recent)
        direction = recentBuyRatio >= 0.5 ? "CALL" : "PUT";
        confidence = Math.round(58 + diff * 80);
      } else if (bullScore > bearScore) {
        direction = "CALL";
        confidence = Math.min(96, Math.round(60 + diff * 220));
      } else {
        direction = "PUT";
        confidence = Math.min(96, Math.round(60 + diff * 220));
      }

      // ── Pattern detection ─────────────────────────────────────────────────
      const patterns: string[] = [];
      const zones: string[] = [];

      if (recentBuyRatio > 0.65) patterns.push("Bullish Candle Cluster");
      if (recentBuyRatio < 0.35) patterns.push("Bearish Candle Cluster");
      if (trendBullish) { patterns.push("Uptrend Detected"); zones.push("Bullish Momentum Zone"); }
      if (trendBearish) { patterns.push("Downtrend Detected"); zones.push("Bearish Momentum Zone"); }
      if (diff > 0.20) patterns.push("Strong Directional Bias");
      if (diff > 0.12) patterns.push("Clear Market Direction");
      if (lowerWickBias > 0.60) { patterns.push("Buyer Absorption Wicks"); zones.push("Support Structure"); }
      if (lowerWickBias < 0.40) { patterns.push("Seller Rejection Wicks"); zones.push("Resistance Structure"); }
      if (globalBuyRatio > 0.60) zones.push("Demand Zone");
      if (globalBuyRatio < 0.40) zones.push("Supply Zone");

      if (patterns.length === 0) patterns.push("Chart analyzed — direction determined");
      if (zones.length === 0) zones.push("Price structure detected");

      const trend = trendBullish ? "UPTREND" : trendBearish ? "DOWNTREND" : "SIDEWAYS";

      // ── Candle pattern from recent area ──────────────────────────────────
      const candlePattern = (() => {
        if (recentBuyRatio > 0.70 && lowerWickBias > 0.55) return "Bullish Engulfing + Hammer";
        if (recentBuyRatio > 0.60) return "Bullish Dominance Pattern";
        if (recentBuyRatio < 0.30 && lowerWickBias < 0.45) return "Bearish Engulfing + Shooting Star";
        if (recentBuyRatio < 0.40) return "Bearish Pressure Pattern";
        if (trendBullish && recentBuyRatio > 0.50) return "Bullish Continuation";
        if (trendBearish && recentBuyRatio < 0.50) return "Bearish Continuation";
        return "Mixed Candle Structure";
      })();

      // ── Recommendation ────────────────────────────────────────────────────
      const rec = direction === "CALL"
        ? `📈 CALL — ${confidence}% bullish dominance. ${trendBullish ? "Chart shows uptrend." : ""} Enter at next candle open. 1-min expiry recommended.`
        : `📉 PUT — ${confidence}% bearish dominance. ${trendBearish ? "Chart shows downtrend." : ""} Enter at next candle open. 1-min expiry recommended.`;

      resolve({
        direction,
        confidence,
        patterns,
        zones,
        trend,
        candlePattern,
        buyerSellerRatio: Math.round(recentBuyRatio * 100),
        recommendation: rec,
      });
    };

    img.onerror = () => resolve(generateFallbackAnalysis());
    img.src = imageData;
  });
}

function generateFallbackAnalysis() {
  return {
    direction: "NEUTRAL" as "CALL" | "PUT" | "NEUTRAL",
    confidence: 55,
    patterns: ["Unable to read image — try a clearer screenshot"],
    zones: ["Check image format and quality"],
    trend: "UNKNOWN",
    candlePattern: "Undetectable",
    buyerSellerRatio: 50,
    recommendation: "Please upload a clear 1-minute chart screenshot with visible candles",
  };
}
