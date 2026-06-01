export type GeoScoreTrendPoint = {
  totalScore: number;
  createdAt: Date | string;
};

export function formatGeoScoreTrendDateLabel(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Map scores (0–100) to SVG coordinates, oldest point leftmost. */
export function buildGeoScoreTrendSvgCoords(
  points: GeoScoreTrendPoint[],
  width: number,
  height: number,
  padding = 12,
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const innerW = Math.max(width - padding * 2, 1);
  const innerH = Math.max(height - padding * 2, 1);
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  return points.map((p, i) => {
    const clamped = Math.min(100, Math.max(0, p.totalScore));
    const x = padding + (points.length > 1 ? step * i : innerW / 2);
    const y = padding + innerH * (1 - clamped / 100);
    return { x, y };
  });
}

export function geoScoreTrendPolyline(coords: { x: number; y: number }[]): string {
  return coords.map(c => `${c.x},${c.y}`).join(" ");
}
