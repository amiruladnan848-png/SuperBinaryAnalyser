import { ForexPair } from "@/types";

export const FOREX_PAIRS: ForexPair[] = [
  // === MAJOR PAIRS ===
  { symbol: "EUR/USD", label: "Euro / US Dollar", base: "EUR", quote: "USD", popular: true },
  { symbol: "GBP/USD", label: "Pound / US Dollar", base: "GBP", quote: "USD", popular: true },
  { symbol: "USD/JPY", label: "US Dollar / Yen", base: "USD", quote: "JPY", popular: true },
  { symbol: "USD/CHF", label: "US Dollar / Swiss Franc", base: "USD", quote: "CHF", popular: true },
  { symbol: "AUD/USD", label: "Aussie / US Dollar", base: "AUD", quote: "USD", popular: true },
  { symbol: "USD/CAD", label: "US Dollar / Canadian", base: "USD", quote: "CAD", popular: true },
  { symbol: "NZD/USD", label: "Kiwi / US Dollar", base: "NZD", quote: "USD", popular: true },

  // === CROSS PAIRS (popular) ===
  { symbol: "EUR/GBP", label: "Euro / Pound", base: "EUR", quote: "GBP", popular: true },
  { symbol: "EUR/JPY", label: "Euro / Yen", base: "EUR", quote: "JPY", popular: true },
  { symbol: "GBP/JPY", label: "Pound / Yen", base: "GBP", quote: "JPY", popular: true },
  { symbol: "AUD/JPY", label: "Aussie / Yen", base: "AUD", quote: "JPY", popular: true },
  { symbol: "EUR/AUD", label: "Euro / Aussie", base: "EUR", quote: "AUD", popular: true },
  { symbol: "EUR/CAD", label: "Euro / Canadian", base: "EUR", quote: "CAD", popular: true },
  { symbol: "GBP/AUD", label: "Pound / Aussie", base: "GBP", quote: "AUD", popular: true },
  { symbol: "GBP/CAD", label: "Pound / Canadian", base: "GBP", quote: "CAD", popular: true },
  { symbol: "CAD/JPY", label: "Canadian / Yen", base: "CAD", quote: "JPY", popular: true },

  // === CROSS PAIRS (standard) ===
  { symbol: "EUR/CHF", label: "Euro / Swiss Franc", base: "EUR", quote: "CHF", popular: false },
  { symbol: "GBP/CHF", label: "Pound / Swiss Franc", base: "GBP", quote: "CHF", popular: false },
  { symbol: "AUD/CAD", label: "Aussie / Canadian", base: "AUD", quote: "CAD", popular: false },
  { symbol: "AUD/CHF", label: "Aussie / Swiss Franc", base: "AUD", quote: "CHF", popular: false },
  { symbol: "AUD/NZD", label: "Aussie / Kiwi", base: "AUD", quote: "NZD", popular: false },
  { symbol: "CAD/CHF", label: "Canadian / Swiss Franc", base: "CAD", quote: "CHF", popular: false },
  { symbol: "CHF/JPY", label: "Swiss Franc / Yen", base: "CHF", quote: "JPY", popular: false },
  { symbol: "NZD/JPY", label: "Kiwi / Yen", base: "NZD", quote: "JPY", popular: false },
  { symbol: "NZD/CAD", label: "Kiwi / Canadian", base: "NZD", quote: "CAD", popular: false },
  { symbol: "NZD/CHF", label: "Kiwi / Swiss Franc", base: "NZD", quote: "CHF", popular: false },
  { symbol: "NZD/GBP", label: "Kiwi / Pound", base: "NZD", quote: "GBP", popular: false },
  { symbol: "EUR/NZD", label: "Euro / Kiwi", base: "EUR", quote: "NZD", popular: false },
  { symbol: "GBP/NZD", label: "Pound / Kiwi", base: "GBP", quote: "NZD", popular: false },

  // === EXOTIC PAIRS ===
  { symbol: "USD/SGD", label: "USD / Singapore Dollar", base: "USD", quote: "SGD", popular: false },
  { symbol: "USD/HKD", label: "USD / HK Dollar", base: "USD", quote: "HKD", popular: false },
  { symbol: "USD/MXN", label: "USD / Mexican Peso", base: "USD", quote: "MXN", popular: false },
  { symbol: "USD/TRY", label: "USD / Turkish Lira", base: "USD", quote: "TRY", popular: false },
  { symbol: "USD/ZAR", label: "USD / South African Rand", base: "USD", quote: "ZAR", popular: false },
  { symbol: "USD/NOK", label: "USD / Norwegian Krone", base: "USD", quote: "NOK", popular: false },
  { symbol: "USD/SEK", label: "USD / Swedish Krona", base: "USD", quote: "SEK", popular: false },
  { symbol: "USD/DKK", label: "USD / Danish Krone", base: "USD", quote: "DKK", popular: false },
  { symbol: "EUR/PLN", label: "Euro / Polish Zloty", base: "EUR", quote: "PLN", popular: false },
  { symbol: "EUR/HUF", label: "Euro / Hungarian Forint", base: "EUR", quote: "HUF", popular: false },
  { symbol: "USD/CNH", label: "USD / Offshore Yuan", base: "USD", quote: "CNH", popular: false },
  { symbol: "USD/THB", label: "USD / Thai Baht", base: "USD", quote: "THB", popular: false },
];

export const POPULAR_PAIRS = FOREX_PAIRS.filter(p => p.popular);

export const TWELVEDATA_SYMBOL_MAP: Record<string, string> = {};
FOREX_PAIRS.forEach(p => {
  TWELVEDATA_SYMBOL_MAP[p.symbol] = p.symbol;
});
