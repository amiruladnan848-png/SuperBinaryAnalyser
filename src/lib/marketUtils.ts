import { MarketSession } from "@/types";

export const BANGLADESH_TZ = "Asia/Dhaka";

export function getBangladeshTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: BANGLADESH_TZ }));
}

export function formatBDTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: BANGLADESH_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

export function formatBDDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: BANGLADESH_TZ, weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export function isWeekend(): boolean {
  const bdTime = getBangladeshTime();
  const day = bdTime.getDay();
  return day === 0 || day === 6;
}

// Weekend: auto signal engine LOCKED. Only screenshot analysis is allowed.
export function isMarketOpen(): boolean {
  return !isWeekend();
}

export function getMarketSession(): { session: MarketSession; label: string; color: string } {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcTime = utcHour + utcMinute / 60;
  const weekend = isWeekend();

  if (weekend) {
    if (utcTime >= 0 && utcTime < 8) return { session: "TOKYO", label: "OTC Asia Session", color: "#FF6347" };
    if (utcTime >= 8 && utcTime < 16) return { session: "LONDON", label: "OTC Europe Session", color: "#7CFC00" };
    return { session: "NEW_YORK", label: "OTC Americas Session", color: "#00BFFF" };
  }

  const isSydney = utcTime >= 22 || utcTime < 7;
  const isTokyo = utcTime >= 0 && utcTime < 9;
  const isLondon = utcTime >= 8 && utcTime < 17;
  const isNewYork = utcTime >= 13 && utcTime < 22;

  if (isLondon && isNewYork) return { session: "OVERLAP", label: "London + New York ⚡", color: "#FFD700" };
  if (isTokyo && isLondon) return { session: "OVERLAP", label: "Tokyo + London ⚡", color: "#FF8C00" };
  if (isNewYork) return { session: "NEW_YORK", label: "New York Session", color: "#00BFFF" };
  if (isLondon) return { session: "LONDON", label: "London Session", color: "#7CFC00" };
  if (isTokyo) return { session: "TOKYO", label: "Tokyo Session", color: "#FF6347" };
  if (isSydney) return { session: "SYDNEY", label: "Sydney Session", color: "#DA70D6" };
  return { session: "SYDNEY", label: "Pacific Session", color: "#DA70D6" };
}

export function getSessionQuality(session: MarketSession): number {
  switch (session) {
    case "OVERLAP": return 1.40;
    case "NEW_YORK": return 1.28;
    case "LONDON": return 1.28;
    case "TOKYO": return 1.08;
    case "SYDNEY": return 0.95;
    default: return 0.85;
  }
}

export function getNextSignalTime(): Date {
  const now = Date.now();
  const nextMinuteMs = Math.ceil(now / 60000) * 60000;
  return new Date(nextMinuteMs);
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function getSessionTimes(): Array<{ session: string; open: string; close: string; bdOpen: string; bdClose: string }> {
  return [
    { session: "Sydney", open: "22:00 UTC", close: "07:00 UTC", bdOpen: "04:00 BDT", bdClose: "13:00 BDT" },
    { session: "Tokyo", open: "00:00 UTC", close: "09:00 UTC", bdOpen: "06:00 BDT", bdClose: "15:00 BDT" },
    { session: "London", open: "08:00 UTC", close: "17:00 UTC", bdOpen: "14:00 BDT", bdClose: "23:00 BDT" },
    { session: "New York", open: "13:00 UTC", close: "22:00 UTC", bdOpen: "19:00 BDT", bdClose: "04:00 BDT" },
  ];
}

// ── Daily Usage Tracker ───────────────────────────────────────────────────────
const DAILY_KEY = "sba_daily_usage";
const DAILY_SCREENSHOT_KEY = "sba_daily_screenshot";

interface DailyUsage {
  date: string;
  count: number;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDailySignalUsage(): number {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return 0;
    const data: DailyUsage = JSON.parse(raw);
    if (data.date !== getTodayStr()) return 0;
    return data.count;
  } catch { return 0; }
}

export function incrementDailySignalUsage(by = 1): number {
  try {
    const today = getTodayStr();
    const raw = localStorage.getItem(DAILY_KEY);
    let data: DailyUsage = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (data.date !== today) data = { date: today, count: 0 };
    data.count += by;
    localStorage.setItem(DAILY_KEY, JSON.stringify(data));
    return data.count;
  } catch { return 0; }
}

export function getDailyScreenshotUsage(): number {
  try {
    const raw = localStorage.getItem(DAILY_SCREENSHOT_KEY);
    if (!raw) return 0;
    const data: DailyUsage = JSON.parse(raw);
    if (data.date !== getTodayStr()) return 0;
    return data.count;
  } catch { return 0; }
}

export function incrementDailyScreenshotUsage(): number {
  try {
    const today = getTodayStr();
    const raw = localStorage.getItem(DAILY_SCREENSHOT_KEY);
    let data: DailyUsage = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (data.date !== today) data = { date: today, count: 0 };
    data.count += 1;
    localStorage.setItem(DAILY_SCREENSHOT_KEY, JSON.stringify(data));
    return data.count;
  } catch { return 0; }
}

export const DAILY_SIGNAL_LIMIT = 10;
export const DAILY_SCREENSHOT_LIMIT = 10;
