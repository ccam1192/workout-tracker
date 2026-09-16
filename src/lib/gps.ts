import type { GpsPoint } from "@/lib/types";

const EARTH_RADIUS_MILES = 3958.8;
const EARTH_RADIUS_KM = 6371.0;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  unit: "mi" | "km" = "mi",
): number {
  const R = unit === "km" ? EARTH_RADIUS_KM : EARTH_RADIUS_MILES;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      sinHalfLng *
      sinHalfLng;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function calculateTotalDistance(
  points: GpsPoint[],
  unit: "mi" | "km" = "mi",
): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i], unit);
  }
  return total;
}

export function isValidGpsPoint(
  lat: number,
  lng: number,
  accuracy: number | null | undefined,
): boolean {
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (accuracy != null && accuracy > 50) return false;
  return true;
}

export function isReasonableMovement(
  prev: GpsPoint,
  next: GpsPoint,
): boolean {
  const timeDiffSeconds = (next.timestamp - prev.timestamp) / 1000;
  if (timeDiffSeconds <= 0) return false;

  const distanceMiles = haversineDistance(prev, next, "mi");
  const speedMph = (distanceMiles / timeDiffSeconds) * 3600;

  if (speedMph > 30) return false;

  return true;
}

export function formatPace(
  distanceMiles: number,
  durationSeconds: number,
  unit: "mi" | "km" = "mi",
): string | null {
  const distance = unit === "km" ? distanceMiles * 1.60934 : distanceMiles;
  if (distance <= 0.01 || durationSeconds <= 0) return null;

  const paceSeconds = durationSeconds / distance;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")} / ${unit}`;
}
