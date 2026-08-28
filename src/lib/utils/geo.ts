export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const ASSUMED_AVG_SPEED_KMH = 28;

export function estimateDurationMin(distanceKm: number): number {
  return (distanceKm / ASSUMED_AVG_SPEED_KMH) * 60;
}

export function formatDurationMin(min: number): string {
  if (min < 60) return `${Math.round(min)} menit`;
  const hours = Math.floor(min / 60);
  const mins = Math.round(min % 60);
  return mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`;
}
