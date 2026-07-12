/**
 * Format a number using English (ASCII) digits only, never Arabic-Indic.
 * This is critical: the system must ALWAYS show 0-9, never ٠-٩.
 */

// Force ASCII/Latin digits
const toLatinDigits = (str: string): string => {
  return String(str).replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
};

/**
 * Format currency amount - always English digits
 */
export const formatCurrency = (amount: number | string, currency = 'LYD', symbol = 'د.ل'): string => {
  const num = parseFloat(String(amount)) || 0;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${toLatinDigits(formatted)} ${symbol}`;
};

/**
 * Format number - always English digits
 */
export const formatNumber = (num: number | string, decimals = 0): string => {
  const n = parseFloat(String(num)) || 0;
  return toLatinDigits(n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }));
};

/**
 * Safely parse date strings (fixes SQLite timezone issues)
 */
const safeParseDate = (date: string | Date): Date => {
  if (date instanceof Date) return date;
  if (typeof date === 'string') {
    // Fix SQLite timestamp format "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SSZ"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(date) && !date.includes('Z')) {
      return new Date(date.replace(' ', 'T') + 'Z');
    }
    // Fix ISO strings missing timezone
    if (date.includes('T') && !date.includes('Z') && !date.includes('+') && !date.includes('-')) {
      return new Date(date + 'Z');
    }
  }
  return new Date(date);
};

/**
 * Format date - always English digits
 */
export const formatDate = (date: string | Date, format: 'short' | 'long' | 'time' | 'datetime' = 'short'): string => {
  if (!date) return '-';
  const d = safeParseDate(date);
  if (isNaN(d.getTime())) return '-';

  const opts: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit', hour12: true },
    datetime: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true },
  };

  // Use 'en-US' locale to guarantee ASCII digits
  const formatted = d.toLocaleString('en-US', opts[format]);
  return toLatinDigits(formatted);
};

/**
 * Format date for display in Arabic context but with English digits
 */
export const formatDateArabic = (date: string | Date): string => {
  if (!date) return '-';
  const d = safeParseDate(date);
  if (isNaN(d.getTime())) return '-';
  
  // Always use en-US to get ASCII digits
  const formatted = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return toLatinDigits(formatted);
};

/**
 * Format quantity with unit
 */
export const formatQuantity = (qty: number | string, unit?: string): string => {
  const n = parseFloat(String(qty)) || 0;
  const number = n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
  return unit ? `${toLatinDigits(number)} ${unit}` : toLatinDigits(number);
};

/**
 * Get today's date string YYYY-MM-DD
 */
export const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get date range for presets
 */
export const getDateRange = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'year') => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (preset) {
    case 'today': {
      const todayStr = getTodayDate();
      return { from: todayStr, to: todayStr };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const str = yesterday.toISOString().split('T')[0];
      return { from: str, to: str };
    }
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      return { from: weekStart.toISOString().split('T')[0], to: getTodayDate() };
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: monthStart.toISOString().split('T')[0], to: getTodayDate() };
    }
    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { from: yearStart.toISOString().split('T')[0], to: getTodayDate() };
    }
    default:
      return { from: getTodayDate(), to: getTodayDate() };
  }
};

/**
 * Compute relative time label
 */
export const timeAgo = (date: string | Date): string => {
  const d = safeParseDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'منذ لحظات';
  if (diffMin < 60) return `منذ ${toLatinDigits(String(diffMin))} دقيقة`;
  if (diffHr < 24) return `منذ ${toLatinDigits(String(diffHr))} ساعة`;
  return formatDate(date, 'datetime');
};

export { toLatinDigits };
