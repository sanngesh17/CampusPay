export function formatMinor(minor: string, currency: string): string {
  const major = Number(BigInt(minor)) / 100;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(major);
}

export function shortHash(hash?: string): string {
  if (!hash) return '—';
  return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function countdown(toIso: string, now: number = Date.now()): string {
  const ms = new Date(toIso).getTime() - now;
  if (ms <= 0) return 'expired';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
