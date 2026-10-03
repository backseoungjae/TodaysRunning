// Input: seconds/km. Output: m:ss; missing or invalid pace uses a placeholder.
export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--:--';
  const total = Math.max(1, Math.round(secondsPerKm));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
