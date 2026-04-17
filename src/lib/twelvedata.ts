import { CandleData } from "@/types";
import { TWELVEDATA_SYMBOL_MAP } from "@/constants/pairs";

// ── API Config (provider info hidden) ──────────────────────────────────────
const _seg = ["https://", "api", ".", "tw", "el", "ve", "da", "ta", ".com"].join("");
const API_BASE = _seg;

// Ultra-smart per-pair cache — reuse within same minute window
const cache: Map<string, { data: CandleData[]; timestamp: number; minute: number }> = new Map();

// In-flight deduplication — never make 2 calls for the same pair simultaneously
const inFlight: Map<string, Promise<CandleData[]>> = new Map();

// Per-pair rate limiting
const lastFetchTime: Map<string, number> = new Map();
const MIN_FETCH_INTERVAL = 10000; // 10s minimum between same-pair fetches

// Candle count: 45 is sufficient for all 10 indicators — saves ~45% credits vs 80
const DEFAULT_OUTPUT_SIZE = 45;

function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60000);
}

export async function fetchCandles(pair: string, apiKey: string, outputSize = DEFAULT_OUTPUT_SIZE): Promise<CandleData[]> {
  const now = Date.now();
  const currentMinute = getCurrentMinute();
  const cached = cache.get(pair);

  // Same minute cache — zero credits used on repeated calls within the same 1-min candle
  if (cached && cached.minute === currentMinute && cached.data.length >= 20) {
    console.log(`[Cache HIT same-minute] ${pair}`);
    return cached.data;
  }

  // Fresh cache within 55 seconds — still valid
  if (cached && now - cached.timestamp < 55000 && cached.data.length >= 20) {
    console.log(`[Cache HIT fresh] ${pair}`);
    return cached.data;
  }

  // In-flight deduplication
  if (inFlight.has(pair)) {
    console.log(`[Dedup in-flight] ${pair}`);
    return inFlight.get(pair)!;
  }

  // Rate-limit guard: if fresh cache exists, return it rather than a blocked call
  const lastFetch = lastFetchTime.get(pair) ?? 0;
  if (now - lastFetch < MIN_FETCH_INTERVAL && cached && cached.data.length >= 20) {
    console.log(`[Rate-limit guard] ${pair} returning cached`);
    return cached.data;
  }

  const symbol = TWELVEDATA_SYMBOL_MAP[pair] || pair;
  // Clamp to 45 max — enough for RSI(14) + MACD(26+9) + Ichimoku(52 not used at 45 but graceful fallback)
  const size = Math.min(Math.max(outputSize, 35), 45);
  const url = `${API_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1min&outputsize=${size}&apikey=${apiKey}&format=JSON`;

  const promise = (async (): Promise<CandleData[]> => {
    try {
      lastFetchTime.set(pair, now);
      console.log(`[Fetch] ${pair} — ${size} candles`);

      const res = await fetch(url, { signal: AbortSignal.timeout(14000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (json.status === "error") throw new Error(json.message || "API error");
      if (!Array.isArray(json.values) || json.values.length === 0) throw new Error("No data received");

      const candles: CandleData[] = json.values
        .map((v: Record<string, string>) => ({
          datetime: v.datetime,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: parseFloat(v.volume || "0"),
        }))
        .filter((c: CandleData) => !isNaN(c.open) && !isNaN(c.close) && c.high >= c.low)
        .reverse(); // oldest → newest

      if (candles.length < 20) throw new Error(`Insufficient candles: ${candles.length}`);

      cache.set(pair, { data: candles, timestamp: now, minute: currentMinute });
      console.log(`[Fetch OK] ${pair} — ${candles.length} candles cached`);
      return candles;

    } catch (err) {
      console.error(`[Fetch ERROR] ${pair}:`, err);
      // Return stale cache if available rather than crashing
      if (cached && cached.data.length >= 20) {
        console.warn(`[Stale fallback] ${pair}`);
        return cached.data;
      }
      throw err;
    } finally {
      inFlight.delete(pair);
    }
  })();

  inFlight.set(pair, promise);
  return promise;
}

export async function validateAPIKey(apiKey: string): Promise<boolean> {
  try {
    // Use 5 candles for validation — minimal credit usage
    const url = `${API_BASE}/time_series?symbol=EUR/USD&interval=1min&outputsize=5&apikey=${apiKey}&format=JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return false;
    const json = await res.json();
    return json.status !== "error" && Array.isArray(json.values) && json.values.length > 0;
  } catch {
    return false;
  }
}

// Batch fetch: fetch multiple pairs sequentially with a gap to avoid rate limits
export async function fetchCandlesBatch(
  pairs: string[],
  apiKey: string,
  onPairFetched?: (pair: string, candles: CandleData[]) => void
): Promise<Map<string, CandleData[]>> {
  const results = new Map<string, CandleData[]>();

  for (const pair of pairs) {
    try {
      const candles = await fetchCandles(pair, apiKey);
      results.set(pair, candles);
      onPairFetched?.(pair, candles);
      // Small gap between requests to respect rate limits (only if not from cache)
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.warn(`[Batch] Failed ${pair}:`, err);
    }
  }

  return results;
}

export function clearCache(): void { cache.clear(); }
export function getCacheSize(): number { return cache.size; }
export function invalidatePairCache(pair: string): void { cache.delete(pair); }
