// Input: meters. Output: kilometers without the unit label.
export function formatDistance(distanceMeters: number): string {
  return Number.isFinite(distanceMeters) && distanceMeters >= 0 ? (distanceMeters / 1000).toFixed(2) : '0.00';
}
