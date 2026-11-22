const toRad = (value) => (value * Math.PI) / 180

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Pelayar ini tidak menyokong lokasi.'))
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Lokasi tidak dapat dibaca. Sila benarkan akses lokasi dan cuba lagi.')), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  })
}
