export interface ForexPair {
  symbol: string;
  label: string;
  base: string;
  quote: string;
  popular: boolean;
}

export type SignalDirection = "CALL" | "PUT" | "NEUTRAL";
export type SignalStrength = "STRONG" | "MODERATE" | "WEAK";
export type MarketSession = "SYDNEY" | "TOKYO" | "LONDON" | "NEW_YORK" | "OVERLAP" | "CLOSED";
export type AppTheme = "emerald" | "gold" | "cyber" | "ocean" | "ruby" | "light" | "rose" | "violet";

export interface Signal {
  id: string;
  pair: string;
  direction: SignalDirection;
  strength: SignalStrength;
  confidence: number;
  timestamp: Date;
  expiry: string;
  indicators: IndicatorResult[];
  sessionName: string;
  entryTime: string;
  expiryTime: string;
  rsi: number;
  trend: string;
  pattern: string;
  liquidityType?: string;
  bosType?: "BULLISH" | "BEARISH";
  candlePower?: number;
  buyerStrength?: number;
  sellerStrength?: number;
  marketZone?: string;
  priceAction?: string;
  confirmationScore?: number;
  screenshotAnalysis?: ScreenshotAnalysis;
}

export interface ScreenshotAnalysis {
  direction: SignalDirection;
  confidence: number;
  patterns: string[];
  zones: string[];
  trend: string;
  candlePattern: string;
  buyerSellerRatio: number;
  recommendation: string;
  timestamp: Date;
}

export interface IndicatorResult {
  name: string;
  value: number | string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  weight: number;
}

export interface CandleData {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface APIConfig {
  apiKey: string;
  isValid: boolean;
}

export interface PriceActionResult {
  zone: "SUPPORT" | "RESISTANCE" | "NEUTRAL";
  zoneStrength: number;
  candlePower: number;
  buyerStrength: number;
  sellerStrength: number;
  momentum: number;
  priceActionSignal: "BUY" | "SELL" | "NEUTRAL";
  marketZoneLabel: string;
}

export interface ConfirmationResult {
  confirmed: boolean;
  direction: "BUY" | "SELL" | "NEUTRAL";
  score: number;
  reasons: string[];
}
