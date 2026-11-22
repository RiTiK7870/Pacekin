export type Pt = { lat: number; lng: number; t: number; acc: number };

const R = 6371000;
export const MAX_ACCURACY_M = 25; // drop noisy GPS fixes
export const MAX_SPEED_MPS = 11;  // above this is an implausible jump
export const MIN_STEP_M = 3;      // ignore jitter

export function haversine(a: Pt, b: Pt): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function acceptPoint(prev: Pt | undefined, next: Pt): boolean {
  if (next.acc > MAX_ACCURACY_M) return false;
  if (!prev) return true;
  const dt = (next.t - prev.t) / 1000;
  if (dt <= 0) return false;
  const d = haversine(prev, next);
  if (d < MIN_STEP_M) return false;
  return d / dt <= MAX_SPEED_MPS;
}

/** Keep route storage small: at most `max` points, evenly sampled. */
export function downsample(points: Pt[], max = 800): Pt[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  return points.filter((_, i) => i % step === 0);
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

/** Pace in min/km as "m:ss". Returns "--:--" until 50 m is covered. */
export function formatPace(distanceM: number, seconds: number): string {
  if (distanceM < 50 || seconds <= 0) return '--:--';
  const total = Math.round(seconds / (distanceM / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const formatKm = (m: number) => (m / 1000).toFixed(2);
